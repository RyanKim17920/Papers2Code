from fastapi import Depends, HTTPException, status, Request
from jose import JWTError, jwt
from datetime import timedelta
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId
import logging

from ..shared import config_settings
from ..database import get_users_collection_async
from ..schemas.minimal import UserSchema
from ..constants import ACCESS_TOKEN_COOKIE_NAME
from .token_utils import create_token

logger = logging.getLogger(__name__)

# This would be your actual secret key and algorithm
SECRET_KEY = config_settings.FLASK_SECRET_KEY  # DO NOT CORRECT THIS IT IS SET AS FLASK SECRET KEY IN .env
ALGORITHM = config_settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = config_settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_MINUTES = config_settings.REFRESH_TOKEN_EXPIRE_MINUTES


async def get_token_from_cookie(request: Request) -> Optional[str]:
    """Retrieve the JWT from the request cookie."""
    return request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    return create_token(
        data,
        "access",
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    return create_token(
        data,
        "refresh",
        expires_delta or timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES),
    )

async def get_current_user(token: Optional[str] = Depends(get_token_from_cookie)) -> Optional[UserSchema]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not SECRET_KEY:
        logger.error("CRITICAL: Authentication secret key (FLASK_SECRET_KEY) is not configured. Authentication cannot proceed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication system is critically misconfigured (missing secret key)."
        )

    if not token:
        logger.warning("get_current_user: No access token found in cookies (expected in '%s'). Raising 401.", ACCESS_TOKEN_COOKIE_NAME)
        raise credentials_exception
    
    logger.debug(f"get_current_user: Attempting to validate token (first 20 chars): {token[:20]}...")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.debug(f"get_current_user: Token payload decoded successfully: {payload}")

        user_id_from_token: Optional[str] = payload.get("sub")
        username_from_token: Optional[str] = payload.get("username") # Often included for quick reference
        token_type: Optional[str] = payload.get("token_type")

        if token_type != "access":
            logger.warning(f"get_current_user: Invalid token type. Expected 'access', got '{token_type}'. Payload: {payload}")
            raise credentials_exception

        if user_id_from_token is None:
            logger.warning(f"get_current_user: Token payload missing 'sub' (user_id). Payload: {payload}")
            raise credentials_exception
        
        # Optionally log username if present, but 'sub' is the critical identifier for DB lookup
        if username_from_token:
            logger.debug(f"get_current_user: Extracted user_id: '{user_id_from_token}', username: '{username_from_token}' from token.")
        else:
            logger.debug(f"get_current_user: Extracted user_id: '{user_id_from_token}' from token (username not in payload).")

    except JWTError as e:
        logger.warning(f"get_current_user: JWTError during token decoding: {str(e)}. Token (first 20 chars): {token[:20]}...")
        raise credentials_exception
    except Exception as e: 
        logger.error(f"get_current_user: Unexpected error during token processing: {str(e)}", exc_info=True)
        raise credentials_exception
    
    users_collection = await get_users_collection_async()
    
    try:
        user_obj_id = ObjectId(user_id_from_token)
    except InvalidId:
        logger.warning(f"get_current_user: Invalid ObjectId format for user_id from token: '{user_id_from_token}'.")
        raise credentials_exception

    user_dict = await users_collection.find_one({"_id": user_obj_id})
    
    if user_dict is None:
        logger.warning(f"get_current_user: User not found in DB for ID '{user_obj_id}' (derived from token 'sub': {user_id_from_token}).")
        raise credentials_exception
    
    # Ensure _id is a string for Pydantic model if it's an ObjectId, though UserSchema expects PyObjectId which handles it.
    # db_id = user_dict.get("_id")
    # if isinstance(db_id, ObjectId):
    #     user_dict["_id"] = str(db_id) # UserSchema's PyObjectId should handle this conversion if alias='_id' is used.

    try:
        # Ensure all required fields for UserSchema are present in user_dict or handled by defaults in UserSchema
        # The previous error was `githubId` missing. Let's log the dict before parsing.
        logger.debug(f"get_current_user: User document found in DB: {user_dict}")
        user = UserSchema(**user_dict)
        logger.info(f"get_current_user: Successfully authenticated user: {user.username} (ID: {user.id}, GitHub ID: {user.github_id})")
    except Exception as e:
        logger.error(f"get_current_user: Error creating UserSchema instance from DB doc. User Dict: {user_dict}. Error: {e}", exc_info=True)
        raise credentials_exception
        
    return user

async def get_current_user_optional(token: Optional[str] = Depends(get_token_from_cookie)) -> Optional[UserSchema]:
    if not token:
        return None
    try:
        user = await get_current_user(token)
        return user
    except HTTPException:
        return None
    except Exception:
        return None

async def get_current_owner(current_user: UserSchema = Depends(get_current_user)) -> UserSchema:
    if not config_settings.OWNER_GITHUB_USERNAME:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OWNER_GITHUB_USERNAME is not configured on the server."
        )
    if current_user.username != config_settings.OWNER_GITHUB_USERNAME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires owner privileges.",
        )
    return current_user
