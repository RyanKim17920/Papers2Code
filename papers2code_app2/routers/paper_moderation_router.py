from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging # Ensure logging is imported
import traceback

from ..schemas_papers import (
    PaperResponse, SetImplementabilityRequest
)
from ..schemas_minimal import UserSchema
from ..shared import (
    config_settings,
    # Import the constants
    IMPL_STATUS_VOTING,
    IMPL_STATUS_COMMUNITY_IMPLEMENTABLE,
    IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE,
    MAIN_STATUS_NOT_IMPLEMENTABLE, # Import new constant
    MAIN_STATUS_NOT_STARTED # Import new constant
)
from ..database import (
    get_papers_collection_sync,
    get_user_actions_collection_sync,
    get_removed_papers_collection_sync
)
from ..utils import transform_paper_sync
from ..auth import get_current_user, get_current_owner

router = APIRouter(
    prefix="/papers",
    tags=["paper-moderation"],
)

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)

async def _recalculate_and_update_community_status(paper_id_obj: ObjectId, papers_collection, paper_doc_for_votes=None):
    """
    Recalculates and updates the community-driven implementability_status of a paper 
    and its main 'status' based on its votes and thresholds.
    If paper_doc_for_votes is provided, its vote counts are used. Otherwise, fetches the paper.
    This function respects admin-set implementability statuses.
    """
    if paper_doc_for_votes:
        current_paper_doc = paper_doc_for_votes
    else:
        current_paper_doc = papers_collection.find_one({"_id": paper_id_obj})

    if not current_paper_doc:
        logger.error(f"_recalculate_and_update_community_status: Paper {paper_id_obj} not found.")
        return IMPL_STATUS_VOTING # Default or error state

    current_db_implementability_status = current_paper_doc.get("implementability_status")
    current_main_status = current_paper_doc.get("status")
    
    admin_override_statuses = [IMPL_STATUS_ADMIN_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]

    update_fields = {}
    new_calculated_community_status = current_db_implementability_status # Start with current

    # Only proceed to calculate community status if not under admin override
    if current_db_implementability_status not in admin_override_statuses:
        not_implementable_votes = current_paper_doc.get("nonImplementableVotes", 0)
        is_implementable_votes = current_paper_doc.get("isImplementableVotes", 0)

        calculated_status_based_on_votes = IMPL_STATUS_VOTING # Default for community vote outcome
        if not_implementable_votes >= config_settings.VOTING.NOT_IMPLEMENTABLE_CONFIRM_THRESHOLD and \
           not_implementable_votes > is_implementable_votes:
            calculated_status_based_on_votes = IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE
        elif is_implementable_votes >= config_settings.VOTING.IMPLEMENTABLE_CONFIRM_THRESHOLD and \
             is_implementable_votes > not_implementable_votes:
            calculated_status_based_on_votes = IMPL_STATUS_COMMUNITY_IMPLEMENTABLE
        
        if current_db_implementability_status != calculated_status_based_on_votes:
            update_fields["implementability_status"] = calculated_status_based_on_votes
            new_calculated_community_status = calculated_status_based_on_votes # This is the new status being set

    # Determine the effective implementability status for main status logic
    # This will be the newly set community status, or the existing admin/community status if no change by votes
    effective_implementability_status = new_calculated_community_status

    # Adjust main 'status' based on the effective_implementability_status
    new_main_status = current_main_status
    if effective_implementability_status in [IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]:
        if current_main_status != MAIN_STATUS_NOT_IMPLEMENTABLE:
            new_main_status = MAIN_STATUS_NOT_IMPLEMENTABLE
    # If it was "Not Implementable" (due to community or admin) and now it's not because effective_implementability_status changed
    elif current_db_implementability_status in [IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE] and \
         effective_implementability_status not in [IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]:
        if current_main_status == MAIN_STATUS_NOT_IMPLEMENTABLE:
            new_main_status = MAIN_STATUS_NOT_STARTED # Revert to default

    if new_main_status != current_main_status:
        update_fields["status"] = new_main_status

    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc)
        papers_collection.update_one({"_id": paper_id_obj}, {"$set": update_fields})
        # Return the status that was actually set or would be the new community status
        return update_fields.get("implementability_status", effective_implementability_status)

    # If no fields were updated, return the existing (or admin-locked) implementability status
    return current_db_implementability_status

