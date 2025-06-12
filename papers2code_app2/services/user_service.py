
import logging
from typing import Optional
from bson import ObjectId

from ..database import (
    get_users_collection_async,
    get_papers_collection_async,
    get_user_actions_collection_async,
    get_implementation_progress_collection_async
)
from ..schemas.users import UserProfileResponse
from ..schemas.papers import PaperResponse
from ..schemas.minimal import UserSchema
from ..services.exceptions import UserNotFoundException
from ..utils import transform_paper_async # Assuming this can transform a raw paper doc to UserProfilePaper compatible dict

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self):
        self.users_collection = None
        self.papers_collection = None
        self.user_actions_collection = None
        self.implementation_progress_collection = None

    async def _init_collections(self):
        if self.users_collection is None:
            self.users_collection = await get_users_collection_async()
        if self.papers_collection is None:
            self.papers_collection = await get_papers_collection_async()
        if self.user_actions_collection is None:
            self.user_actions_collection = await get_user_actions_collection_async()
        if self.implementation_progress_collection is None:
            self.implementation_progress_collection = await get_implementation_progress_collection_async()

    async def get_user_profile_by_username(self, username: str, requesting_user: Optional[UserSchema] = None) -> UserProfileResponse:
        await self._init_collections()
        
        user_doc = await self.users_collection.find_one({"username": username})
        if not user_doc:
            raise UserNotFoundException(f"User with username '{username}' not found.")

        user_id = user_doc["_id"]
        user_details = UserSchema(**user_doc)

        # Use the requesting user's ID for currentUserVote fields, not the profile owner's ID
        requesting_user_id_str = str(requesting_user.id) if requesting_user and requesting_user.id else None

        # Get upvoted papers
        upvoted_papers_list = []
        upvote_actions = self.user_actions_collection.find({
            "userId": user_id, 
            "actionType": "upvote"
        })
        async for action in upvote_actions:
            paper_doc = await self.papers_collection.find_one({"_id": action["paperId"]})
            if paper_doc:
                # Use full transformation to get all fields needed by frontend PaperCard
                # Pass requesting user's ID to get correct currentUserVote status
                print(paper_doc)  # Debugging line to check paper_doc structure
                transformed_paper_dict = await transform_paper_async(paper_doc, detail_level="full", current_user_id_str=requesting_user_id_str)
                print(transformed_paper_dict)  # Debugging line to check transformed paper dict
                if transformed_paper_dict:
                    # Convert dictionary to PaperResponse object
                    paper_response = PaperResponse(**transformed_paper_dict)
                    upvoted_papers_list.append(paper_response)

        # Get contributed papers (papers where user is in ImplementationProgress.contributors)
        contributed_papers_list = []
        progress_records = self.implementation_progress_collection.find({"contributors": user_id})
        async for progress in progress_records:
            paper_doc = await self.papers_collection.find_one({"_id": progress["paperId"]})
            if paper_doc:
                # Use full transformation to get all fields needed by frontend PaperCard
                # Pass requesting user's ID to get correct currentUserVote status
                transformed_paper_dict = await transform_paper_async(paper_doc, detail_level="full", current_user_id_str=requesting_user_id_str)
                if transformed_paper_dict:
                    # Convert dictionary to PaperResponse object
                    paper_response = PaperResponse(**transformed_paper_dict)
                    contributed_papers_list.append(paper_response)

        return UserProfileResponse(
            user_details=user_details,
            upvoted_papers=upvoted_papers_list,
            contributed_papers=contributed_papers_list
        )

# Add to papers2code_app2/dependencies.py:
# from .services.user_service import UserService
# def get_user_service() -> UserService:
#     return UserService()

# Modify papers2code_app2/utils.py to support detail_level="summary"
# in transform_paper_async if it doesn't already.
# This summary level should return fields compatible with UserProfilePaper.
