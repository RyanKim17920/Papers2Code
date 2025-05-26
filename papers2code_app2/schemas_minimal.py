from pydantic import BaseModel, Field, HttpUrl
from pydantic.alias_generators import to_camel
from typing import Optional
from datetime import datetime, timezone

# --- Simplified Models for Authentication ---

class UserBase(BaseModel):
    username: str
    name: Optional[str] = None
    avatar_url: Optional[HttpUrl] = None
    bio: Optional[str] = None
    is_admin: Optional[bool] = False
    is_owner: Optional[bool] = False

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class UserCreate(UserBase):
    github_id: int

class UserSchema(UserBase): # Model returned by get_current_user
    id: Optional[str] = Field(None, alias='_id')
    github_id: int
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel,
        "json_encoders": {
            datetime: lambda dt: dt.isoformat(),
        }
    }

class User(UserBase): # Used for DB representation
    id: Optional[str] = Field(None, alias='_id')
    github_id: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class UserMinimal(BaseModel): # Response model for /me endpoint
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
    access_token: str
    token_type: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class TokenResponse(Token):
    pass

class TokenData(BaseModel):
    username: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class CsrfToken(BaseModel):
    csrf_token: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }
