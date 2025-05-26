from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
import traceback
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging

from ..schemas_papers import (
    PaperResponse, SetImplementabilityRequest
)
from ..schemas_minimal import UserSchema
from ..shared import (
    get_papers_collection_sync,
    get_user_actions_collection_sync,
    get_removed_papers_collection_sync,
    transform_paper_sync,
    config_settings
)
from ..auth import get_current_user, get_current_owner

router = APIRouter(
    prefix="/papers",
    tags=["paper-moderation"],
)

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)

@router.post("/{paper_id}/flag_implementability", response_model=PaperResponse)
@limiter.limit("30/minute")
async def flag_paper_implementability(
    request: Request,
    paper_id: str,
    action: str = Body(..., embed=True, pattern="^(confirm|dispute|retract)$"),
    current_user: UserSchema = Depends(get_current_user)
):
    try:
        user_id_str = str(current_user.id)
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )

        try:
            user_obj_id = ObjectId(user_id_str)
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid paper or user ID format"
            )
        except ValueError as ve:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid ID format: {ve}"
            )

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
        logger.info(f"Flagging action: user_id_str='{user_id_str}', user_obj_id='{user_obj_id}', paper_obj_id='{paper_obj_id}', requested_action='{action}'")
        logger.info(f"Found current_action_doc: {current_action_doc}")
        current_action_type = current_action_doc.get("actionType") if current_action_doc else None

        update_ops = {"$set": {}}
        increment_ops = {}
        needs_status_check = False
        action_to_perform = None
        new_action_type = None

        if action == 'retract':
            if not current_action_doc:
                logger.error(f"No existing vote to retract for user '{user_obj_id}' on paper '{paper_obj_id}'. current_action_doc is None.")
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

        elif action == 'confirm':
            new_action_type = 'dispute_non_implementable'
            if current_action_type == new_action_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have already voted this paper as 'Is Implementable'."
                )
            if current_action_doc:
                action_to_perform = 'update'
                increment_ops["disputeImplementableVotes"] = 1
                if current_action_type == 'confirm_non_implementable':
                    increment_ops["nonImplementableVotes"] = -1
            else:
                action_to_perform = 'insert'
                increment_ops["disputeImplementableVotes"] = 1
            needs_status_check = True

        elif action == 'dispute':
            new_action_type = 'confirm_non_implementable'
            if current_action_type == new_action_type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have already voted this paper as 'Not Implementable'."
                )
            if current_action_doc:
                action_to_perform = 'update'
                increment_ops["nonImplementableVotes"] = 1
                if current_action_type == 'dispute_non_implementable':
                    increment_ops["disputeImplementableVotes"] = -1
            else:
                action_to_perform = 'insert'
                increment_ops["nonImplementableVotes"] = 1

            if paper.get("nonImplementableStatus", config_settings.STATUS_IMPLEMENTABLE) == config_settings.STATUS_IMPLEMENTABLE:
                update_ops["$set"]["nonImplementableStatus"] = config_settings.STATUS_FLAGGED_NON_IMPLEMENTABLE
                update_ops["$set"]["nonImplementableFlaggedBy"] = user_obj_id
                update_ops["$set"]["nonImplementableFlaggedAt"] = datetime.now(timezone.utc)
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
            update_action_result = user_actions_collection.update_one(
                {"_id": current_action_doc["_id"]},
                {"$set": {"actionType": new_action_type, "updatedAt": datetime.now(timezone.utc)}}
            )
            action_update_successful = update_action_result.modified_count == 1
        elif action_to_perform == 'insert':
            new_action = {
                "userId": user_obj_id,
                "paperId": paper_obj_id,
                "actionType": new_action_type,
                "createdAt": datetime.now(timezone.utc)
            }
            try:
                insert_result = user_actions_collection.insert_one(new_action)
                action_update_successful = insert_result.inserted_id is not None
            except DuplicateKeyError:
                # Race condition: another request already inserted this action
                # Check if the action now exists and handle accordingly
                logger.warning(f"DuplicateKeyError during insert for user {user_obj_id} on paper {paper_obj_id} with action {new_action_type}. Another request may have created this action simultaneously.")
                existing_action = user_actions_collection.find_one({
                    "userId": user_obj_id,
                    "paperId": paper_obj_id,
                    "actionType": new_action_type
                })
                if existing_action:
                    # Action was created by another request, consider it successful
                    action_update_successful = True
                    logger.info("Found existing action after DuplicateKeyError, treating as successful")
                else:
                    # Shouldn't happen, but log and fail gracefully
                    logger.error("DuplicateKeyError occurred but no existing action found")
                    action_update_successful = False

        if not action_update_successful:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user action."
            )

        paper_update_ops = {}
        if increment_ops:
            paper_update_ops["$inc"] = increment_ops
        if update_ops["$set"]:
            paper_update_ops["$set"] = update_ops["$set"]

        if paper_update_ops:
            updated_paper = papers_collection.find_one_and_update(
                {"_id": paper_obj_id},
                paper_update_ops,
                return_document=ReturnDocument.AFTER
            )
            if not updated_paper:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update paper after successful action."
                )

            if needs_status_check:
                current_paper = papers_collection.find_one({"_id": paper_obj_id})
                if not current_paper:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Paper not found during status check."
                    )

                non_implementable_votes = current_paper.get("nonImplementableVotes", 0)
                dispute_votes = current_paper.get("disputeImplementableVotes", 0)

                status_update = {}
                current_status = current_paper.get("nonImplementableStatus")

                if current_status == config_settings.STATUS_FLAGGED_NON_IMPLEMENTABLE and \
                   non_implementable_votes >= config_settings.NON_IMPLEMENTABLE_CONFIRM_THRESHOLD and \
                   dispute_votes < non_implementable_votes:
                    status_update["nonImplementableStatus"] = config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB
                    status_update["nonImplementableConfirmedBy"] = "community"
                    status_update["isImplementable"] = False

                elif current_status in [config_settings.STATUS_FLAGGED_NON_IMPLEMENTABLE,
                                       config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB] and \
                     dispute_votes >= config_settings.IMPLEMENTABLE_CONFIRM_THRESHOLD and \
                     dispute_votes > non_implementable_votes:
                    status_update["nonImplementableStatus"] = config_settings.STATUS_CONFIRMED_IMPLEMENTABLE_DB
                    status_update["nonImplementableConfirmedBy"] = "community"
                    status_update["isImplementable"] = True

                elif (current_status != config_settings.STATUS_IMPLEMENTABLE) and \
                     non_implementable_votes == 0 and dispute_votes == 0:
                    status_update["nonImplementableStatus"] = config_settings.STATUS_IMPLEMENTABLE
                    status_update["nonImplementableFlaggedBy"] = None
                    status_update["nonImplementableConfirmedBy"] = None
                    status_update["isImplementable"] = True

                if status_update:
                    status_update_result = papers_collection.update_one(
                        {"_id": paper_obj_id},
                        {"$set": status_update}
                    )
                    if status_update_result.modified_count != 1:
                        print(f"Failed to update paper status for {paper_id}")

            final_paper = papers_collection.find_one({"_id": paper_obj_id})
            if not final_paper:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Paper not found after operations"
                )
            return transform_paper_sync(final_paper, user_id_str, detail_level="full")
        else:
            return transform_paper_sync(paper, user_id_str, detail_level="full")

    except HTTPException:
        raise
    except DuplicateKeyError:
        logger.error("Duplicate key error during flag_implementability.", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred (duplicate entry)."
        )
    except Exception:
        logger.exception("Unexpected error in flag_paper_implementability")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while flagging implementability."
        )

