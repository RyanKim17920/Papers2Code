from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
from datetime import datetime

from .schemas_db import PyObjectId # ADDED: Import PyObjectId
from .schemas_papers import camel_case_config, camel_case_config_with_datetime

# --- Simplified Models for Authentication & User Representation ---

class UserSchema(BaseModel): # Model returned by get_current_user
    """Schema for representing the currently authenticated user, often returned by endpoints like get_current_user."""
    id: Optional[PyObjectId] = Field(None, alias='_id') # MODIFIED: Use PyObjectId
    github_id: int
    username: str
    name: Optional[str] = None
    avatar_url: Optional[HttpUrl] = None
    bio: Optional[str] = None
    is_admin: Optional[bool] = False
    is_owner: Optional[bool] = False
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    model_config = camel_case_config_with_datetime

class UserMinimal(BaseModel): # Response model for /me endpoint
    """Minimal user information, suitable for public display or a /me endpoint."""
    id: Optional[PyObjectId] = None # MODIFIED: Use PyObjectId, though often this might be string if already converted
    username: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_owner: Optional[bool] = None
    is_admin: Optional[bool] = None

    model_config = camel_case_config

class Token(BaseModel):
    """Schema for an access token."""
    access_token: str
    token_type: str

    model_config = camel_case_config

class TokenResponse(Token):
    """Response schema for operations returning a token."""
    pass

class CsrfToken(BaseModel):
    """Schema for a CSRF token."""
    csrf_token: str

    model_config = camel_case_config
