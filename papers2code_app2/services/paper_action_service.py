from ..database import get_papers_collection_sync, get_user_actions_collection_sync, get_users_collection_sync
from ..schemas_papers import PaperResponse, PaperActionsSummaryResponse, PaperActionUserDetail
from ..schemas_minimal import UserMinimal
from ..shared import IMPL_STATUS_COMMUNITY_IMPLEMENTABLE, IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE
from .exceptions import PaperNotFoundException, AlreadyVotedException, VoteProcessingException, InvalidActionException

# MongoDB specific imports
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

import logging
from datetime import datetime, timezone


class PaperActionService:
    def __init__(self):
        self.papers_collection = get_papers_collection_sync()
        self.user_actions_collection = get_user_actions_collection_sync()
        self.users_collection = get_users_collection_sync()
        self.logger = logging.getLogger(__name__)

    def record_vote(self, paper_id: str, user_id: str, vote_type: str):
        """
        Records a user's vote (upvote or none) on a paper.
        Returns the updated paper document (raw from DB, before transformation).
        Raises PaperNotFoundException, AlreadyVotedException, VoteProcessingException.
        """
        self.logger.info(f"Service: Recording vote type '{vote_type}' for paper_id: {paper_id} by user_id: {user_id}")
        try:
            paper_obj_id = ObjectId(paper_id)
            user_obj_id = ObjectId(user_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid ID format for paper_id '{paper_id}' or user_id '{user_id}'.")
            raise PaperNotFoundException("Invalid paper or user ID format.")

        # Check if paper exists
        paper_doc = self.papers_collection.find_one({"_id": paper_obj_id})
        if not paper_doc:
            self.logger.warning(f"Service: Paper not found with paper_id: {paper_id}")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found.")

        action_type_db = "upvote"  # For now, only upvote is handled here
        existing_action = self.user_actions_collection.find_one({
            "userId": user_obj_id,
            "paperId": paper_obj_id,
            "actionType": action_type_db
        })

        updated_paper = None

        if vote_type == "up":
            if existing_action:
                self.logger.info(f"Service: User {user_id} already upvoted paper {paper_id}. No action taken.")
                # Consider if AlreadyVotedException should be raised or if returning current state is preferred.
                # For now, returning current state.
                return paper_doc 
            
            try:
                self.user_actions_collection.insert_one({
                    "userId": user_obj_id,
                    "paperId": paper_obj_id,
                    "actionType": action_type_db,
                    "createdAt": datetime.now(timezone.utc)
                })
                updated_paper = self.papers_collection.find_one_and_update(
                    {"_id": paper_obj_id},
                    {"$inc": {"upvoteCount": 1}},
                    return_document=ReturnDocument.AFTER
                )
                self.logger.info(f"Service: Upvote recorded for paper {paper_id} by user {user_id}. New count: {updated_paper.get('upvoteCount') if updated_paper else 'N/A'}")
            except DuplicateKeyError:
                # This might happen in a race condition if the find_one check passed but insert failed.
                # Or if a unique index on (userId, paperId, actionType) exists.
                self.logger.warning(f"Service: DuplicateKeyError while trying to upvote paper {paper_id} by user {user_id}. User might have already upvoted.")
                # It implies the vote exists, so we can return the current paper doc.
                # Or raise AlreadyVotedException if strictness is required.
                return paper_doc # Or self.papers_collection.find_one({"_id": paper_obj_id})
            except Exception as e:
                self.logger.exception(f"Service: Error inserting upvote action or updating paper count for paper {paper_id}")
                raise VoteProcessingException(f"Failed to record upvote: {e}")

        elif vote_type == "none":
            if not existing_action:
                self.logger.info(f"Service: No existing upvote to remove for paper {paper_id} by user {user_id}.")
                return paper_doc # No action needed, return current paper state

            try:
                delete_result = self.user_actions_collection.delete_one({
                    "userId": user_obj_id,
                    "paperId": paper_obj_id,
                    "actionType": action_type_db
                })
                if delete_result.deleted_count > 0:
                    updated_paper = self.papers_collection.find_one_and_update(
                        {"_id": paper_obj_id},
                        {"$inc": {"upvoteCount": -1}},
                        return_document=ReturnDocument.AFTER
                    )
                    self.logger.info(f"Service: Upvote removed for paper {paper_id} by user {user_id}. New count: {updated_paper.get('upvoteCount') if updated_paper else 'N/A'}")
                else:
                    # Should not happen if existing_action was found, but good to log
                    self.logger.warning(f"Service: Tried to remove upvote for {paper_id} by {user_id}, but action was not found for deletion despite initial check.")
                    updated_paper = paper_doc # Return original paper doc
            except Exception as e:
                self.logger.exception(f"Service: Error deleting upvote action or updating paper count for paper {paper_id}")
                raise VoteProcessingException(f"Failed to remove upvote: {e}")
        else:
            self.logger.error(f"Service: Invalid vote_type '{vote_type}' received.")
            raise InvalidActionException(f"Invalid vote_type: {vote_type}. Must be 'up' or 'none'.")

        if not updated_paper:
             # Fallback if updated_paper wasn't set (e.g. race condition where paper was deleted)
            final_check_paper = self.papers_collection.find_one({"_id": paper_obj_id})
            if not final_check_paper:
                 raise PaperNotFoundException(f"Paper with ID {paper_id} disappeared during vote processing.")
            return final_check_paper
            
        return updated_paper

    def get_paper_actions(self, paper_id: str) -> PaperActionsSummaryResponse:
        self.logger.info(f"Service: Getting actions for paper_id: {paper_id}")
        try:
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid paper ID format for paper_id: {paper_id}")
            # Consistent with record_vote, PaperNotFoundException might be suitable if paper_id is for resource identification
            raise PaperNotFoundException("Invalid paper ID format.") 

        # Check if paper exists (optional, but good for consistency)
        if self.papers_collection.count_documents({"_id": paper_obj_id}) == 0:
            self.logger.warning(f"Service: Paper not found with paper_id: {paper_id} when getting actions.")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found.")

        actions_cursor = self.user_actions_collection.find(
            {"paperId": paper_obj_id}
        )
        actions = list(actions_cursor)
        self.logger.info(f"Service: Fetched {len(actions)} actions for paper_id={paper_id} from DB")

        if not actions:
            return PaperActionsSummaryResponse(paper_id=paper_id, upvotes=[], saves=[], implementability_flags=[])

        # Filter out actions with non-ObjectId userIds before querying users collection
        valid_user_ids = []
        for action in actions:
            user_id_val = action.get('userId')
            if isinstance(user_id_val, ObjectId):
                valid_user_ids.append(user_id_val)
            else:
                self.logger.warning(f"Service: Skipping action with invalid userId type '{type(user_id_val)}' for paper {paper_id}. Action: {action.get('_id')}")
        
        user_ids = list(set(valid_user_ids)) # Unique ObjectIds

        user_map = {}
        if user_ids: # Only query if there are valid user_ids
            user_details_list = list(self.users_collection.find(
                {"_id": {"$in": user_ids}},
                {"_id": 1, "username": 1, "avatarUrl": 1} 
            ))
            user_map = {str(user['_id']): UserMinimal(
                id=str(user['_id']),
                username=user.get('username', 'Unknown'),
                avatar_url=user.get('avatarUrl'), 
            ) for user in user_details_list}

        upvotes_details = []
        saves_details = [] 
        implementability_flags_details = []

        for action in actions:
            user_id_obj = action.get('userId')
            # Ensure userId is an ObjectId and was processed for user_map
            if not isinstance(user_id_obj, ObjectId) or str(user_id_obj) not in user_map:
                if isinstance(user_id_obj, ObjectId): # Log if it was valid ObjectId but not in map (should not happen if user_ids list was correct)
                     self.logger.warning(f"Service: User info not found in map for valid userId {str(user_id_obj)} in paper {paper_id}. This is unexpected.")
                # If not ObjectId, it was already logged.
                continue 
                
            user_info = user_map.get(str(user_id_obj))
            # This check is redundant if the previous `continue` handles it, but kept for safety.
            if not user_info: 
                self.logger.warning(f"Service: User info still not found for userId {str(user_id_obj)} in paper {paper_id} (after map lookup).")
                continue


            action_type = action.get('actionType')
            created_at_raw = action.get('createdAt', datetime.now(timezone.utc))
            
            # Ensure created_at is a datetime object
            created_at = None
            if isinstance(created_at_raw, datetime):
                created_at = created_at_raw
            elif isinstance(created_at_raw, str):
                try:
                    # Handle ISO format strings, common from MongoDB or JSON
                    created_at = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
                except ValueError:
                    self.logger.warning(f"Service: Could not parse date string '{created_at_raw}' for action {action.get('_id')}. Using current time.")
                    created_at = datetime.now(timezone.utc)
            else: # Fallback for other types or None
                self.logger.warning(f"Service: Unexpected type for createdAt '{type(created_at_raw)}' for action {action.get('_id')}. Using current time.")
                created_at = datetime.now(timezone.utc)

            # Ensure created_at is timezone-aware (UTC)
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)


            action_detail = PaperActionUserDetail(
                user_id=str(user_info.id),
                username=user_info.username,
                avatar_url=user_info.avatar_url,
                action_type=str(action_type) if action_type is not None else "unknown", # Ensure action_type is a string
                created_at=created_at
            )
            
            if action_type == 'upvote':
                upvotes_details.append(action_detail)
            elif action_type == IMPL_STATUS_COMMUNITY_IMPLEMENTABLE:
                action_detail.action_type = 'Implementable' # Standardize for response
                implementability_flags_details.append(action_detail)
            elif action_type == IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE:
                action_detail.action_type = 'Not Implementable' # Standardize for response
                implementability_flags_details.append(action_detail)
            # Legacy action types can be mapped here if necessary, e.g.
            # elif action_type in ['confirm_implementable', 'dispute_not_implementable']:
            #     action_detail.action_type = 'Implementable'
            #     implementability_flags_details.append(action_detail)

        self.logger.info(f"Service: Processed actions for paper_id={paper_id}. Upvotes: {len(upvotes_details)}, Flags: {len(implementability_flags_details)}")
        return PaperActionsSummaryResponse(
            paper_id=paper_id,
            upvotes=upvotes_details,
            saves=saves_details, # Stays empty for now
            implementability_flags=implementability_flags_details
        )
