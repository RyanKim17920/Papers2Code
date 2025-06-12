import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from bson import ObjectId
from ..schemas.users import UserProfileResponse
from ..services.user_service import UserService # To be created
from ..dependencies import get_user_service # To be created
from ..auth import get_current_user_optional
from ..schemas.minimal import UserSchema
from ..error_handlers import handle_service_errors
from ..services.exceptions import UserNotFoundException

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

# Add this router to papers2code_app2/main.py
# from .routers import user_router
# app.include_router(user_router.router)
