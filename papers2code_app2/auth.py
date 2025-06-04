from fastapi import Depends, HTTPException, status, Request
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId
import logging

from .shared import config_settings
from .database import get_users_collection_async  # Changed from get_users_collection_sync
from .schemas_minimal import UserSchema

logger = logging.getLogger(__name__)

# This would be your actual secret key and algorithm
SECRET_KEY = config_settings.FLASK_SECRET_KEY  # DO NOT CORRECT THIS IT IS SET AS FLASK SECRET KEY IN .env
ALGORITHM = config_settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = config_settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_MINUTES = config_settings.REFRESH_TOKEN_EXPIRE_MINUTES

ACCESS_TOKEN_COOKIE_NAME = "access_token_cookie"

async def get_token_from_cookie(request: Request) -> Optional[str]:
    #logger.debug(f"get_token_from_cookie: Headers: {request.headers}")
    #logger.debug(f"get_token_from_cookie: All cookies received by server: {request.cookies}")
    token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    #if token:
        # Avoid logging the full token for security, just a confirmation and part of it
    #    logger.debug(f"get_token_from_cookie: Found '{ACCESS_TOKEN_COOKIE_NAME}'. Token starts with: {token[:20]}...")
    #else:
    #    logger.debug(f"get_token_from_cookie: Did not find '{ACCESS_TOKEN_COOKIE_NAME}' in request.cookies.")
    return token

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "token_type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "token_type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: Optional[str] = Depends(get_token_from_cookie)) -> Optional[UserSchema]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    #logger.debug(f"get_current_user: Attempting to get current user. Token received from dependency: {'PRESENT (partial): ' + token[:20] + '...' if token else 'MISSING'}")

    if not token:
        #logger.warning("get_current_user: Token from Depends(get_token_from_cookie) is None or empty. Raising credentials_exception.")
        raise credentials_exception

    try:
        if not SECRET_KEY:
            #logger.debug("CRITICAL: SECRET_KEY is not set in auth.py. Cannot decode JWTs. Raising credentials_exception.")
            raise credentials_exception
        
        if not ALGORITHM:
            #logger.debug("CRITICAL: ALGORITHM is not set in auth.py. Cannot decode JWTs. Raising credentials_exception.")
            raise credentials_exception
            
        #logger.debug(f"get_current_user: Attempting to decode token. SECRET_KEY is {'set' if SECRET_KEY else 'NOT SET'}. ALGORITHM is {ALGORITHM}")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        #logger.debug(f"get_current_user: Token decoded successfully. Payload: {payload}")
        
        user_id_from_token: Optional[str] = payload.get("sub")
        token_type: Optional[str] = payload.get("token_type")

        if user_id_from_token is None:
            #logger.debug(f"get_current_user: 'sub' (user_id) is missing in token payload. Payload: {payload}. Raising credentials_exception.")
            raise credentials_exception
        if token_type != "access":
            #logger.debug(f"get_current_user: token_type is not 'access'. Actual type: {token_type}. Payload: {payload}. Raising credentials_exception.")
            raise credentials_exception
            
    except JWTError:
        #logger.debug(f"get_current_user: JWTError during token decoding: {e}. Type: {type(e)}. Raising credentials_exception.")
        raise credentials_exception
    except Exception:
        #logger.debug(f"get_current_user: Unexpected error during token processing or initial checks: {e}. Type: {type(e)}. Raising credentials_exception.")
        raise credentials_exception
    
    #logger.debug(f"get_current_user: Token validated. User ID from sub: {user_id_from_token}")
    users_collection = await get_users_collection_async() # Changed to async and await
    
    try:
        user_obj_id = ObjectId(user_id_from_token)
    except InvalidId:
        #logger.debug(f"get_current_user: Invalid ObjectId format for user_id '{user_id_from_token}' from token. Raising credentials_exception.")
        raise credentials_exception

    user_dict = await users_collection.find_one({"_id": user_obj_id}) # Added await
    
    if user_dict is None:
        #logger.debug(f"User with ID '{user_id_from_token}' not found in database. Raising credentials_exception.")
        raise credentials_exception
    
    #logger.debug(f"User with ID '{user_id_from_token}' found in database. User data before ObjectId conversion for UserSchema: {user_dict.get('_id')}")
    
    db_id = user_dict.get("_id")
    if isinstance(db_id, ObjectId):
        user_dict["_id"] = str(db_id)

    try:
        user = UserSchema(**user_dict)
        #logger.debug(f"UserSchema object created successfully for user ID '{user_id_from_token}'. User object: {user}")
    except Exception:
        #logger.debug(f"Error creating UserSchema for user ID '{user_id_from_token}'. Error: {e}. User dict: {user_dict}. Raising credentials_exception.")
        raise credentials_exception
        
    return user

async def get_current_user_optional(token: Optional[str] = Depends(get_token_from_cookie)) -> Optional[UserSchema]:
    if not token:
        #logger.debug("get_current_user_optional: No token provided.")
        return None
    try:
        user = await get_current_user(token)
        #logger.debug(f"get_current_user_optional: User found for token. User: {user.username if user else 'None'}")
        return user
    except HTTPException:
        #logger.debug(f"get_current_user_optional: HTTPException caught ({e.status_code}: {e.detail}). Returning None.")
        return None
    except Exception:
        #logger.debug(f"get_current_user_optional: Unexpected error: {e}. Returning None.")
        return None

async def get_current_owner(current_user: UserSchema = Depends(get_current_user)) -> UserSchema:
    #logger.info(f"get_current_owner called. Current user: {current_user.username}, Expected owner: {config_settings.OWNER_GITHUB_USERNAME}")
    if not config_settings.OWNER_GITHUB_USERNAME:
        #logger.error("OWNER_GITHUB_USERNAME is not configured on the server.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OWNER_GITHUB_USERNAME is not configured on the server."
        )
    if current_user.username != config_settings.OWNER_GITHUB_USERNAME:
        #logger.warning(f"User {current_user.username} is not the owner.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires owner privileges."
        )
    #logger.info(f"User {current_user.username} is confirmed as owner.")
    return current_user
