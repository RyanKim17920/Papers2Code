import logging
from datetime import datetime, timezone

# MongoDB specific imports
from bson import ObjectId # type: ignore
from bson.errors import InvalidId # type: ignore
from pymongo import ReturnDocument # type: ignore
from pymongo.errors import DuplicateKeyError # type: ignore

from ..database import (
    get_papers_collection_async, 
    get_user_actions_collection_async, 
    get_removed_papers_collection_async
)
from ..shared import (
    config_settings,
    IMPL_STATUS_VOTING,
    IMPL_STATUS_COMMUNITY_IMPLEMENTABLE,
    IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE,
    MAIN_STATUS_NOT_IMPLEMENTABLE,
    MAIN_STATUS_NOT_STARTED
)
from .exceptions import PaperNotFoundException, UserActionException, InvalidActionException, ServiceException

class PaperModerationService:
    def __init__(self):
        # Collections will be fetched asynchronously within each method
        self.logger = logging.getLogger(__name__)

    async def _recalculate_and_update_community_status(self, paper_doc_for_votes):
        """
        Recalculates and updates the community-driven implementability_status of a paper 
        and its main 'status' based on its votes and thresholds.
        Requires paper_doc_for_votes to be a valid paper document.
        This function respects admin-set implementability statuses.
        Returns the updated paper document or the original if no changes were made.
        """
        papers_collection = await get_papers_collection_async()

        if not paper_doc_for_votes or not isinstance(paper_doc_for_votes, dict) or '_id' not in paper_doc_for_votes:
            self.logger.error("Service:_recalculate: Invalid or missing paper_doc_for_votes.")
            raise ServiceException("Invalid paper document provided for status recalculation.")

        paper_id_obj = paper_doc_for_votes['_id']
        current_paper_doc = paper_doc_for_votes

        current_db_implementability_status = current_paper_doc.get("implementabilityStatus")
        current_main_status = current_paper_doc.get("status")
        
        admin_override_statuses = [IMPL_STATUS_ADMIN_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]

        update_fields = {}
        new_calculated_community_status = current_db_implementability_status

        if current_db_implementability_status not in admin_override_statuses:
            not_implementable_votes = current_paper_doc.get("nonImplementableVotes", 0)
            is_implementable_votes = current_paper_doc.get("isImplementableVotes", 0)

            calculated_status_based_on_votes = IMPL_STATUS_VOTING 
            if (not_implementable_votes >= config_settings.VOTING.NOT_IMPLEMENTABLE_CONFIRM_THRESHOLD and
               not_implementable_votes > is_implementable_votes):
                calculated_status_based_on_votes = IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE
            elif (is_implementable_votes >= config_settings.VOTING.IMPLEMENTABLE_CONFIRM_THRESHOLD and
                 is_implementable_votes > not_implementable_votes):
                calculated_status_based_on_votes = IMPL_STATUS_COMMUNITY_IMPLEMENTABLE
            
            if current_db_implementability_status != calculated_status_based_on_votes:
                update_fields["implementabilityStatus"] = calculated_status_based_on_votes
                new_calculated_community_status = calculated_status_based_on_votes

        effective_implementability_status = new_calculated_community_status
        new_main_status = current_main_status

        if effective_implementability_status in [IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]:
            if current_main_status != MAIN_STATUS_NOT_IMPLEMENTABLE:
                new_main_status = MAIN_STATUS_NOT_IMPLEMENTABLE
        elif (current_db_implementability_status in [IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE] and
             effective_implementability_status not in [IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]):
            if current_main_status == MAIN_STATUS_NOT_IMPLEMENTABLE:
                new_main_status = MAIN_STATUS_NOT_STARTED 

        if new_main_status != current_main_status:
            update_fields["status"] = new_main_status

        if update_fields:
            update_fields["lastUpdated"] = datetime.now(timezone.utc)
            result = await papers_collection.update_one({"_id": paper_id_obj}, {"$set": update_fields})
            if result.matched_count == 0:
                self.logger.error(f"Service:_recalculate: Failed to update paper {paper_id_obj} as it was not found during update.")
                raise PaperNotFoundException(f"Paper {paper_id_obj} disappeared during status recalculation update.")
            
            #self.logger.info(f"Service:_recalculate: Updated paper {paper_id_obj} with fields: {update_fields}")
            updated_doc = await papers_collection.find_one({"_id": paper_id_obj})
            if not updated_doc:
                self.logger.error(f"Service:_recalculate: Paper {paper_id_obj} not found after update attempt (should not happen if update succeeded).")
                raise PaperNotFoundException(f"Paper {paper_id_obj} could not be retrieved after status update.")
            return updated_doc

        #self.logger.info(f"Service:_recalculate: No status changes for paper {paper_id_obj}.")
        return current_paper_doc

    async def flag_paper_implementability(self, paper_id: str, user_id: str, action: str):
        #self.logger.info(f"Service: Async flagging implementability for paper_id: {paper_id}, user_id: {user_id}, action: {action}")
        
        papers_collection = await get_papers_collection_async()
        user_actions_collection = await get_user_actions_collection_async()

        paper_obj_id = None
        try:
            user_obj_id = ObjectId(user_id)
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid ID format for paper_id '{paper_id}' or user_id '{user_id}'.")
            raise PaperNotFoundException("Invalid paper or user ID format.")

        paper = await papers_collection.find_one({"_id": paper_obj_id})
        if not paper:
            self.logger.warning(f"Service: Paper not found with paper_id: {paper_id}")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found.")

        admin_override_statuses = [IMPL_STATUS_ADMIN_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]
        if paper.get("implementabilityStatus") in admin_override_statuses:
            self.logger.warning(f"Service: Attempt to flag admin-locked paper {paper_id}.")
            raise UserActionException(
                f"Implementability status is locked by admin to '{paper.get('implementabilityStatus')}'. Voting is disabled."
            )

        action_types_for_query = [
            IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, 
            IMPL_STATUS_COMMUNITY_IMPLEMENTABLE
        ]
        current_action_doc = await user_actions_collection.find_one({
            "userId": user_obj_id,
            "paperId": paper_obj_id,
            "actionType": {"$in": action_types_for_query}
        })

        current_vote_type_internal = None 
        if current_action_doc:
            if current_action_doc.get("actionType") == IMPL_STATUS_COMMUNITY_IMPLEMENTABLE:
                current_vote_type_internal = "is_implementable"
            elif current_action_doc.get("actionType") == IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE:
                current_vote_type_internal = "not_implementable"
        
        #self.logger.info(f"Service: Flagging details - paper='{paper_obj_id}', user='{user_obj_id}', requested_action='{action}', current_vote_on_paper='{current_vote_type_internal}'")

        paper_vote_update_ops = {"$inc": {}}
        new_user_action_type_for_db = None
        user_action_operation = None

        if action == 'retract':
            if not current_action_doc:
                raise UserActionException("No existing vote to retract.")
            user_action_operation = 'delete'
            if current_vote_type_internal == 'not_implementable':
                paper_vote_update_ops["$inc"]["nonImplementableVotes"] = -1
            elif current_vote_type_internal == 'is_implementable':
                paper_vote_update_ops["$inc"]["isImplementableVotes"] = -1
        
        elif action == 'confirm': 
            new_user_action_type_for_db = IMPL_STATUS_COMMUNITY_IMPLEMENTABLE
            if current_vote_type_internal == 'is_implementable':
                raise UserActionException("You have already voted this paper as 'Implementable'.")
            
            paper_vote_update_ops["$inc"]["isImplementableVotes"] = 1
            if current_action_doc: 
                user_action_operation = 'update'
                if current_vote_type_internal == 'not_implementable': 
                    paper_vote_update_ops["$inc"]["nonImplementableVotes"] = -1
            else: 
                user_action_operation = 'insert'

        elif action == 'dispute': 
            new_user_action_type_for_db = IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE
            if current_vote_type_internal == 'not_implementable':
                raise UserActionException("You have already voted this paper as 'Not Implementable'.")

            paper_vote_update_ops["$inc"]["nonImplementableVotes"] = 1
            if current_action_doc: 
                user_action_operation = 'update'
                if current_vote_type_internal == 'is_implementable': 
                    paper_vote_update_ops["$inc"]["isImplementableVotes"] = -1
            else: 
                user_action_operation = 'insert'
        else:
            raise InvalidActionException(f"Invalid action type: {action}")

        try:
            if user_action_operation == 'insert':
                await user_actions_collection.insert_one({
                    "userId": user_obj_id,
                    "paperId": paper_obj_id,
                    "actionType": new_user_action_type_for_db,
                    "createdAt": datetime.now(timezone.utc)
                })
            elif user_action_operation == 'update':
                await user_actions_collection.update_one(
                    {"_id": current_action_doc["_id"]},
                    {"$set": {"actionType": new_user_action_type_for_db, "updatedAt": datetime.now(timezone.utc)}}
                )
            elif user_action_operation == 'delete':
                await user_actions_collection.delete_one({"_id": current_action_doc["_id"]})
            
            # Update paper vote counts if there are any operations in $inc
            updated_paper_after_vote_counts = None
            if paper_vote_update_ops["$inc"]: # Check if there's anything to increment
                paper_vote_update_ops["$set"] = {"lastUpdated": datetime.now(timezone.utc)} # Also update timestamp
                updated_paper_after_vote_counts = await papers_collection.find_one_and_update(
                    {"_id": paper_obj_id},
                    paper_vote_update_ops,
                    return_document=ReturnDocument.AFTER
                )
                if not updated_paper_after_vote_counts:
                    self.logger.error(f"Service: Paper {paper_obj_id} not found during vote count update after action {action}.")
                    # This could happen if paper was deleted between initial find and this update
                    raise PaperNotFoundException(f"Paper {paper_id} not found during vote count update.")
                paper_to_recalculate = updated_paper_after_vote_counts
            else: # If no vote counts changed (e.g. retracting a non-existent vote, though caught earlier)
                  # or if the action was invalid (also caught earlier)
                  # We still need the paper document for recalculation if an action was performed.
                  # If an action was performed (insert/update/delete on user_actions), we should use the latest paper doc.
                if user_action_operation: # if any user action was done
                    paper_to_recalculate = await papers_collection.find_one({"_id": paper_obj_id})
                    if not paper_to_recalculate:
                         raise PaperNotFoundException(f"Paper {paper_id} not found before recalculation.")
                else: # No user action, no vote count change, use original paper doc
                    paper_to_recalculate = paper


            if not paper_to_recalculate:
                 self.logger.error(f"Service: paper_to_recalculate is None for paper {paper_obj_id} before calling _recalculate_and_update_community_status. This should not happen.")
                 # Fallback to fetching it again, though this indicates a logic flaw above.
                 paper_to_recalculate = await papers_collection.find_one({"_id": paper_obj_id})
                 if not paper_to_recalculate:
                     raise PaperNotFoundException(f"Paper {paper_id} could not be found before final status recalculation.")


            # Recalculate and update community status based on the new vote counts
            final_updated_paper = await self._recalculate_and_update_community_status(paper_to_recalculate)
            return final_updated_paper

        except DuplicateKeyError:
            self.logger.warning(f"Service: Duplicate key error for user action on paper {paper_id}, user {user_id}. This might indicate a race condition or an issue with action logic.")
            # Depending on the desired behavior, you might re-fetch the paper and return it, or raise a specific error.
            # For now, let's re-raise as a generic ServiceException as it's unexpected with prior checks.
            raise ServiceException("A database conflict occurred while processing your request. Please try again.")
        except Exception as e:
            self.logger.exception(f"Service: Error during DB operation for flag_paper_implementability: {e}")
            # Re-raise as a ServiceException or a more specific one if identifiable
            raise ServiceException(f"Failed to flag paper implementability: {e}")

    async def set_paper_implementability(self, paper_id: str, admin_user_id: str, status_to_set_by_admin: str):
        #self.logger.info(f"Service: Async setting implementability for paper_id: {paper_id} by admin_user_id: {admin_user_id} to status: {status_to_set_by_admin}")
        
        papers_collection = await get_papers_collection_async()
        user_actions_collection = await get_user_actions_collection_async() # For logging admin action

        try:
            paper_obj_id = ObjectId(paper_id)
            admin_obj_id = ObjectId(admin_user_id) # Validate admin_user_id as well
        except InvalidId:
            self.logger.warning(f"Service: Invalid ID format for paper_id '{paper_id}' or admin_user_id '{admin_user_id}'.")
            raise PaperNotFoundException("Invalid paper or admin ID format.")

        valid_admin_statuses = [
            IMPL_STATUS_ADMIN_IMPLEMENTABLE, 
            IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE, 
            IMPL_STATUS_VOTING # Admin can reset to voting
        ]
        if status_to_set_by_admin not in valid_admin_statuses:
            self.logger.error(f"Service: Invalid admin status provided: {status_to_set_by_admin}")
            raise InvalidActionException(f"Invalid status for admin override: {status_to_set_by_admin}")

        update_doc = {
            "$set": {
                "implementabilityStatus": status_to_set_by_admin, # Corrected field name
                "lastUpdated": datetime.now(timezone.utc)
            }
        }
        
        # Determine main 'status' and reset votes based on admin's implementability choice
        if status_to_set_by_admin == IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE:
            update_doc["$set"]["status"] = MAIN_STATUS_NOT_IMPLEMENTABLE
            update_doc["$set"]["isImplementableVotes"] = 0
            update_doc["$set"]["nonImplementableVotes"] = 0
        elif status_to_set_by_admin == IMPL_STATUS_ADMIN_IMPLEMENTABLE:
            update_doc["$set"]["status"] = MAIN_STATUS_NOT_STARTED # Assertively set to Not Started
            update_doc["$set"]["isImplementableVotes"] = 0
            update_doc["$set"]["nonImplementableVotes"] = 0
        elif status_to_set_by_admin == IMPL_STATUS_VOTING:
            # If admin resets to "Voting", the main status should also reflect that 
            # (e.g. "Not Started" if it was "Not Implementable")
            # Vote counts are NOT reset here, allowing recalculation based on existing votes.
            current_paper = await papers_collection.find_one({"_id": paper_obj_id})
            if not current_paper:
                # This should ideally not happen if the paper_obj_id is valid and was checked before,
                # but as a safeguard if this method is called directly with an ID that becomes invalid.
                raise PaperNotFoundException(f"Paper with ID {paper_id} not found when checking status for Voting reset.")
            if current_paper.get("status") == MAIN_STATUS_NOT_IMPLEMENTABLE:
                 update_doc["$set"]["status"] = MAIN_STATUS_NOT_STARTED


        updated_paper = await papers_collection.find_one_and_update(
            {"_id": paper_obj_id},
            update_doc,
            return_document=ReturnDocument.AFTER
        )

        if not updated_paper:
            self.logger.warning(f"Service: Paper not found with paper_id: {paper_id} during admin set operation.")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found.")

        # Log admin action
        try:
            # Remove previous admin implementability settings for this paper by this admin
            await user_actions_collection.delete_many({
                "userId": admin_obj_id,
                "paperId": paper_obj_id,
                "actionType": {
                    "$in": [
                        IMPL_STATUS_ADMIN_IMPLEMENTABLE,
                        IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE,
                        IMPL_STATUS_VOTING,
                        "admin_set_implementability" # Old generic action type
                    ]
                }
            })

            # Log the new admin action with the specific status as actionType
            await user_actions_collection.insert_one({
                "userId": admin_obj_id,
                "paperId": paper_obj_id,
                "actionType": status_to_set_by_admin, # Use the status directly as actionType
                # "details": {"status_set_to": status_to_set_by_admin}, # Removed as actionType is now specific
                "createdAt": datetime.now(timezone.utc)
            })
        except Exception as e:
            self.logger.error(f"Service: Failed to log admin action for set_implementability on paper {paper_id}: {e}", exc_info=True)
            # Non-critical, so we don't re-raise, but good to know.

        #self.logger.info(f"Service: Admin {admin_user_id} successfully set implementability of paper {paper_id} to {status_to_set_by_admin}. New main status: {updated_paper.get('status')}")
        return updated_paper

    async def delete_paper(self, paper_id: str, admin_user_id: str) -> bool:
        #self.logger.info(f"Service: Async deleting paper_id: {paper_id} by admin_user_id: {admin_user_id}")

        papers_collection = await get_papers_collection_async()
        removed_papers_collection = await get_removed_papers_collection_async()
        
        try:
            paper_obj_id = ObjectId(paper_id)
            admin_obj_id = ObjectId(admin_user_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid ID format for paper_id '{paper_id}' or admin_user_id '{admin_user_id}'.")
            raise PaperNotFoundException("Invalid paper or admin ID format.")

        paper_to_delete = await papers_collection.find_one({"_id": paper_obj_id})
        if not paper_to_delete:
            self.logger.warning(f"Service: Paper not found with paper_id: {paper_id} for deletion.")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found for deletion.")

        try:
            # Add to removed_papers collection
            removed_doc = paper_to_delete.copy() # Make a copy
            removed_doc["deleted_at"] = datetime.now(timezone.utc)
            removed_doc["deleted_by"] = admin_obj_id 
            removed_doc["original_id"] = paper_obj_id 
            del removed_doc["_id"] # Remove original _id to allow MongoDB to generate a new one for this collection

            await removed_papers_collection.insert_one(removed_doc)
            
            # Delete from original papers collection
            delete_result = await papers_collection.delete_one({"_id": paper_obj_id})
            
            if delete_result.deleted_count == 0:
                # This is unlikely if find_one succeeded, but possible in a race condition
                self.logger.error(f"Service: Paper {paper_id} was found but then failed to be deleted from 'papers' collection.")
                # Attempt to remove from removed_papers if it was inserted? Or log inconsistency.
                # For now, raise an error.
                raise ServiceException(f"Paper {paper_id} could not be deleted after being archived.")

            # Optionally, delete related user actions (or mark them as related to a deleted paper)
            # For now, let's leave user_actions as they might be useful for audit, but this is a design choice.
            # Example: await user_actions_collection.delete_many({"paperId": paper_obj_id})
            # Or: await user_actions_collection.update_many({"paperId": paper_obj_id}, {"$set": {"paperDeleted": True}})


            #self.logger.info(f"Service: Paper {paper_id} successfully deleted by admin {admin_user_id} and moved to removed_papers.")
            return True

        except Exception as e:
            self.logger.exception(f"Service: Error during paper deletion process for paper {paper_id}: {e}")
            # Re-raise as a ServiceException or a more specific one if identifiable
            raise ServiceException(f"Failed to delete paper: {e}")