@router.post("/{paper_id}/flag_implementability", response_model=PaperResponse)
@limiter.limit("30/minute")
async def flag_paper_implementability(
    request: Request,
    paper_id: str,
    action: str = Body(..., embed=True, pattern="^(confirm|dispute|retract)$"), # confirm = vote IS implementable, dispute = vote NOT implementable
    current_user: UserSchema = Depends(get_current_user)
):
    try:
        user_id_str = str(current_user.id)
        if not user_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")

        try:
            user_obj_id = ObjectId(user_id_str)
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper or user ID format")
        except ValueError as ve: # Catch ObjectId's specific ValueError for invalid hex strings
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid ID format: {ve}")


        papers_collection = get_papers_collection_sync()
        user_actions_collection = get_user_actions_collection_sync()

        paper = papers_collection.find_one({"_id": paper_obj_id})
        if not paper:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")

        # Check if owner has locked the status via implementabilityStatus field
        # Admin statuses indicate an override that disables community voting.
        admin_override_statuses = [IMPL_STATUS_ADMIN_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]
        if paper.get("implementability_status") in admin_override_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Implementability status is locked by admin to '{paper.get("implementability_status")}'. Voting is disabled."
            )

        current_action_doc = user_actions_collection.find_one({
            "userId": user_obj_id,
            "paperId": paper_obj_id,
            "actionType": {"$in": [IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, IMPL_STATUS_COMMUNITY_IMPLEMENTABLE, "Not Implementable", "Implementable"]} # Include old values for transition if any
        })
        current_vote_type = None
        if current_action_doc:
            # Normalize current vote type for logic
            if current_action_doc.get("actionType") in [IMPL_STATUS_COMMUNITY_IMPLEMENTABLE, "Implementable"]:
                current_vote_type = "confirm" # User previously voted "is implementable"
            elif current_action_doc.get("actionType") in [IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, "Not Implementable"]:
                current_vote_type = "dispute" # User previously voted "is not implementable"
        
        logger.info(f"Flagging action: user='{user_obj_id}', paper='{paper_obj_id}', requested_action='{action}', current_vote_type='{current_vote_type}'")

        paper_vote_update_ops = {"$inc": {}}
        user_action_op = None # 'insert', 'update', 'delete'
        new_user_action_type_for_db = None

        if action == 'retract':
            if not current_action_doc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No existing vote to retract.")
            user_action_op = 'delete'
            if current_vote_type == 'dispute': # Was "Not Implementable"
                paper_vote_update_ops["$inc"]["nonImplementableVotes"] = -1
            elif current_vote_type == 'confirm': # Was "Implementable"
                paper_vote_update_ops["$inc"]["isImplementableVotes"] = -1
        
        elif action == 'confirm': # Vote FOR implementability
            new_user_action_type_for_db = IMPL_STATUS_COMMUNITY_IMPLEMENTABLE # Store consistent value
            if current_vote_type == 'confirm':
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You have already voted this paper as 'Implementable'.")
            
            paper_vote_update_ops["$inc"]["isImplementableVotes"] = 1
            if current_action_doc: # User changing vote
                user_action_op = 'update'
                if current_vote_type == 'dispute': # Was "Not Implementable"
                    paper_vote_update_ops["$inc"]["nonImplementableVotes"] = -1
            else: # New vote
                user_action_op = 'insert'

        elif action == 'dispute': # Vote AGAINST implementability
            new_user_action_type_for_db = IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE # Store consistent value
            if current_vote_type == 'dispute':
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You have already voted this paper as 'Not Implementable'.")

            paper_vote_update_ops["$inc"]["nonImplementableVotes"] = 1
            if current_action_doc: # User changing vote
                user_action_op = 'update'
                if current_vote_type == 'confirm': # Was "Implementable"
                    paper_vote_update_ops["$inc"]["isImplementableVotes"] = -1
            else: # New vote
                user_action_op = 'insert'
        else:
            # Should be caught by Body pattern, but as a safeguard
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid action: {action}")

        action_update_successful = False
        now = datetime.now(timezone.utc)
        if user_action_op == 'delete':
            delete_result = user_actions_collection.delete_one({"_id": current_action_doc["_id"]})
            action_update_successful = delete_result.deleted_count == 1
        elif user_action_op == 'update':
            update_action_result = user_actions_collection.update_one(
                {"_id": current_action_doc["_id"]},
                {"$set": {"actionType": new_user_action_type_for_db, "updatedAt": now}}
            )
            action_update_successful = update_action_result.modified_count == 1
        elif user_action_op == 'insert':
            new_action_doc = {
                "userId": user_obj_id, "paperId": paper_obj_id,
                "actionType": new_user_action_type_for_db, "createdAt": now, "updatedAt": now
            }
            try:
                insert_result = user_actions_collection.insert_one(new_action_doc)
                action_update_successful = insert_result.inserted_id is not None
            except DuplicateKeyError as e: # MODIFIED LINE
                logger.warning(
                    f"DuplicateKeyError on insert for user action. Attempted doc: {new_action_doc}. Details: {e}" # MODIFIED LINE
                )
                action_update_successful = False
        
        if not action_update_successful:
            # Log details if needed, or if specific error for user action failure
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to record vote action.")

        updated_paper_doc = None
        if paper_vote_update_ops.get("$inc"): # Ensure there are vote changes
            updated_paper_doc = papers_collection.find_one_and_update(
                {"_id": paper_obj_id},
                {**paper_vote_update_ops, "$set": {"updated_at": now}}, # also update paper's updated_at
                return_document=ReturnDocument.AFTER
            )
            if not updated_paper_doc:
                # This would be a critical error, paper disappeared or update failed
                logger.error(f"Failed to update paper {paper_obj_id} vote counts.")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update paper vote counts.")
        else: # No vote changes, e.g. retracting a non-existent vote (already handled) or other edge case
            updated_paper_doc = paper # Use the initially fetched paper

        # Recalculate and set the main implementability_status based on new vote counts
        # This will also handle the main 'status' field update if necessary.
        # Pass the updated_paper_doc to use its fresh vote counts.
        await _recalculate_and_update_community_status(paper_obj_id, papers_collection, paper_doc_for_votes=updated_paper_doc)
        
        final_paper_doc = papers_collection.find_one({"_id": paper_obj_id}) # Fetch the latest state
        if not final_paper_doc:
            logger.error(f"Paper {paper_obj_id} not found after all operations in flag_implementability.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Paper data inconsistent after voting.")
            
        return transform_paper_sync(final_paper_doc, user_id_str, detail_level="full")

    except HTTPException:
        raise
    except DuplicateKeyError: # Should be handled within insert logic if possible
        logger.error("Duplicate key error during flag_implementability.", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="A database error occurred (duplicate entry).")
    except Exception as e:
        logger.exception("Unexpected error in flag_paper_implementability")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {e}")


