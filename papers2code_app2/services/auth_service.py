from fastapi import HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from bson import ObjectId
from bson.errors import InvalidId
from ..database import get_users_collection_async, get_user_actions_collection_async # Changed from get_users_collection_sync
from ..auth import create_access_token, SECRET_KEY, ALGORITHM, create_refresh_token # Updated import
from .exceptions import (
    InvalidTokenException,
    UserNotFoundException,
    OAuthException,
    DatabaseOperationException, # New
)
from ..schemas.minimal import UserSchema, UserMinimal, UserUpdateProfile  # Added UserUpdateProfile
from ..shared import config_settings
import httpx # Add httpx import
import uuid # Add uuid import
import secrets # Add import for secrets
from datetime import datetime, timedelta, timezone # Add datetime, timedelta, timezone imports
from pymongo import ReturnDocument # Add pymongo import
import logging # Add logging import
from ..constants import (
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    OAUTH_STATE_COOKIE_NAME,
    CSRF_TOKEN_COOKIE_NAME,
)

logger = logging.getLogger(__name__)


class AuthService:
    def generate_csrf_token(self) -> str:
        return secrets.token_hex(16)

    def get_user_details(self, current_user: UserSchema) -> UserMinimal:
        if not current_user:
            # This check might be redundant if get_current_user already raises
            # but kept for explicitness within the service layer's responsibility.
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        owner_username = config_settings.OWNER_GITHUB_USERNAME
        is_owner = owner_username is not None and current_user.username == owner_username
        
        #logger.info(f"User {current_user.username} is_owner status: {is_owner} (checked in service)")

        user_response_data = UserMinimal(
            id=str(current_user.id),
            username=current_user.username,
            name=current_user.name,
            avatar_url=str(current_user.avatar_url) if current_user.avatar_url else None,
            is_owner=is_owner,
            is_admin=getattr(current_user, 'is_admin', False)  # Safely access is_admin
        )
        return user_response_data

    async def refresh_access_token(self, request: Request, response: Response) -> dict: # Made async
        refresh_token_value = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
        if not refresh_token_value:
            raise InvalidTokenException(detail="Refresh token not found")

        try:
            payload = jwt.decode(refresh_token_value, SECRET_KEY, algorithms=[ALGORITHM])
            user_id_from_token = payload.get("sub")
            if user_id_from_token is None:
                raise InvalidTokenException(detail="User ID (sub) missing from refresh token") # Completed

            users_collection = await get_users_collection_async() # Changed to async
            try:
                user_obj_id = ObjectId(user_id_from_token) # Completed
                user_doc = await users_collection.find_one({"_id": user_obj_id}) # Completed
            except InvalidId:
                raise InvalidTokenException(detail="Invalid User ID format in refresh token") # Completed
            
            if not user_doc:
                raise UserNotFoundException(detail="User from refresh token not found") # Completed

            new_access_token_payload = {
                "sub": str(user_doc["_id"]),
                "username": user_doc["username"],
            }
            new_access_token = create_access_token(data=new_access_token_payload)
            
            response.set_cookie(
                key=ACCESS_TOKEN_COOKIE_NAME,
                value=new_access_token,
                httponly=True,
                samesite="lax",
                max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                path="/",
                secure=True if config_settings.ENV_TYPE == "production" else False
            )
            return {"access_token": new_access_token, "token_type": "bearer"} # Corresponds to TokenResponse

        except JWTError as jwt_exc:
            raise InvalidTokenException(detail=f"Refresh token validation error: {jwt_exc}")
        # Catching generic Exception here might be too broad for a service, 
        # but if specific database errors are expected, they could be caught and re-raised as ServiceException subtypes.

    def clear_auth_cookies(self, response: Response):
        """Clears all authentication-related cookies."""
        cookie_secure_flag = True if config_settings.ENV_TYPE == "production" else False
        cookie_samesite_policy = "lax" # Match the samesite policy used when setting

        response.delete_cookie(
            ACCESS_TOKEN_COOKIE_NAME, 
            path="/", 
            secure=cookie_secure_flag, 
            httponly=True, 
            samesite=cookie_samesite_policy
        )
        response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME, 
            path="/api/auth", # Path where refresh token is set and used
            secure=cookie_secure_flag, 
            httponly=True, 
            samesite=cookie_samesite_policy
        )
        response.delete_cookie(
            CSRF_TOKEN_COOKIE_NAME, 
            path="/", 
            secure=cookie_secure_flag, 
            httponly=False, # CSRF token is not httponly
            samesite=cookie_samesite_policy
        )
        # OAUTH_STATE_COOKIE_NAME is typically cleared specifically in the OAuth flow
        # but can be included here for a more aggressive clear if needed, ensuring path matches.
        # response.delete_cookie(
        #     OAUTH_STATE_COOKIE_NAME,
        #     path="/api/auth/github/callback", # Path where it was set
        #     secure=cookie_secure_flag,
        #     httponly=True,
        #     samesite=cookie_samesite_policy
        # )
        #logger.info("Cleared auth cookies (access, refresh, csrf).")


    async def logout_user(self, request: Request, response: Response) -> dict: # Made async
        access_token_value = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
        
        # Invalidate tokens by clearing cookies
        self.clear_auth_cookies(response) # Use the new centralized method
        
        # Optional: Add token to a denylist if you have one
        # For now, just clearing cookies is the primary mechanism.
        
        if not access_token_value:
            #logger.info("Logout called but no access token cookie was found.")
            # Even if no token, ensure cookies are cleared and return success.
            return {"message": "Logged out successfully, no active session found or cookies already cleared."}

        #logger.info("User logged out successfully. Cookies cleared.")
        return {"message": "Logged out successfully"}

    async def update_user_profile(self, user_id: str, profile_data: UserUpdateProfile) -> UserSchema:
        users_collection = await get_users_collection_async()
        user_actions_collection = await get_user_actions_collection_async()

        try:
            user_obj_id = ObjectId(user_id)
        except InvalidId:
            raise UserNotFoundException("Invalid user ID format.")

        update_fields = profile_data.model_dump(exclude_unset=True)
        
        # Convert HttpUrl fields to string for MongoDB storage if they are present
        for field in ["website_url", "twitter_profile_url", "linkedin_profile_url"]:
            if field in update_fields and update_fields[field] is not None:
                update_fields[field] = str(update_fields[field])

        if not update_fields:
            existing_user_doc = await users_collection.find_one({"_id": user_obj_id})
            if not existing_user_doc:
                raise UserNotFoundException(f"User with ID {user_id} not found.")
            return UserSchema(**existing_user_doc)

        update_fields["profileUpdatedAt"] = datetime.now(timezone.utc)

        try:
            updated_user_doc = await users_collection.find_one_and_update(
                {"_id": user_obj_id},
                {"$set": update_fields},
                return_document=ReturnDocument.AFTER
            )

            if not updated_user_doc:
                raise UserNotFoundException(f"User with ID {user_id} not found during update.")

            # Record user action for profile update
            # For profile_updated, paperId is not relevant, so we can omit it or set to None
            from papers2code_app2.schemas.user_activity import LoggedActionTypes
            await user_actions_collection.insert_one({
                "userId": user_obj_id,
                "actionType": LoggedActionTypes.PROFILE_UPDATED.value,
                "details": {"updated_fields": list(update_fields.keys())}, # Store which fields were updated
                "createdAt": datetime.now(timezone.utc)
            })
            
            #logger.info(f"User profile updated for user_id: {user_id}. Fields: {list(update_fields.keys())}")
            return UserSchema(**updated_user_doc)

        except Exception as e:
            logger.error(f"Error updating user profile for user_id {user_id}: {e}", exc_info=True)
            raise DatabaseOperationException(f"Failed to update user profile: {e}")


