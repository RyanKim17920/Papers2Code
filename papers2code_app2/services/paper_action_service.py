from ..database import (
    get_papers_collection_async, 
    get_user_actions_collection_async, 
    get_users_collection_async
)
from ..schemas_papers import PaperResponse, PaperActionsSummaryResponse, PaperActionUserDetail
from ..schemas_minimal import UserMinimal
from ..shared import IMPL_STATUS_COMMUNITY_IMPLEMENTABLE, IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE
from .exceptions import PaperNotFoundException, AlreadyVotedException, VoteProcessingException, InvalidActionException

# MongoDB specific imports
from bson import ObjectId # type: ignore
from bson.errors import InvalidId # type: ignore
from pymongo import ReturnDocument # type: ignore
from pymongo.errors import DuplicateKeyError # type: ignore

import logging
from datetime import datetime, timezone


class PaperActionService:
    def __init__(self):
        # Collections will be fetched asynchronously within each method
        self.logger = logging.getLogger(__name__)

    async def record_vote(self, paper_id: str, user_id: str, vote_type: str):
        """
        Records a user\\'s vote (upvote or none) on a paper.
        Returns the updated paper document (raw from DB, before transformation).
        Raises PaperNotFoundException, AlreadyVotedException, VoteProcessingException.
        """
        #self.logger.info(f"Service: Async recording vote type '{vote_type}' for paper_id: {paper_id} by user_id: {user_id}")
        
        papers_collection = await get_papers_collection_async()
        user_actions_collection = await get_user_actions_collection_async()

        try:
            paper_obj_id = ObjectId(paper_id)
            user_obj_id = ObjectId(user_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid ID format for paper_id '{paper_id}' or user_id '{user_id}'.")
            raise PaperNotFoundException("Invalid paper or user ID format.")

        # Check if paper exists
        paper_doc = await papers_collection.find_one({"_id": paper_obj_id})
        if not paper_doc:
            self.logger.warning(f"Service: Paper not found with paper_id: {paper_id}")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found.")

        action_type_db = "upvote"
        existing_action = await user_actions_collection.find_one({
            "userId": user_obj_id,
            "paperId": paper_obj_id,
            "actionType": action_type_db
        })

        updated_paper = None

        if vote_type == "up":
            if existing_action:
                #self.logger.info(f"Service: User {user_id} already upvoted paper {paper_id}. No action taken.")
                return paper_doc 
            
            try:
                await user_actions_collection.insert_one({
                    "userId": user_obj_id,
                    "paperId": paper_obj_id,
                    "actionType": action_type_db,
                    "createdAt": datetime.now(timezone.utc)
                })
                updated_paper = await papers_collection.find_one_and_update(
                    {"_id": paper_obj_id},
                    {"$inc": {"upvoteCount": 1}},
                    return_document=ReturnDocument.AFTER
                )
                #self.logger.info(f"Service: Upvote recorded for paper {paper_id} by user {user_id}. New count: {updated_paper.get('upvoteCount') if updated_paper else 'N/A'}")
            except DuplicateKeyError:
                self.logger.warning(f"Service: DuplicateKeyError while trying to upvote paper {paper_id} by user {user_id}. User might have already upvoted.")
                return paper_doc
            except Exception as e:
                self.logger.exception(f"Service: Error inserting upvote action or updating paper count for paper {paper_id}")
                raise VoteProcessingException(f"Failed to record upvote: {e}")

        elif vote_type == "none":
            if not existing_action:
                #self.logger.info(f"Service: No existing upvote to remove for paper {paper_id} by user {user_id}.")
                return paper_doc

            try:
                delete_result = await user_actions_collection.delete_one({
                    "userId": user_obj_id,
                    "paperId": paper_obj_id,
                    "actionType": action_type_db
                })
                if delete_result.deleted_count > 0:
                    updated_paper = await papers_collection.find_one_and_update(
                        {"_id": paper_obj_id},
                        {"$inc": {"upvoteCount": -1}},
                        return_document=ReturnDocument.AFTER
                    )
                    #self.logger.info(f"Service: Upvote removed for paper {paper_id} by user {user_id}. New count: {updated_paper.get('upvoteCount') if updated_paper else 'N/A'}")
                else:
                    self.logger.warning(f"Service: Tried to remove upvote for {paper_id} by {user_id}, but action was not found for deletion despite initial check.")
                    updated_paper = paper_doc
            except Exception as e:
                self.logger.exception(f"Service: Error deleting upvote action or updating paper count for paper {paper_id}")
                raise VoteProcessingException(f"Failed to remove upvote: {e}")
        else:
            self.logger.error(f"Service: Invalid vote_type '{vote_type}' received.")
            raise InvalidActionException(f"Invalid vote_type: {vote_type}. Must be 'up' or 'none'.")

        if not updated_paper:
            final_check_paper = await papers_collection.find_one({"_id": paper_obj_id})
            if not final_check_paper:
                 raise PaperNotFoundException(f"Paper with ID {paper_id} disappeared during vote processing.")
            return final_check_paper
            
        return updated_paper

    async def get_paper_actions(self, paper_id: str) -> PaperActionsSummaryResponse:
        #self.logger.info(f"Service: Async getting actions for paper_id: {paper_id}")
        
        papers_collection = await get_papers_collection_async()
        user_actions_collection = await get_user_actions_collection_async()
        users_collection = await get_users_collection_async()

        try:
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid paper ID format for paper_id: {paper_id}")
            raise PaperNotFoundException("Invalid paper ID format.") 

        if await papers_collection.count_documents({"_id": paper_obj_id}) == 0:
            self.logger.warning(f"Service: Paper not found with paper_id: {paper_id} when getting actions.")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found.")

        actions_cursor = user_actions_collection.find(
            {"paperId": paper_obj_id}
        )
        actions = await actions_cursor.to_list(length=None) # Asynchronously get all actions
        #self.logger.info(f"Service: Fetched {len(actions)} actions for paper_id={paper_id} from DB")

        if not actions:
            return PaperActionsSummaryResponse(paper_id=paper_id, upvotes=[], saves=[], voted_is_implementable=[], voted_not_implementable=[])

        valid_user_ids = []
        for action in actions:
            user_id_val = action.get('userId')
            if isinstance(user_id_val, ObjectId):
                valid_user_ids.append(user_id_val)
            else:
                self.logger.warning(f"Service: Skipping action with invalid userId type '{type(user_id_val)}' for paper {paper_id}. Action: {action.get('_id')}")
        
        user_ids = list(set(valid_user_ids))

        user_map = {}
        if user_ids:
            user_details_cursor = users_collection.find(
                {"_id": {"$in": user_ids}},
                {"_id": 1, "username": 1, "avatarUrl": 1} 
            )
            user_details_list = await user_details_cursor.to_list(length=None)
            user_map = {str(user['_id']): UserMinimal(
                id=str(user['_id']),
                username=user.get('username', 'Unknown'),
                avatar_url=user.get('avatarUrl'), 
            ) for user in user_details_list}

        upvotes_details = []
        saves_details = [] 
        voted_is_implementable = []
        voted_not_implementable = []
        print(actions)
        for action in actions:
            user_id_obj = action.get('userId')
            if not isinstance(user_id_obj, ObjectId) or str(user_id_obj) not in user_map:
                if isinstance(user_id_obj, ObjectId):
                     self.logger.warning(f"Service: User info not found in map for valid userId {str(user_id_obj)} in paper {paper_id}. This is unexpected.")
                continue 
                
            user_info = user_map.get(str(user_id_obj))
            if not user_info: 
                self.logger.warning(f"Service: User info still not found for userId {str(user_id_obj)} in paper {paper_id} (after map lookup).")
                continue

            action_type = action.get('actionType')
            created_at_raw = action.get('createdAt', datetime.now(timezone.utc))
            
            created_at = None
            if isinstance(created_at_raw, datetime):
                created_at = created_at_raw
            elif isinstance(created_at_raw, str):
                try:
                    created_at = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
                except ValueError:
                    self.logger.warning(f"Service: Could not parse date string '{created_at_raw}' for action {action.get('_id')}. Using current time.")
                    created_at = datetime.now(timezone.utc)
            else: # Fallback if not datetime or string
                self.logger.warning(f"Service: Unexpected type for createdAt '{type(created_at_raw)}' for action {action.get('_id')}. Using current time.")
                created_at = datetime.now(timezone.utc)

            # Correctly unpack user_info into the model's fields
            action_detail = PaperActionUserDetail(
                user_id=str(user_info.id),  # Assuming user_info.id is the correct field for user_id
                username=user_info.username,
                avatar_url=user_info.avatar_url if user_info.avatar_url else None,
                action_type=action_type,
                created_at=created_at.astimezone(timezone.utc) if created_at.tzinfo is None else created_at
            )

            if action_type == "upvote":
                upvotes_details.append(action_detail)
            elif action_type == "save": # Potential future action 
                saves_details.append(action_detail)
            elif action_type == IMPL_STATUS_COMMUNITY_IMPLEMENTABLE:
                voted_is_implementable.append(action_detail)
            elif action_type == IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE:
                voted_not_implementable.append(action_detail)
        print(PaperActionsSummaryResponse(
            paper_id=paper_id,
            upvotes=upvotes_details,
            saves=saves_details, # Ensure this is handled or removed if not applicable
            voted_is_implementable=voted_is_implementable,
            voted_not_implementable=voted_not_implementable
        ))
        return PaperActionsSummaryResponse(
            paper_id=paper_id,
            upvotes=upvotes_details,
            saves=saves_details, # Ensure this is handled or removed if not applicable
            voted_is_implementable=voted_is_implementable,
            voted_not_implementable=voted_not_implementable
        )