@router.post("/{paper_id}/set_implementability", response_model=PaperResponse)
@limiter.limit("10/minute")
async def set_paper_implementability(
    request: Request,
    paper_id: str,
    payload: SetImplementabilityRequest,
    current_user: UserSchema = Depends(get_current_owner) # Ensures only owner can call
):
    try:
        user_id_str = str(current_user.id) # For transform_paper_sync
        if not user_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found for token")

        try:
            paper_obj_id = ObjectId(paper_id)
        except (InvalidId, ValueError) as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid paper ID format: {e}")

        status_to_set_by_admin = payload.status_to_set # Expect 'Admin Not Implementable', 'Admin Implementable', or 'voting'

        papers_collection = get_papers_collection_sync()
        paper_to_update = papers_collection.find_one({"_id": paper_obj_id})

        if not paper_to_update:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")

        db_update_payload = {"updated_at": datetime.now(timezone.utc)}
        
        # Validate admin status values
        valid_admin_settable_statuses = [IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE, IMPL_STATUS_ADMIN_IMPLEMENTABLE, IMPL_STATUS_VOTING]
        if status_to_set_by_admin not in valid_admin_settable_statuses:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid status value: {status_to_set_by_admin}")

        db_update_payload["implementability_status"] = status_to_set_by_admin
        
        current_main_status = paper_to_update.get("status")
        new_main_status = current_main_status

        if status_to_set_by_admin == IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE:
            if current_main_status != MAIN_STATUS_NOT_IMPLEMENTABLE:
                new_main_status = MAIN_STATUS_NOT_IMPLEMENTABLE
        elif status_to_set_by_admin == IMPL_STATUS_ADMIN_IMPLEMENTABLE or status_to_set_by_admin == IMPL_STATUS_VOTING:
            # If admin is making it implementable or reverting to voting,
            # and current main status is 'Not Implementable' (possibly from a previous state),
            # then revert main status to 'Not Started'.
            if current_main_status == MAIN_STATUS_NOT_IMPLEMENTABLE:
                new_main_status = MAIN_STATUS_NOT_STARTED
        
        if new_main_status != current_main_status:
            db_update_payload["status"] = new_main_status
        
        result = papers_collection.update_one(
            {"_id": paper_obj_id},
            {"$set": db_update_payload}
        )

        if result.modified_count == 0 and not result.matched_count: # Check if paper existed but nothing changed
            # This case might occur if the status was already what admin tried to set it to.
            # We still might need to recalculate if it was set to "voting".
            pass # It's not an error if nothing changed, but flow continues.

        # If owner reverted to 'voting', recalculate community status and potentially main status again
        if status_to_set_by_admin == IMPL_STATUS_VOTING:
            # _recalculate_and_update_community_status will fetch the paper with the new "voting" status
            # and then apply community vote logic, including further main status update if needed.
            await _recalculate_and_update_community_status(paper_obj_id, papers_collection) 

        updated_paper = papers_collection.find_one({"_id": paper_obj_id})
        if not updated_paper:
            # This should ideally not happen if the update was successful or paper existed
            logger.error(f"Paper {paper_obj_id} not found after admin set_implementability and potential recalculation.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found after update.")
            
        return transform_paper_sync(updated_paper, user_id_str, detail_level="full")

    except HTTPException:
        raise
    except Exception as e:
        import traceback # Import traceback for logging
        logger.error(f"Error in set_paper_implementability: {traceback.format_exc()}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {e}")

