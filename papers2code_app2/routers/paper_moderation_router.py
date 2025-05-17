from fastapi import APIRouter, Depends, HTTPException, status, Request
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson.errors import InvalidId
from datetime import datetime
import traceback
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..schemas import (
    FlagActionRequest, PaperResponse, User, PyObjectId,
    SetImplementabilityRequest
)
from ..shared import (
    get_papers_collection_sync,
    get_user_actions_collection_sync,
    get_removed_papers_collection_sync,
    transform_paper_sync,
    config_settings
)
from ..auth import get_current_user_placeholder, owner_required_placeholder

router = APIRouter(
    prefix="/papers",
    tags=["paper-moderation"],
)

limiter = Limiter(key_func=get_remote_address)

# Original Flask: @limiter.limit("30 per minute")
@router.post("/{paper_id}/flag_implementability", response_model=PaperResponse)
@limiter.limit("30/minute")
async def flag_paper_implementability(
    request: Request,
    paper_id: str,
    payload: FlagActionRequest,
    current_user: User = Depends(get_current_user_placeholder)
):
    try:
        user_id_str = current_user.id
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in session"
            )

        try:
            user_obj_id = PyObjectId(user_id_str)
            paper_obj_id = PyObjectId(paper_id)
        except InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid paper or user ID format"
            )
        except ValueError as ve:  # PyObjectId might raise ValueError for non-hex strings if not caught by InvalidId
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid ID format: {ve}"
            )

        action = payload.action

        papers_collection = get_papers_collection_sync()
        user_actions_collection = get_user_actions_collection_sync()

        paper = papers_collection.find_one({"_id": paper_obj_id})
        if not paper:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Paper not found"
            )

        if paper.get("nonImplementableStatus") == config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB and \
           paper.get("nonImplementableConfirmedBy") == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Implementability status already confirmed by owner."
            )

        current_action_doc = user_actions_collection.find_one({
            "userId": user_obj_id,
            "paperId": paper_obj_id,
            "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
        })
        current_action_type = current_action_doc.get("actionType") if current_action_doc else None

        update_ops = {"$set": {}}
        increment_ops = {}
        needs_status_check = False
        action_to_perform = None
        new_action_type = None

        if action == 'retract':
            if not current_action_doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No existing vote to retract."
                )
            action_to_perform = 'delete'
            if current_action_type == 'confirm_non_implementable':
                increment_ops["nonImplementableVotes"] = -1
            elif current_action_type == 'dispute_non_implementable':
                increment_ops["disputeImplementableVotes"] = -1
            needs_status_check = True

        elif action == 'confirm':  # This means user confirms the paper IS implementable (disputes non-implementability flag)
            new_action_type = 'dispute_non_implementable'
            if current_action_type == new_action_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have already voted this paper as 'Is Implementable'."
                )
            if current_action_doc:  # User is changing their vote
                action_to_perform = 'update'
                increment_ops["disputeImplementableVotes"] = 1
                increment_ops["nonImplementableVotes"] = -1  # Was previously confirm_non_implementable
            else:  # New vote
                action_to_perform = 'insert'
                increment_ops["disputeImplementableVotes"] = 1
            needs_status_check = True

        elif action == 'dispute':  # This means user disputes implementability (confirms it's NOT implementable)
            new_action_type = 'confirm_non_implementable'
            if current_action_type == new_action_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have already voted this paper as 'Not Implementable'."
                )
            if current_action_doc:  # User is changing their vote
                action_to_perform = 'update'
                increment_ops["nonImplementableVotes"] = 1
                increment_ops["disputeImplementableVotes"] = -1  # Was previously dispute_non_implementable
            else:  # New vote
                action_to_perform = 'insert'
                increment_ops["nonImplementableVotes"] = 1

            # If paper is currently seen as implementable, this vote flags it.
            if paper.get("nonImplementableStatus", config_settings.STATUS_IMPLEMENTABLE) == config_settings.STATUS_IMPLEMENTABLE:
                update_ops["$set"]["nonImplementableStatus"] = config_settings.STATUS_FLAGGED_NON_IMPLEMENTABLE
                if not paper.get("nonImplementableFlaggedBy"):  # Record first flagger
                    update_ops["$set"]["nonImplementableFlaggedBy"] = user_obj_id
            needs_status_check = True
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action: {action}"
            )

        action_update_successful = False
        if action_to_perform == 'delete':
            delete_result = user_actions_collection.delete_one({"_id": current_action_doc["_id"]})
            action_update_successful = delete_result.deleted_count == 1
        elif action_to_perform == 'update':
            update_result = user_actions_collection.update_one(
                {"_id": current_action_doc["_id"]},
                {"$set": {"actionType": new_action_type, "createdAt": datetime.utcnow()}}
            )
            action_update_successful = update_result.modified_count == 1
        elif action_to_perform == 'insert':
            try:
                insert_result = user_actions_collection.insert_one({
                    "userId": user_obj_id, "paperId": paper_obj_id,
                    "actionType": new_action_type, "createdAt": datetime.utcnow()
                })
                action_update_successful = insert_result.inserted_id is not None
            except DuplicateKeyError:  # Should not happen if find_one logic is correct, but as a safeguard
                # This means the action was somehow created between the find_one and insert_one.
                # We can treat this as "already done" or "concurrently done".
                # For simplicity, let's assume the intended state is now reflected or will be by another process.
                # Re-fetch paper and return.
                action_update_successful = True  # Or handle as a conflict. For now, assume it's okay.

        if not action_update_successful and action_to_perform:
            # If the action wasn't performed as expected (e.g. doc to update/delete not found, or insert failed non-dupe)
            # This indicates a potential concurrency issue or stale state.
            # Re-fetch the paper and return its current state.
            current_paper_state = papers_collection.find_one({"_id": paper_obj_id})
            if not current_paper_state:  # Should not happen if paper existed initially
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update action and refetch paper."
                )
            return transform_paper_sync(current_paper_state, user_id_str)

        # Apply vote count changes to the paper
        if increment_ops:
            update_ops["$inc"] = increment_ops
        if not update_ops.get("$set"):  # Avoid empty $set
            update_ops.pop("$set", None)

        if update_ops:  # If there are any changes to $set or $inc
            updated_paper_doc = papers_collection.find_one_and_update(
                {"_id": paper_obj_id}, update_ops, return_document=ReturnDocument.AFTER
            )
            if not updated_paper_doc:
                # This is critical, paper should exist. If not, something went wrong.
                current_paper_state = papers_collection.find_one({"_id": paper_obj_id})  # Try to refetch
                if not current_paper_state:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to update paper vote counts and refetch."
                    )
                return transform_paper_sync(
                    current_paper_state, user_id_str
                )  # Return current state if update failed but paper exists
            paper_after_vote_update = updated_paper_doc
        else:  # No direct updates to paper from this action other than vote counts (which might be 0 if action was 'retract' and no status change)
            paper_after_vote_update = papers_collection.find_one({"_id": paper_obj_id})  # Re-fetch to get current vote counts
            if not paper_after_vote_update:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Failed to refetch paper after action."
                )

        # Check and update overall paper implementability status based on new vote counts
        new_status_after_vote = paper_after_vote_update.get(
            "nonImplementableStatus", config_settings.STATUS_IMPLEMENTABLE
        )
        final_status_update_ops = {"$set": {}, "$unset": {}}  # Initialize for clarity

        votes_not_implementable = paper_after_vote_update.get("nonImplementableVotes", 0)
        votes_is_implementable = paper_after_vote_update.get("disputeImplementableVotes", 0)

        if needs_status_check and paper_after_vote_update.get("nonImplementableConfirmedBy") != "owner":
            is_flagged = new_status_after_vote == config_settings.STATUS_FLAGGED_NON_IMPLEMENTABLE
            # is_still_implementable means it was never flagged or a flag was disputed successfully before thresholds were met
            is_still_implementable = new_status_after_vote == config_settings.STATUS_IMPLEMENTABLE

            if is_flagged or is_still_implementable:  # Only proceed if not already community confirmed
                non_impl_threshold = config_settings.NON_IMPLEMENTABLE_CONFIRM_THRESHOLD
                impl_threshold = config_settings.IMPLEMENTABLE_CONFIRM_THRESHOLD

                # Condition for confirming non-implementable by community
                if votes_not_implementable >= votes_is_implementable + non_impl_threshold:
                    final_status_update_ops["$set"].update({
                        "is_implementable": False,
                        "nonImplementableStatus": config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB,
                        "status": config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE,  # UI friendly status
                        "nonImplementableConfirmedBy": "community"
                    })
                # Condition for confirming implementable by community (disputing existing flags)
                elif votes_is_implementable >= votes_not_implementable + impl_threshold:
                    final_status_update_ops["$set"].update({
                        "is_implementable": True,
                        "nonImplementableStatus": config_settings.STATUS_CONFIRMED_IMPLEMENTABLE_DB,
                        "status": config_settings.STATUS_CONFIRMED_IMPLEMENTABLE,  # UI friendly status
                        "nonImplementableConfirmedBy": "community"
                    })
                    # Clear all related votes and flags as it's now confirmed implementable
                    final_status_update_ops["$unset"].update({
                        "nonImplementableVotes": "", "disputeImplementableVotes": "",
                        "nonImplementableFlaggedBy": ""
                    })
                    # Also clear from user_actions
                    user_actions_collection.delete_many({
                        "paperId": paper_obj_id,
                        "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
                    })
                # Condition if it was flagged, but disputes now outweigh or equal flags (but not enough to meet impl_threshold)
                # This reverts the status from "flagged" back to "implementable" (or "not_started" for UI)
                elif is_flagged and votes_is_implementable >= votes_not_implementable:
                    final_status_update_ops["$set"].update({
                        "is_implementable": True,  # Default state
                        "nonImplementableStatus": config_settings.STATUS_IMPLEMENTABLE,  # Default DB status
                        "status": config_settings.STATUS_NOT_STARTED  # UI friendly status
                    })
                    # Clear all votes and flags as the flag is effectively cancelled
                    final_status_update_ops["$unset"].update({
                        "nonImplementableVotes": "", "disputeImplementableVotes": "",
                        "nonImplementableFlaggedBy": "", "nonImplementableConfirmedBy": ""  # Clear any previous confirmation
                    })
                    user_actions_collection.delete_many({
                        "paperId": paper_obj_id,
                        "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
                    })

        final_paper_doc = paper_after_vote_update
        if final_status_update_ops.get("$set") or final_status_update_ops.get("$unset"):
            if not final_status_update_ops.get("$set"):
                final_status_update_ops.pop("$set", None)
            if not final_status_update_ops.get("$unset"):
                final_status_update_ops.pop("$unset", None)

            if final_status_update_ops:  # Ensure there's something to update
                possibly_final_doc = papers_collection.find_one_and_update(
                    {"_id": paper_obj_id}, final_status_update_ops, return_document=ReturnDocument.AFTER
                )
                if possibly_final_doc:
                    final_paper_doc = possibly_final_doc
                # If possibly_final_doc is None, it means the paper was deleted concurrently, which is an edge case.
                # The original final_paper_doc (paper_after_vote_update) would be returned.

        return transform_paper_sync(final_paper_doc, user_id_str)

    except HTTPException:
        raise
    except DuplicateKeyError:  # This might occur if the unique index on user_actions is violated.
        traceback.print_exc()
        # This typically means the user tried to perform the exact same action very quickly,
        # or there's a logic flaw allowing it. Re-fetch and return current state.
        # Consider if a more specific error to the user is needed.
        # For now, a generic conflict or server error.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate action detected, please try again or refresh."
        )
    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred during implementability voting."
        )


