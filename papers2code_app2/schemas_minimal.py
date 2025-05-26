from pydantic import BaseModel, Field, HttpUrl
from pydantic.alias_generators import to_camel
from typing import Optional
from datetime import datetime

# --- Simplified Models for Authentication & User Representation ---

class UserSchema(BaseModel): # Model returned by get_current_user
    """Schema for representing the currently authenticated user, often returned by endpoints like get_current_user."""
    id: Optional[str] = Field(None, alias='_id') # MongoDB ObjectId as string
    github_id: int
    username: str
    name: Optional[str] = None
    avatar_url: Optional[HttpUrl] = None
    bio: Optional[str] = None
    is_admin: Optional[bool] = False
    is_owner: Optional[bool] = False
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel,
        "json_encoders": {
            datetime: lambda dt: dt.isoformat(),
        }
    }

class UserMinimal(BaseModel): # Response model for /me endpoint
    """Minimal user information, suitable for public display or a /me endpoint."""
    id: Optional[str] = None
    username: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_owner: Optional[bool] = None
    is_admin: Optional[bool] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class Token(BaseModel):
    """Schema for an access token."""
    access_token: str
    token_type: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class TokenResponse(Token):
    """Response schema for operations returning a token."""
    pass

class CsrfToken(BaseModel):
    """Schema for a CSRF token."""
    csrf_token: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }
