import logging
from datetime import datetime, timezone

# MongoDB specific imports
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from ..database import get_papers_collection_sync, get_user_actions_collection_sync, get_removed_papers_collection_sync
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
        self.papers_collection = get_papers_collection_sync()
        self.user_actions_collection = get_user_actions_collection_sync()
        self.logger = logging.getLogger(__name__)

    def _recalculate_and_update_community_status(self, paper_doc_for_votes): # Removed paper_id_obj from params
        """
        Recalculates and updates the community-driven implementability_status of a paper 
        and its main 'status' based on its votes and thresholds.
        Requires paper_doc_for_votes to be a valid paper document.
        This function respects admin-set implementability statuses.
        Returns the updated paper document or the original if no changes were made.
        """
        if not paper_doc_for_votes or not isinstance(paper_doc_for_votes, dict) or '_id' not in paper_doc_for_votes:
            self.logger.error(f"Service:_recalculate: Invalid or missing paper_doc_for_votes.")
            # This indicates a programming error in how this internal method is called.
            # Raising an exception is appropriate.
            raise ServiceException("Invalid paper document provided for status recalculation.")

        paper_id_obj = paper_doc_for_votes['_id'] # Extract ObjectId from the provided document
        current_paper_doc = paper_doc_for_votes # Use the provided document directly

        current_db_implementability_status = current_paper_doc.get("implementability_status")
        current_main_status = current_paper_doc.get("status")
        
        admin_override_statuses = [IMPL_STATUS_ADMIN_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]

        update_fields = {}
        new_calculated_community_status = current_db_implementability_status # Start with current

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
                update_fields["implementability_status"] = calculated_status_based_on_votes
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
            update_fields["updated_at"] = datetime.now(timezone.utc)
            result = self.papers_collection.update_one({"_id": paper_id_obj}, {"$set": update_fields})
            if result.matched_count == 0:
                self.logger.error(f"Service:_recalculate: Failed to update paper {paper_id_obj} as it was not found during update.")
                # It's possible the paper was deleted between read and write.
                raise PaperNotFoundException(f"Paper {paper_id_obj} disappeared during status recalculation update.")
            
            self.logger.info(f"Service:_recalculate: Updated paper {paper_id_obj} with fields: {update_fields}")
            # Fetch and return the fully updated document
            updated_doc = self.papers_collection.find_one({"_id": paper_id_obj})
            if not updated_doc:
                self.logger.error(f"Service:_recalculate: Paper {paper_id_obj} not found after update attempt (should not happen if update succeeded).")
                raise PaperNotFoundException(f"Paper {paper_id_obj} could not be retrieved after status update.")
            return updated_doc

        # If no updates were made, return the original document that was passed in
        self.logger.info(f"Service:_recalculate: No status changes for paper {paper_id_obj}.")
        return current_paper_doc

    def flag_paper_implementability(self, paper_id: str, user_id: str, action: str):
        self.logger.info(f"Service: Flagging implementability for paper_id: {paper_id}, user_id: {user_id}, action: {action}")
        
        paper_obj_id = None # Initialize to handle potential error before assignment
        try:
            user_obj_id = ObjectId(user_id)
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid ID format for paper_id '{paper_id}' or user_id '{user_id}'.")
            raise PaperNotFoundException("Invalid paper or user ID format.")

        paper = self.papers_collection.find_one({"_id": paper_obj_id})
        if not paper:
            self.logger.warning(f"Service: Paper not found with paper_id: {paper_id}")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found.")

        admin_override_statuses = [IMPL_STATUS_ADMIN_IMPLEMENTABLE, IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE]
        if paper.get("implementability_status") in admin_override_statuses:
            self.logger.warning(f"Service: Attempt to flag admin-locked paper {paper_id}.")
            raise UserActionException(
                f"Implementability status is locked by admin to '{paper.get('implementability_status')}'. Voting is disabled."
            )

        action_types_for_query = [
            IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, 
            IMPL_STATUS_COMMUNITY_IMPLEMENTABLE
        ]
        current_action_doc = self.user_actions_collection.find_one({
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
        
        self.logger.info(f"Service: Flagging details - paper='{paper_obj_id}', user='{user_obj_id}', requested_action='{action}', current_vote_on_paper='{current_vote_type_internal}'")

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

        # Perform DB operations
        try:
            user_action_insert_result = None # Initialize to store insert result
            if user_action_operation == 'insert':
                user_action_insert_result = self.user_actions_collection.insert_one({
                    "userId": user_obj_id,
                    "paperId": paper_obj_id,  # Ensure correct variable paper_obj_id is used
                    "actionType": new_user_action_type_for_db,
                    "createdAt": datetime.now(timezone.utc)
                })
            elif user_action_operation == 'update':
                self.user_actions_collection.update_one(
                    {"_id": current_action_doc["_id"]},
                    {"$set": {"actionType": new_user_action_type_for_db, "updatedAt": datetime.now(timezone.utc)}}
                )
            elif user_action_operation == 'delete':
                self.user_actions_collection.delete_one({"_id": current_action_doc["_id"]})
            
            updated_paper_doc_after_votes = None
            if paper_vote_update_ops["$inc"]: # Check if there's anything to increment
                updated_paper_doc_after_votes = self.papers_collection.find_one_and_update(
                    {"_id": paper_obj_id, "admin_lock": {"$ne": True}},
                    paper_vote_update_ops,
                    return_document=ReturnDocument.AFTER
                )
                if not updated_paper_doc_after_votes:
                    self.logger.warning(f"Service: Paper {paper_id} (obj_id: {paper_obj_id}) might be admin-locked or was not found during vote update.")
                    # Rollback user action if paper update failed
                    if user_action_operation == 'insert' and user_action_insert_result:
                        self.logger.info(f"Rolling back insert action for user {user_obj_id} on paper {paper_obj_id} due to failed paper update.")
                        self.user_actions_collection.delete_one({"_id": user_action_insert_result.inserted_id})
                    # Consider more specific rollbacks for 'update' and 'delete' if necessary
                    raise UserActionException("Could not update paper vote counts, it might be admin-locked or not found. Your action has been rolled back.")

            self.logger.info(f"Service: Updated vote counts for paper {paper_obj_id}: {paper_vote_update_ops.get('$inc', {})}")

            # Determine the paper document to use for recalculating community status
            paper_to_recalculate = None
            if updated_paper_doc_after_votes:
                paper_to_recalculate = updated_paper_doc_after_votes
            elif paper_vote_update_ops["$inc"]: 
                # This case implies find_one_and_update had $inc ops but returned None, and error wasn't raised above.
                # This should ideally be caught by the 'if not updated_paper_doc_after_votes:' block above.
                # As a fallback, fetch the current paper state.
                self.logger.warning(f"Service: updated_paper_doc_after_votes is None despite $inc ops for paper {paper_obj_id}. Fetching fresh doc.")
                paper_to_recalculate = self.papers_collection.find_one({"_id": paper_obj_id})
            else:
                # No $inc operations, so paper vote counts didn't change via find_one_and_update.
                # Use the paper document fetched at the start of the method.
                paper_to_recalculate = paper
            
            if not paper_to_recalculate:
                # If paper_to_recalculate is still None, it's an issue (e.g. paper deleted mid-operation)
                self.logger.error(f"Service: Critical - paper_to_recalculate is None for paper {paper_obj_id} before status recalculation. Paper might have been deleted.")
                # Attempt to fetch one last time or raise an error.
                paper_to_recalculate = self.papers_collection.find_one({"_id": paper_obj_id})
                if not paper_to_recalculate:
                    raise PaperNotFoundException(f"Paper with ID {paper_id} not found for final status recalculation.")

            final_paper_doc = self._recalculate_and_update_community_status(paper_to_recalculate)
            return final_paper_doc

        except DuplicateKeyError:
            self.logger.error(f"Service: DuplicateKeyError during flag operation for paper {paper_id} by user {user_id}. This indicates a potential race condition or an issue with action tracking logic.", exc_info=True)
            raise UserActionException("There was an issue recording your action due to a conflict. Please try again.")
        except Exception as e:
            self.logger.exception(f"Service: Unexpected error during flag_paper_implementability for paper {paper_id}, user {user_id}")
            raise ServiceException(f"An unexpected error occurred while processing your request: {e}")

    def set_paper_implementability(self, paper_id: str, admin_user_id: str, status_to_set_by_admin: str):
        self.logger.info(f"Service: Setting implementability for paper_id: {paper_id} by admin_user_id: {admin_user_id} to '{status_to_set_by_admin}'")
        try:
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid paper ID format for set_implementability: {paper_id}")
            raise PaperNotFoundException("Invalid paper ID format.")

        paper_to_update = self.papers_collection.find_one({"_id": paper_obj_id})
        if not paper_to_update:
            self.logger.warning(f"Service: Paper not found for set_implementability: {paper_id}")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found.")

        db_update_payload = {"updated_at": datetime.now(timezone.utc)}
        
        valid_admin_settable_statuses = [
            IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE, 
            IMPL_STATUS_ADMIN_IMPLEMENTABLE, 
            IMPL_STATUS_VOTING
        ]
        if status_to_set_by_admin not in valid_admin_settable_statuses:
            self.logger.warning(f"Service: Invalid status value '{status_to_set_by_admin}' for set_implementability paper {paper_id}")
            raise InvalidActionException(f"Invalid status value: {status_to_set_by_admin}. Must be one of {valid_admin_settable_statuses}")

        db_update_payload["implementability_status"] = status_to_set_by_admin
        
        current_main_status = paper_to_update.get("status")
        new_main_status = current_main_status

        if status_to_set_by_admin == IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE:
            if current_main_status != MAIN_STATUS_NOT_IMPLEMENTABLE:
                new_main_status = MAIN_STATUS_NOT_IMPLEMENTABLE
        elif status_to_set_by_admin == IMPL_STATUS_ADMIN_IMPLEMENTABLE or status_to_set_by_admin == IMPL_STATUS_VOTING:
            if current_main_status == MAIN_STATUS_NOT_IMPLEMENTABLE:
                new_main_status = MAIN_STATUS_NOT_STARTED
        
        if new_main_status != current_main_status:
            db_update_payload["status"] = new_main_status
        
        # Only update if there are actual changes to be made to avoid unnecessary writes
        # or if the status is being set to IMPL_STATUS_VOTING (which always triggers recalculation)
        if len(db_update_payload) > 1 or status_to_set_by_admin == IMPL_STATUS_VOTING: # >1 because updated_at is always there
            result = self.papers_collection.update_one(
                {"_id": paper_obj_id},
                {"$set": db_update_payload}
            )
            if not result.matched_count and not result.modified_count:
                 # This means the paper disappeared between find_one and update_one
                 self.logger.error(f"Service: Paper {paper_obj_id} not found during update for set_implementability.") # Corrected variable
                 raise PaperNotFoundException(f"Paper {paper_id} disappeared during update.")
            self.logger.info(f"Service: Updated paper {paper_obj_id} with admin status. Payload: {db_update_payload}") # Corrected variable
        else:
            self.logger.info(f"Service: No change required for paper {paper_obj_id} by admin status set to '{status_to_set_by_admin}', current status is the same.") # Corrected variable

        # If owner reverted to 'voting', recalculate community status and potentially main status again
        # Pass the paper document with the potentially updated 'implementability_status' (set to 'voting')
        # and 'status' (potentially reverted to 'Not Started')
        if status_to_set_by_admin == IMPL_STATUS_VOTING:
            # Fetch the paper again to ensure we have the latest version before recalculation,
            # especially if db_update_payload only contained updated_at.
            paper_after_admin_set = self.papers_collection.find_one({"_id": paper_obj_id}) # Corrected variable
            if not paper_after_admin_set:
                self.logger.error(f"Service: Paper {paper_obj_id} not found before recalculation after admin set to voting.") # Corrected variable
                raise PaperNotFoundException(f"Paper {paper_id} not found before recalculation.")
            self.logger.info(f"Service: Recalculating community status for {paper_obj_id} after admin set to voting.") # Corrected variable
            # Corrected call: _recalculate_and_update_community_status expects the paper document
            self._recalculate_and_update_community_status(paper_doc_for_votes=paper_after_admin_set)

        final_paper_doc = self.papers_collection.find_one({"_id": paper_obj_id}) # Corrected variable
        if not final_paper_doc:
            self.logger.error(f"Service: Paper {paper_obj_id} not found when fetching final state after set_implementability.") # Corrected variable
            raise PaperNotFoundException(f"Paper {paper_id} could not be retrieved after set_implementability operation.")
        return final_paper_doc

    def delete_paper(self, paper_id: str, admin_user_id: str):
        self.logger.info(f"Service: Deleting paper_id: {paper_id} by admin_user_id: {admin_user_id}")
        try:
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid paper ID format for delete_paper: {paper_id}")
            raise PaperNotFoundException("Invalid paper ID format.")

        removed_papers_collection = get_removed_papers_collection_sync() # Get this collection

        paper_to_delete = self.papers_collection.find_one({"_id": paper_obj_id})
        if not paper_to_delete:
            self.logger.warning(f"Service: Paper not found for deletion: {paper_id}")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found for deletion.")

        paper_to_delete["removedAt"] = datetime.now(timezone.utc)
        paper_to_delete["removedBy"] = admin_user_id 
        paper_to_delete["updated_at_before_removal"] = paper_to_delete.get("updated_at", paper_to_delete.get("created_at", datetime.now(timezone.utc)))
        
        # Remove _id before inserting into removed_papers if it causes issues, or ensure it's fine.
        # Typically, it's fine to keep the same _id for archival.

        try:
            insert_result = removed_papers_collection.insert_one(paper_to_delete)
            if not insert_result.inserted_id:
                self.logger.error(f"Service: Failed to archive paper {paper_obj_id} to removed_papers_collection.") # Corrected variable
                raise ServiceException("Failed to archive paper before deletion.")
            self.logger.info(f"Service: Archived paper {paper_obj_id} to removed_papers_collection.")
        except Exception as e:
            self.logger.exception(f"Service: Error archiving paper {paper_obj_id}: {e}")
            raise ServiceException(f"Error archiving paper: {e}")

        try:
            delete_result = self.papers_collection.delete_one({"_id": paper_obj_id})
            if delete_result.deleted_count == 0:
                self.logger.error(f"Service: Failed to delete paper {paper_obj_id} from main collection after archiving. It might have been already deleted.")
                # This is a critical state if insert_one succeeded but delete_one found nothing.
                # However, if it was already deleted by another process, then it's not an error for this flow.
                # For now, we assume it should have been there.
                raise ServiceException("Failed to delete paper after archiving, paper not found in main collection.")
            self.logger.info(f"Service: Deleted paper {paper_obj_id} from main collection.")
        except Exception as e:
            self.logger.exception(f"Service: Error deleting paper {paper_obj_id} from main collection: {e}")
            # Potentially attempt to roll back the archival if deletion fails critically.
            raise ServiceException(f"Error deleting paper from main collection: {e}")
        
        # No document to return for a delete operation, router will return 204 No Content.
        return True # Indicates success