@router.post("/{paper_id}/set_implementability", response_model=PaperResponse)
@limiter.limit("10/minute")
async def set_paper_implementability(
    request: Request,
    paper_id: str,
    payload: SetImplementabilityRequest,
    current_user: UserSchema = Depends(get_current_owner)
):
    try:
        user_id_str = str(current_user.id)
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )

        try:
            paper_obj_id = ObjectId(paper_id)
        except (InvalidId, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid paper ID format: {e}"
            )

        status_to_set = payload.status_to_set

        papers_collection = get_papers_collection_sync()

        paper = papers_collection.find_one({"_id": paper_obj_id})
        if not paper:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Paper not found"
            )

        update_ops = {}
        if status_to_set == config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB:
            update_ops["nonImplementableStatus"] = config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB
            update_ops["nonImplementableConfirmedBy"] = "owner"
            update_ops["nonImplementableConfirmedAt"] = datetime.now(timezone.utc)
            update_ops["isImplementable"] = False
        elif status_to_set == config_settings.STATUS_CONFIRMED_IMPLEMENTABLE_DB:
            update_ops["nonImplementableStatus"] = config_settings.STATUS_CONFIRMED_IMPLEMENTABLE_DB
            update_ops["nonImplementableConfirmedBy"] = "owner"
            update_ops["nonImplementableConfirmedAt"] = datetime.now(timezone.utc)
            update_ops["isImplementable"] = True
            update_ops["nonImplementableVotes"] = 0
            update_ops["disputeImplementableVotes"] = 0
        elif status_to_set == "voting" or status_to_set == config_settings.STATUS_FLAGGED_NON_IMPLEMENTABLE:
            update_ops["nonImplementableStatus"] = config_settings.STATUS_FLAGGED_NON_IMPLEMENTABLE
            update_ops["nonImplementableConfirmedBy"] = None
            update_ops["nonImplementableConfirmedAt"] = None
            update_ops["isImplementable"] = True
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_to_set}"
            )

        try:
            result = papers_collection.update_one(
                {"_id": paper_obj_id},
                {"$set": update_ops}
            )

            if result.modified_count != 1:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update paper status."
                )

            updated_paper = papers_collection.find_one({"_id": paper_obj_id})
            if not updated_paper:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Paper not found after update"
                )
            return transform_paper_sync(updated_paper, user_id_str, detail_level="full")

        except Exception as e:
            print(f"Error updating paper implementability: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to set implementability status."
            )

    except HTTPException:
        raise
    except Exception:
        print(f"Error in set_paper_implementability: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your request."
        )

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
        paper["removedBy"] = user_id_str
        
        insert_result = removed_papers_collection.insert_one(paper)
        if not insert_result.inserted_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to archive paper before deletion"
            )

        delete_result = papers_collection.delete_one({"_id": obj_id})
        if delete_result.deleted_count != 1:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete paper"
            )

        return None

    except HTTPException:
        raise
    except Exception:
        print(f"Error in delete_paper: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your request."
        )

