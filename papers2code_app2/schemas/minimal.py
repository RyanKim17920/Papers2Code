from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

from .db_models import PyObjectId  # ADDED: Import PyObjectId
from .papers import camel_case_config, camel_case_config_with_datetime

# --- Simplified Models for Authentication & User Representation ---

class UserSchema(BaseModel): # Model returned by get_current_user
    """Schema for representing the currently authenticated user, often returned by endpoints like get_current_user."""
    id: Optional[PyObjectId] = Field(None, alias='_id') 
    github_id: Optional[int] = None  # Made optional to support Google OAuth
    google_id: Optional[str] = None  # Added for Google OAuth
    username: str
    email: Optional[str] = None  # Added for Google OAuth users
    name: Optional[str] = None
    avatar_url: Optional[str] = None  # Primary avatar URL (computed based on preference)
    github_avatar_url: Optional[str] = None  # GitHub-specific avatar
    google_avatar_url: Optional[str] = None  # Google-specific avatar
    preferred_avatar_source: Optional[str] = "github"  # "github" or "google"
    bio: Optional[str] = None
    website_url: Optional[str] = None  # Changed to str for flexible URL handling
    twitter_profile_url: Optional[str] = None  # Changed to str for flexible URL handling
    linkedin_profile_url: Optional[str] = None  # Changed to str for flexible URL handling
    bluesky_username: Optional[str] = None  
    huggingface_username: Optional[str] = None  
    is_admin: Optional[bool] = False
    is_owner: Optional[bool] = False
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    profile_updated_at: Optional[datetime] = None
    # Privacy settings
    show_email: Optional[bool] = True  # Whether to publicly display email
    show_github: Optional[bool] = True  # Whether to publicly display GitHub profile link

    model_config = camel_case_config_with_datetime

class UserUpdateProfile(BaseModel):
    """Schema for updating user profile information."""
    name: Optional[str] = None
    bio: Optional[str] = None
    website_url: Optional[str] = None  # Changed to str for flexible URL handling
    twitter_profile_url: Optional[str] = None  # Changed to str for flexible URL handling
    linkedin_profile_url: Optional[str] = None  # Changed to str to allow usernames
    bluesky_username: Optional[str] = None # New
    huggingface_username: Optional[str] = None # New
    # Privacy settings
    show_email: Optional[bool] = None
    show_github: Optional[bool] = None
    # Avatar preference
    preferred_avatar_source: Optional[str] = None  # "github" or "google"
    
    @field_validator('name', 'bio', 'website_url', 'twitter_profile_url', 'linkedin_profile_url', 'bluesky_username', 'huggingface_username', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        """Convert empty strings to None for optional string fields"""
        if v == "":
            return None
        return v
    
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
