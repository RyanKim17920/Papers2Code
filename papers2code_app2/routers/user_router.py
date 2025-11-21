import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from typing import Optional, List
from bson import ObjectId
import jwt
from ..schemas.users import UserProfileResponse
from ..services.user_service import UserService # To be created
from ..dependencies import get_user_service # To be created
from ..auth import get_current_user_optional, get_current_user, get_token_from_cookie
from ..schemas.minimal import UserSchema, UserUpdateProfile
from ..error_handlers import handle_service_errors
from ..services.exceptions import UserNotFoundException
from ..database import get_users_collection_async
from ..auth.token_utils import SECRET_KEY, ALGORITHM

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

@router.get("/{username}/profile", response_model=UserProfileResponse)
@handle_service_errors
async def get_user_profile(
    username: str,
    current_user: Optional[UserSchema] = Depends(get_current_user_optional),
    user_service: UserService = Depends(get_user_service)
):
    """Retrieve a user's profile information, including their upvoted papers and contributed projects."""
    try:
        # The service will determine if the requesting user is the profile owner or an admin
        # for potential private data, though for now, all profile data is public.
        profile_data = await user_service.get_user_profile_by_username(username, current_user)
        return profile_data
    except UserNotFoundException:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    except Exception as e:
        logger.error(f"Error fetching profile for {username}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch user profile.")

@router.put("/profile", response_model=UserSchema)
@handle_service_errors
async def update_user_profile(
    profile_update: UserUpdateProfile,
    current_user: UserSchema = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    """Update the current user's profile information."""
    try:
        updated_user = await user_service.update_user_profile(current_user.id, profile_update)
        print(updated_user)
        return updated_user
    except ValueError as ve:
        # Handle validation errors (like invalid LinkedIn URL format)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))
    except UserNotFoundException:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    except Exception as e:
        logger.error(f"Error updating profile for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user profile.")

@router.delete("/profile", status_code=status.HTTP_204_NO_CONTENT)
@handle_service_errors
async def delete_user_account(
    current_user: UserSchema = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    """Delete the current user's account. This action is irreversible."""
    try:
        await user_service.delete_user_account(current_user.id)
        return None  # 204 No Content
    except UserNotFoundException:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    except Exception as e:
        logger.error(f"Error deleting account for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete user account.")


@router.get("/settings", response_model=UserSchema)
@handle_service_errors
async def get_user_settings(
    current_user: UserSchema = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    """Retrieve the current user's profile information for settings page."""
    try:
        user_settings = await user_service.get_user_profile_for_settings(current_user.id)
        return user_settings
    except UserNotFoundException:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    except Exception as e:
        logger.error(f"Error fetching settings for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch user settings.")

@router.post("/profiles", response_model=List[UserSchema])
@handle_service_errors
async def get_user_profiles_by_ids(
    user_ids: List[str] = Body(..., description="List of user IDs to fetch profiles for"),
    user_service: UserService = Depends(get_user_service)
):
    """Retrieve user profiles by their IDs. Used for displaying contributor information."""
    try:
        if not user_ids:
            return []
        
        # Limit the number of user IDs to prevent abuse
        if len(user_ids) > 50:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Too many user IDs requested (max 50)")
        
        user_profiles = await user_service.get_user_profiles_by_ids(user_ids)
        return user_profiles
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching user profiles for IDs {user_ids}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch user profiles.")

# Add this router to papers2code_app2/main.py
# from .routers import user_router
# app.include_router(user_router.router)