# Helper function (can be outside the class or static if preferred)
async def get_current_user_optional(request: Request) -> UserMinimal | None: # Made async
    token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        username: str = payload.get("username")

        if user_id is None or username is None:
            logger.warning(f"Token payload missing sub or username. Payload: {payload}")
            return None  # Or raise specific error if strict validation needed

        users_collection = await get_users_collection_async()  # Changed to async
        try:
            user_obj_id = ObjectId(user_id)
        except InvalidId:
            logger.error(f"Invalid ObjectId format for user_id: {user_id} from token.")
            return None # Invalid ID format

        user_doc = await users_collection.find_one({"_id": user_obj_id}) # Changed to async
        if user_doc is None:
            logger.warning(f"User with ID {user_id} from token not found in DB.")
            return None
        
        # Determine if the user is the owner
        owner_username = config_settings.OWNER_GITHUB_USERNAME
        is_owner = owner_username is not None and user_doc.get("username") == owner_username
        #logger.debug(f"Current user {user_doc.get('username')} is_owner status: {is_owner} (checked in get_current_user_optional)"


        return UserMinimal(
            id=str(user_doc["_id"]),
            username=user_doc["username"],
            name=user_doc.get("name"),
            avatar_url=str(user_doc.get("avatarUrl")) if user_doc.get("avatarUrl") else None,
            is_owner=is_owner,
            is_admin=user_doc.get("is_admin", False)
        )
    except JWTError as e:
        logger.error(f"JWTError during optional user retrieval: {e}")
        return None
    except Exception as e: # Catch broader exceptions during DB access or UserMinimal instantiation
        logger.error(f"Unexpected error in get_current_user_optional: {e}")
        return None