@router.post("/{paper_id}/set_implementability", response_model=PaperResponse)
@limiter.limit("10/minute")  # Lower limit for owner actions
async def set_paper_implementability(
    request: Request,  # Added request for limiter
    paper_id: str,
    payload: SetImplementabilityRequest,
    current_user: User = Depends(owner_required_placeholder)  # Ensures only owner can call
):
    try:
        user_id_str = current_user.id  # Owner's ID
        try:
            paper_obj_id = PyObjectId(paper_id)
        except (InvalidId, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid paper ID format: {e}"
            )

        status_to_set = payload.statusToSet

        valid_statuses = [
            config_settings.STATUS_CONFIRMED_IMPLEMENTABLE_DB,
            config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB,
            'voting'  # Special keyword to reset to community voting
        ]
        if status_to_set not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid value for statusToSet. Must be one of: {valid_statuses}"
            )

        papers_collection = get_papers_collection_sync()
        user_actions_collection = get_user_actions_collection_sync()

        # Ensure paper exists and current_user is indeed the owner (owner_required_placeholder should handle this)
        paper_to_update = papers_collection.find_one({"_id": paper_obj_id})
        if not paper_to_update:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Paper not found"
            )

        # Further check if current_user.id matches paper_to_update.get("uploader") or similar field if not done by Depends
        # Assuming owner_required_placeholder verifies this based on paper_id and current_user

        update_ops = {"$set": {}, "$unset": {}}

        if status_to_set == config_settings.STATUS_CONFIRMED_IMPLEMENTABLE_DB:
            update_ops["$set"] = {
                "is_implementable": True,
                "nonImplementableStatus": config_settings.STATUS_CONFIRMED_IMPLEMENTABLE_DB,
                "status": config_settings.STATUS_CONFIRMED_IMPLEMENTABLE,  # UI friendly
                "nonImplementableConfirmedBy": "owner"
            }
            update_ops["$unset"] = {  # Clear all community voting fields
                "nonImplementableVotes": "", "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": ""
            }
        elif status_to_set == config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB:
            update_ops["$set"] = {
                "is_implementable": False,
                "nonImplementableStatus": config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB,
                "status": config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE,  # UI friendly
                "nonImplementableConfirmedBy": "owner"
            }
            update_ops["$unset"] = {  # Clear all community voting fields
                "nonImplementableVotes": "", "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": ""
            }
        elif status_to_set == 'voting':  # Reset to community voting
            update_ops["$set"] = {
                "is_implementable": True,  # Default state before voting
                "nonImplementableStatus": config_settings.STATUS_IMPLEMENTABLE,  # Default DB status
                "status": config_settings.STATUS_NOT_STARTED  # UI friendly
            }
            update_ops["$unset"] = {  # Clear all community voting and confirmation fields
                "nonImplementableVotes": "", "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": "", "nonImplementableConfirmedBy": ""
            }

        # Owner action overrides and clears all community votes for this paper
        user_actions_collection.delete_many({
            "paperId": paper_obj_id,
            "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
        })
        print(f"Owner action for paper {paper_id}: Cleared community voting actions by user {user_id_str}.")

        if not update_ops.get("$set"):
            update_ops.pop("$set", None)
        if not update_ops.get("$unset"):
            update_ops.pop("$unset", None)

        if not update_ops:  # Should not happen with current logic, but as a safeguard
            current_paper = papers_collection.find_one({"_id": paper_obj_id})
            if not current_paper:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Paper not found after no-op owner action."
                )
            return transform_paper_sync(current_paper, user_id_str)

        updated_paper = papers_collection.find_one_and_update(
            {"_id": paper_obj_id}, update_ops, return_document=ReturnDocument.AFTER
        )

        if updated_paper:
            return transform_paper_sync(updated_paper, user_id_str)
        else:
            # If paper was not found for update, it might have been deleted concurrently.
            # Check if it still exists.
            if papers_collection.count_documents({"_id": paper_obj_id}) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Paper not found during owner update (possibly deleted)."
                )
            else:
                # Paper exists but update failed for some other reason (e.g. DB error not caught)
                # Try to return current state
                current_paper_state = papers_collection.find_one({"_id": paper_obj_id})
                if current_paper_state:
                    return transform_paper_sync(current_paper_state, user_id_str)
                # This state should be rare: paper exists but cannot be fetched after a failed update.
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update paper implementability status by owner and could not refetch."
                )

    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred during owner action for implementability."
        )


