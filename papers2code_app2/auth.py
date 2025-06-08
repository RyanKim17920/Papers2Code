from fastapi import Depends, HTTPException, status, Request
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId
import logging

from .shared import config_settings
from .database import get_users_collection_async
from .schemas_minimal import UserSchema
from .constants import ACCESS_TOKEN_COOKIE_NAME
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
    
    if not token:
        raise credentials_exception

    try:
        if not SECRET_KEY or not ALGORITHM:
            raise credentials_exception

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        user_id_from_token: Optional[str] = payload.get("sub")
        token_type: Optional[str] = payload.get("token_type")

        if user_id_from_token is None or token_type != "access":
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    except Exception:
        raise credentials_exception
    
    users_collection = await get_users_collection_async()
    
    try:
        user_obj_id = ObjectId(user_id_from_token)
    except InvalidId:
        raise credentials_exception

    user_dict = await users_collection.find_one({"_id": user_obj_id})
    
    if user_dict is None:
        raise credentials_exception
    
    db_id = user_dict.get("_id")
    if isinstance(db_id, ObjectId):
        user_dict["_id"] = str(db_id)

    try:
        user = UserSchema(**user_dict)
    except Exception:
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
