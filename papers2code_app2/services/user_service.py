import logging
from typing import Optional
from bson import ObjectId
from datetime import datetime

from ..database import (
    get_users_collection_async,
    get_papers_collection_async,
    get_user_actions_collection_async,
    get_implementation_progress_collection_async
)
from ..schemas.users import UserProfileResponse
from ..schemas.papers import PaperResponse
from ..schemas.minimal import UserSchema, UserUpdateProfile
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

    async def get_user_profile_for_settings(self, user_id: ObjectId) -> UserSchema:
        """Retrieve a user's profile information for settings page."""
        await self._init_collections()
        
        user_doc = await self.users_collection.find_one({"_id": user_id})
        if not user_doc:
            raise UserNotFoundException(f"User with ID '{user_id}' not found.")
        
        return UserSchema(**user_doc)

    async def update_user_profile(self, user_id: ObjectId, profile_update: UserUpdateProfile) -> UserSchema:
        """Update a user's profile information."""
        await self._init_collections()
        
        # Convert the update data to a dict, excluding None values
        # Use model_dump instead of dict for better Pydantic v2 compatibility
        try:
            update_data = profile_update.model_dump(exclude_unset=True, exclude_none=False)  # Include None values to clear fields
        except AttributeError:
            # Fallback for older Pydantic versions
            update_data = profile_update.dict(exclude_unset=True, exclude_none=False)
        
        if not update_data:
            # No updates provided, just return the current user
            user_doc = await self.users_collection.find_one({"_id": user_id})
            if not user_doc:
                raise UserNotFoundException(f"User with ID '{user_id}' not found.")
            return UserSchema(**user_doc)
        
        # Log the original update_data for debugging
        logger.debug(f"Original update_data: {update_data}")
        logger.debug(f"Types: {[(k, type(v)) for k, v in update_data.items()]}")
        
        # Convert ALL values to MongoDB-compatible types
        clean_update_data = {}
        for key, value in update_data.items():
            if value is None:
                clean_update_data[key] = value
            elif key == 'linkedin_profile_url':
                if not value:  # Handle empty/None values
                    clean_update_data[key] = None
                else:
                    # Extract LinkedIn username from URL or convert username to URL
                    linkedin_input = str(value).strip()
                    import re
                    
                    # Pattern for valid LinkedIn username: letters, numbers, and dashes only
                    username_pattern = r'^[a-zA-Z0-9\-]+$'
                    
                    if 'linkedin.com' in linkedin_input.lower():
                        # Extract username from LinkedIn URL and reconstruct canonical URL
                        linkedin_url_pattern = r'(?:https?://)?(?:www\.)?linkedin\.com/in/([a-zA-Z0-9\-]+)/?'
                        match = re.search(linkedin_url_pattern, linkedin_input)
                        
                        if match:
                            username = match.group(1)
                            canonical_url = f"https://linkedin.com/in/{username}"
                            clean_update_data[key] = canonical_url
                            logger.debug(f"Normalized LinkedIn URL: {value} -> {canonical_url}")
                        else:
                            raise ValueError(f"Invalid LinkedIn URL. Please use a valid LinkedIn profile URL or just enter your username.")
                    else:
                        # It's just a username, convert to full URL
                        if re.match(username_pattern, linkedin_input):
                            canonical_url = f"https://linkedin.com/in/{linkedin_input}"
                            clean_update_data[key] = canonical_url
                            logger.debug(f"Converted LinkedIn username to URL: {value} -> {canonical_url}")
                        else:
                            raise ValueError(f"Invalid LinkedIn username. Use only letters, numbers, and dashes (e.g., 'john-smith-123').")
            
            elif key == 'twitter_profile_url':
                if not value:  # Handle empty/None values
                    clean_update_data[key] = None
                else:
                    # Extract Twitter username from URL or convert username to URL
                    twitter_input = str(value).strip()
                    import re
                    
                    # Pattern for valid Twitter username: letters, numbers, and underscores
                    username_pattern = r'^[a-zA-Z0-9_]+$'
                    
                    if 'twitter.com' in twitter_input.lower() or 'x.com' in twitter_input.lower():
                        # Extract username from Twitter/X URL and create canonical URL
                        twitter_url_pattern = r'(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/([a-zA-Z0-9_]+)/?'
                        match = re.search(twitter_url_pattern, twitter_input)
                        
                        if match:
                            username = match.group(1)
                            canonical_url = f"https://twitter.com/{username}"
                            clean_update_data[key] = canonical_url
                            logger.debug(f"Normalized Twitter URL: {value} -> {canonical_url}")
                        else:
                            raise ValueError(f"Invalid Twitter/X URL. Please use a valid profile URL or just enter your username.")
                    else:
                        # Remove @ if present and convert to URL
                        if twitter_input.startswith('@'):
                            twitter_input = twitter_input[1:]
                        
                        if re.match(username_pattern, twitter_input):
                            canonical_url = f"https://twitter.com/{twitter_input}"
                            clean_update_data[key] = canonical_url
                            logger.debug(f"Converted Twitter username to URL: {value} -> {canonical_url}")
                        else:
                            raise ValueError(f"Invalid Twitter username. Use only letters, numbers, and underscores (e.g., 'username_123').")
            
            elif key == 'bluesky_username':
                if not value:  # Handle empty/None values
                    clean_update_data[key] = None
                else:
                    # Extract Bluesky handle from URL or validate standalone handle
                    bluesky_input = str(value).strip()
                    import re
                    
                    if 'bsky.' in bluesky_input.lower():
                        # Extract handle from Bluesky URL or full handle
                        if bluesky_input.startswith('http'):
                            # URL format: https://bsky.app/profile/username.bsky.social
                            bluesky_url_pattern = r'(?:https?://)?(?:www\.)?bsky\.app/profile/([a-zA-Z0-9\-\.]+)/?'
                            match = re.search(bluesky_url_pattern, bluesky_input)
                            if match:
                                handle = match.group(1)
                                clean_update_data[key] = handle
                                logger.debug(f"Extracted Bluesky handle: {value} -> {handle}")
                            else:
                                raise ValueError(f"Invalid Bluesky URL. Please use a valid profile URL or just enter your handle.")
                        else:
                            # It's already a handle like "username.bsky.social"
                            clean_update_data[key] = bluesky_input
                            logger.debug(f"Bluesky handle: {value}")
                    else:
                        # It's just a username, add .bsky.social
                        username_pattern = r'^[a-zA-Z0-9\-]+$'
                        if re.match(username_pattern, bluesky_input):
                            clean_update_data[key] = f"{bluesky_input}.bsky.social"
                            logger.debug(f"Added .bsky.social to username: {value} -> {clean_update_data[key]}")
                        else:
                            raise ValueError(f"Invalid Bluesky username. Use only letters, numbers, and dashes (e.g., 'username').")
            
            elif key == 'huggingface_username':
                if not value:  # Handle empty/None values
                    clean_update_data[key] = None
                else:
                    # Extract Hugging Face username from URL or validate standalone username
                    hf_input = str(value).strip()
                    import re
                
                    # Pattern for valid HF username: letters, numbers, dashes, and underscores
                    username_pattern = r'^[a-zA-Z0-9\-_]+$'
                    
                    if 'huggingface.co' in hf_input.lower():
                        # Extract username from HF URL
                        hf_url_pattern = r'(?:https?://)?(?:www\.)?huggingface\.co/([a-zA-Z0-9\-_]+)/?'
                        match = re.search(hf_url_pattern, hf_input)
                        
                        if match:
                            username = match.group(1)
                            clean_update_data[key] = username
                            logger.debug(f"Extracted Hugging Face username: {value} -> {username}")
                        else:
                            raise ValueError(f"Invalid Hugging Face URL. Please use a valid profile URL or just enter your username.")
                    else:
                        # It's just a username, validate it
                        if re.match(username_pattern, hf_input):
                            clean_update_data[key] = hf_input
                            logger.debug(f"Hugging Face username: {value}")
                        else:
                            raise ValueError(f"Invalid Hugging Face username. Use only letters, numbers, dashes, and underscores (e.g., 'username_123').")
            
            elif key == 'website_url':
                if not value:  # Handle empty/None values
                    clean_update_data[key] = None
                else:
                    # Handle website URL - add https:// if missing, but keep as full URL
                    url_input = str(value).strip()
                    if url_input and not url_input.startswith('http'):
                        clean_update_data[key] = f"https://{url_input}"
                        logger.debug(f"Added https:// to website: {value} -> {clean_update_data[key]}")
                    else:
                        clean_update_data[key] = url_input
            elif hasattr(value, '__str__') and not isinstance(value, (str, int, float, bool, datetime)):
                # Convert any non-primitive type to string
                clean_update_data[key] = str(value)
                logger.debug(f"Converted {key}: {value} -> {clean_update_data[key]}")
            else:
                clean_update_data[key] = value
        
        # Add profile update timestamp
        clean_update_data["profile_updated_at"] = datetime.utcnow()
        
        # Log the final data being sent to MongoDB
        logger.debug(f"Final update_data: {clean_update_data}")
        logger.debug(f"Final types: {[(k, type(v)) for k, v in clean_update_data.items()]}")
        
        # Update the user document
        result = await self.users_collection.update_one(
            {"_id": user_id},
            {"$set": clean_update_data}
        )
        
        if result.matched_count == 0:
            raise UserNotFoundException(f"User with ID '{user_id}' not found.")
        
        # Return the updated user
        updated_user_doc = await self.users_collection.find_one({"_id": user_id})
        return UserSchema(**updated_user_doc)

    async def delete_user_account(self, user_id: ObjectId) -> None:
        """Delete a user's account and all associated data."""
        await self._init_collections()
        
        # Check if user exists
        user_doc = await self.users_collection.find_one({"_id": user_id})
        if not user_doc:
            raise UserNotFoundException(f"User with ID '{user_id}' not found.")
        
        # TODO: In a production system, you might want to:
        # 1. Anonymize user contributions instead of deleting them
        # 2. Remove user from implementation progress contributors
        # 3. Handle foreign key constraints properly
        # 4. Log the deletion for audit purposes
        
        # For now, we'll do a simple deletion
        # Remove user actions
        await self.user_actions_collection.delete_many({"userId": user_id})
        
        # Remove user from implementation progress contributors
        await self.implementation_progress_collection.update_many(
            {"contributors": user_id},
            {"$pull": {"contributors": user_id}}
        )
        
        # Delete the user document
        await self.users_collection.delete_one({"_id": user_id})
        
        logger.info(f"Successfully deleted user account: {user_id}")

# Add to papers2code_app2/dependencies.py:
# from .services.user_service import UserService
# def get_user_service() -> UserService:
#     return UserService()

# Modify papers2code_app2/utils.py to support detail_level="summary"
# in transform_paper_async if it doesn't already.
# This summary level should return fields compatible with UserProfilePaper.