@router.delete("/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_paper(
    request: Request,
    paper_id: str,
    current_user: UserSchema = Depends(get_current_owner)
):
    try:
        user_id_str = str(current_user.id)
        try:
            obj_id = ObjectId(paper_id)
        except (InvalidId, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid paper ID format: {e}"
            )

        papers_collection = get_papers_collection_sync()
        removed_papers_collection = get_removed_papers_collection_sync()

        paper = papers_collection.find_one({"_id": obj_id})
        if not paper:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Paper not found"
            )

        paper["removedAt"] = datetime.now(timezone.utc)
        paper["removedBy"] = user_id_str # Store who removed it
        
        # Add a timestamp for when the paper was last updated before removal
        paper["updated_at_before_removal"] = paper.get("updated_at", datetime.now(timezone.utc))


        insert_result = removed_papers_collection.insert_one(paper)
        if not insert_result.inserted_id:
            logger.error(f"Failed to archive paper {obj_id} before deletion.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to archive paper before deletion"
            )

        delete_result = papers_collection.delete_one({"_id": obj_id})
        if delete_result.deleted_count != 1:
            logger.error(f"Failed to delete paper {obj_id} after archiving. Deleted count: {delete_result.deleted_count}")
            # This is a critical state - paper archived but not deleted. Manual intervention might be needed.
            # For now, raise error. Consider how to handle this (e.g., attempt to remove from archive if deletion fails consistently)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete paper after archiving"
            )

        return None # HTTP 204 No Content

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_paper: {traceback.format_exc()}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during paper deletion: {e}"
        )

