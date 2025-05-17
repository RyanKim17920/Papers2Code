from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional

from .shared import config_settings, get_users_collection_sync
from .schemas import User as UserSchema, TokenData

# This would be your actual secret key and algorithm
SECRET_KEY = config_settings.SECRET_KEY
ALGORITHM = config_settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = config_settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_MINUTES = config_settings.REFRESH_TOKEN_EXPIRE_MINUTES

# OAuth2 scheme. tokenUrl is the endpoint that client will use to get the token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token") # Placeholder tokenUrl

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "token_type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "token_type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserSchema:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub") # Assuming username is stored in 'sub' claim
        token_type: str = payload.get("token_type")
        if username is None or token_type != "access":
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    users_collection = get_users_collection_sync()
    user = users_collection.find_one({"username": token_data.username})
    
    if user is None:
        raise credentials_exception
    user_schema = UserSchema(**user)
    return user_schema

async def get_current_user_optional(token: str = Depends(oauth2_scheme)) -> Optional[UserSchema]:
    if not token: # If no token is provided
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("token_type")
        if username is None or token_type != "access":
            return None
        token_data = TokenData(username=username)
    except JWTError:
        return None
    
    users_collection = get_users_collection_sync()
    user = users_collection.find_one({"username": token_data.username})
    
    if user is None:
        return None
    user_schema = UserSchema(**user)
    return user_schema

async def owner_required(current_user: UserSchema = Depends(get_current_user)):
    owner_username = getattr(config_settings, 'OWNER_GITHUB_USERNAME', None)
    if not owner_username or current_user.username != owner_username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an owner")
    return current_user