@router.delete("/{paper_id}", status_code=status.HTTP_200_OK)  # Or 204 No Content
@limiter.limit("5/minute")  # Limit deletions
async def remove_paper(
    request: Request,  # Added request for limiter
    paper_id: str,
    current_user: User = Depends(owner_required_placeholder)  # Ensures only owner
):
    try:
        user_id_str = current_user.id
        try:
            obj_id = PyObjectId(paper_id)
        except (InvalidId, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid paper ID format: {e}"
            )

        papers_collection = get_papers_collection_sync()
        removed_papers_collection = get_removed_papers_collection_sync()
        user_actions_collection = get_user_actions_collection_sync()

        paper_to_remove = papers_collection.find_one({"_id": obj_id})
        if not paper_to_remove:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Paper not found"
            )

        # Verify ownership again if owner_required_placeholder doesn't do it based on paper content
        # e.g. if paper_to_remove.get("uploader") != user_id_str:
        # raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to remove this paper")

        # Copy to removed_papers collection
        removed_doc = paper_to_remove.copy()
        removed_doc["original_id"] = removed_doc.pop("_id")  # Store original _id
        removed_doc["removedAt"] = datetime.utcnow()
        removed_doc["removedBy"] = {"userId": user_id_str, "username": getattr(current_user, 'username', 'N/A')}
        if "pwc_url" in removed_doc:  # Preserve original PWC URL if it exists
            removed_doc["original_pwc_url"] = removed_doc["pwc_url"]
            # Optionally, clear pwc_url from the removed_doc if it should no longer be active

        insert_result = removed_papers_collection.insert_one(removed_doc)
        print(f"Paper {paper_id} moved to removed_papers collection with new ID {insert_result.inserted_id} by user {user_id_str}")

        # Delete associated user actions (votes, flags, etc.)
        action_delete_result = user_actions_collection.delete_many({"paperId": obj_id})
        print(f"Removed {action_delete_result.deleted_count} actions from user_actions for deleted paper {paper_id}")

        # Delete from main papers collection
        delete_main_result = papers_collection.delete_one({"_id": obj_id})
        if delete_main_result.deleted_count == 1:
            print(f"Paper {paper_id} successfully deleted from main collection by user {user_id_str}.")
            return {"message": "Paper removed successfully"}  # Or status.HTTP_204_NO_CONTENT
        else:
            # This is problematic: paper was archived but not deleted from main.
            # Could be a sign of concurrent modification or DB issue.
            print(f"Warning: Paper {paper_id} deletion failed (count={delete_main_result.deleted_count}) from main collection after archiving. User: {user_id_str}")
            # Attempt to restore? Or just log and alert.
            # For now, raise an error indicating partial success / failure.
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Paper archived but final deletion from primary collection failed. Please check server logs."
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error removing paper {paper_id} by user {user_id_str}: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred during paper removal."
        )

