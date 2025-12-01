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

# Environment check for secure logging
_is_development = config_settings.ENV_TYPE.lower() not in ("production", "prod")


class AuthService:
    def generate_csrf_token(self) -> str:
        """
        Generate a cryptographically secure CSRF token.
        Uses 32 bytes (256 bits) for enhanced security.
        """
        return secrets.token_hex(32)

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
            
            is_production = config_settings.ENV_TYPE == "production"
            
            # Use helper to set cookies
            self.set_auth_cookies(response, new_access_token)
            return {"access_token": new_access_token, "token_type": "bearer"} # Corresponds to TokenResponse

        except JWTError as jwt_exc:
            raise InvalidTokenException(detail=f"Refresh token validation error: {jwt_exc}")
        # Catching generic Exception here might be too broad for a service, 
        # but if specific database errors are expected, they could be caught and re-raised as ServiceException subtypes.


    def set_auth_cookies(self, response: Response, access_token: str, refresh_token: str = None):
        """Sets authentication cookies (access_token, refresh_token) on the response."""
        is_production = config_settings.ENV_TYPE == "production"
        cookie_secure_flag = True if is_production else False
        cookie_samesite_policy = "none" if is_production else "lax"

        response.set_cookie(
            key=ACCESS_TOKEN_COOKIE_NAME,
            value=access_token,
            httponly=True,
            samesite=cookie_samesite_policy,
            secure=cookie_secure_flag,
            path="/",
            max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

        if refresh_token:
            response.set_cookie(
                key=REFRESH_TOKEN_COOKIE_NAME,
                value=refresh_token,
                httponly=True,
                samesite=cookie_samesite_policy,
                secure=cookie_secure_flag,
                path="/", # Changed to "/" to match clear_auth_cookies and general usage, or keep specific if needed
                max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60
            )

    def clear_auth_cookies(self, response: Response):
        """Clears all authentication-related cookies."""
        is_production = config_settings.ENV_TYPE == "production"
        cookie_secure_flag = True if is_production else False
        cookie_samesite_policy = "none" if is_production else "lax" # Match the samesite policy used when setting

        response.delete_cookie(
            ACCESS_TOKEN_COOKIE_NAME, 
            path="/", 
            secure=cookie_secure_flag, 
            httponly=True, 
            samesite=cookie_samesite_policy
        )
        response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME, 
            path="/", # Updated to match set_auth_cookies
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

    async def link_accounts(self, pending_token: str, response: Response) -> dict:
        """
        Links two accounts (GitHub and Google) based on the pending token.
        """
        try:
            # Decode the pending token
            pending_data = jwt.decode(pending_token, config_settings.FLASK_SECRET_KEY, algorithms=[config_settings.ALGORITHM])
            
            # Check expiration
            exp = pending_data.get("exp")
            if exp is not None and datetime.now(timezone.utc).timestamp() > exp:
                raise InvalidTokenException("Link token expired. Please log in again.")
                
        except JWTError:
            raise InvalidTokenException("Invalid link token")

        users_collection = await get_users_collection_async()
        try:
            existing_user_id = ObjectId(pending_data["existing_user_id"])
        except InvalidId:
             raise InvalidTokenException("Invalid existing user ID in token")

        current_time = datetime.now(timezone.utc)
        
        # Determine which account is being linked
        if "google_id" in pending_data:
            # Linking Google to existing GitHub account
            google_id = pending_data["google_id"]
            google_avatar = pending_data["google_avatar"]
            google_email = pending_data["google_email"]
            
            # Get existing user's avatar
            existing_user = await users_collection.find_one({"_id": existing_user_id})
            if not existing_user:
                raise UserNotFoundException("Existing user not found")

            github_avatar = existing_user.get("githubAvatarUrl")
            
            update_payload = {
                "googleId": google_id,
                "googleAvatarUrl": google_avatar,
                "avatarUrl": github_avatar or google_avatar,  # Default to GitHub avatar
                "preferredAvatarSource": "github",
                "email": google_email,
                "updatedAt": current_time,
                "lastLoginAt": current_time,
            }
            
            user_document = await users_collection.find_one_and_update(
                {"_id": existing_user_id},
                {"$set": update_payload},
                return_document=ReturnDocument.AFTER
            )
            
            # Create tokens
            access_token_payload = {
                "sub": str(user_document["_id"]),
                "username": user_document["username"],
                "googleId": google_id,
            }
        else:
            # Linking GitHub to existing Google account
            github_id = pending_data["github_id"]
            github_avatar = pending_data["github_avatar"]
            github_username = pending_data["github_username"]
            github_token = pending_data["github_token"]
            github_email = pending_data["github_email"]
            github_name = pending_data["github_name"]
            
            # Get existing user's avatar
            existing_user = await users_collection.find_one({"_id": existing_user_id})
            if not existing_user:
                raise UserNotFoundException("Existing user not found")

            google_avatar = existing_user.get("googleAvatarUrl")
            
            update_payload = {
                "githubId": github_id,
                "githubAvatarUrl": github_avatar,
                "githubAccessToken": github_token,
                "avatarUrl": github_avatar or google_avatar,  # Default to GitHub avatar
                "preferredAvatarSource": "github",
                "username": github_username,  # Update to GitHub username
                "name": github_name,
                "email": github_email,
                "updatedAt": current_time,
                "lastLoginAt": current_time,
            }
            
            user_document = await users_collection.find_one_and_update(
                {"_id": existing_user_id},
                {"$set": update_payload},
                return_document=ReturnDocument.AFTER
            )
            
            # Create tokens
            access_token_payload = {
                "sub": str(user_document["_id"]),
                "username": user_document["username"],
                "githubId": github_id,
            }
        
        if not user_document:
             raise DatabaseOperationException("Failed to update user document")

        access_token = create_access_token(data=access_token_payload)
        refresh_token_payload = {"sub": str(user_document["_id"])}
        refresh_token = create_refresh_token(data=refresh_token_payload, expires_delta=timedelta(minutes=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES))
        
        # Set cookies using helper
        self.set_auth_cookies(response, access_token, refresh_token)
        
        return {"detail": "Accounts linked successfully"}


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
            if _is_development:
                logger.warning("Token payload missing sub or username")
            return None  # Or raise specific error if strict validation needed

        users_collection = await get_users_collection_async()  # Changed to async
        try:
            user_obj_id = ObjectId(user_id)
        except InvalidId:
            if _is_development:
                logger.error(f"Invalid ObjectId format for user_id from token.")
            return None # Invalid ID format

        user_doc = await users_collection.find_one({"_id": user_obj_id}) # Changed to async
        if user_doc is None:
            if _is_development:
                logger.warning("User from token not found in DB.")
            return None
        
        # Determine if the user is the owner
        owner_username = config_settings.OWNER_GITHUB_USERNAME
        is_owner = owner_username is not None and user_doc.get("username") == owner_username


        return UserMinimal(
            id=str(user_doc["_id"]),
            username=user_doc["username"],
            name=user_doc.get("name"),
            avatar_url=str(user_doc.get("avatarUrl")) if user_doc.get("avatarUrl") else None,
            is_owner=is_owner,
            is_admin=user_doc.get("is_admin", False)
        )
    except JWTError as e:
        if _is_development:
            logger.error(f"JWTError during optional user retrieval: {e}")
        return None
    except Exception as e: # Catch broader exceptions during DB access or UserMinimal instantiation
        if _is_development:
            logger.error(f"Unexpected error in get_current_user_optional: {e}")
        return None
