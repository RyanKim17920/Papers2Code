from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
from datetime import datetime

from .schemas_db import PyObjectId # ADDED: Import PyObjectId
from .schemas_papers import camel_case_config, camel_case_config_with_datetime

# --- Simplified Models for Authentication & User Representation ---

class UserSchema(BaseModel): # Model returned by get_current_user
    """Schema for representing the currently authenticated user, often returned by endpoints like get_current_user."""
    id: Optional[PyObjectId] = Field(None, alias='_id') 
    github_id: int
    username: str
    name: Optional[str] = None
    avatar_url: Optional[HttpUrl] = None
    bio: Optional[str] = None
    website_url: Optional[HttpUrl] = None
    show_github_profile: Optional[bool] = Field(default=False) # Changed from github_profile_url
    twitter_profile_url: Optional[HttpUrl] = None
    linkedin_profile_url: Optional[HttpUrl] = None
    bluesky_username: Optional[str] = None  # New
    is_admin: Optional[bool] = False
    is_owner: Optional[bool] = False
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    profile_updated_at: Optional[datetime] = None # New

    model_config = camel_case_config_with_datetime

class UserUpdateProfile(BaseModel):
    """Schema for updating user profile information."""
    name: Optional[str] = None
    bio: Optional[str] = None
    website_url: Optional[HttpUrl] = None
    show_github_profile: Optional[bool] = None # Changed from github_profile_url
    twitter_profile_url: Optional[HttpUrl] = None
    linkedin_profile_url: Optional[HttpUrl] = None
    bluesky_username: Optional[str] = None # New

    model_config = camel_case_config

class UserMinimal(BaseModel): # Response model for /me endpoint
    """Minimal user information, suitable for public display or a /me endpoint."""
    id: Optional[PyObjectId] = None 
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
