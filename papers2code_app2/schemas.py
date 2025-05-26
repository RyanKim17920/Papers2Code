from pydantic import BaseModel, Field, EmailStr
from pydantic.alias_generators import to_camel
from typing import Literal, Optional, List
from bson import ObjectId
from datetime import datetime

# --- Pydantic ObjectId Handling ---
class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        from pydantic_core import core_schema
        
        def validate_from_str(value: str) -> ObjectId:
            if not ObjectId.is_valid(value):
                raise ValueError("Invalid ObjectId")
            return ObjectId(value)
        
        return core_schema.union_schema([
            core_schema.is_instance_schema(ObjectId),
            core_schema.StringSchema(
                pattern="^[0-9a-fA-F]{24}$",
                to_python=validate_from_str
            ),
        ])
    
    @classmethod
    def __get_pydantic_json_schema__(cls, _core_schema, handler):
        return {'type': 'string'}

# --- Request Models ---
class FlagActionRequest(BaseModel):
    action: Literal['confirm', 'dispute', 'retract']

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class SetImplementabilityRequest(BaseModel):
    status_to_set: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class VoteRequest(BaseModel):
    vote_type: Literal['up', 'none']

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

# --- Response Models ---
class Author(BaseModel):
    name: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class ImplementationStep(BaseModel):
    id: int
    name: str
    description: str
    status: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperResponse(BaseModel):
    id: str
    pwc_url: Optional[str] = None
    arxiv_id: Optional[str] = None
    title: Optional[str] = None
    abstract: Optional[str] = None
    authors: Optional[List[Author]] = None
    url_abs: Optional[str] = None
    url_pdf: Optional[str] = None
    date: Optional[str] = None
    proceeding: Optional[str] = None
    tasks: Optional[List[str]] = None
    is_implementable: Optional[bool] = True
    non_implementable_status: Optional[str] = "implementable"
    non_implementable_votes: Optional[int] = 0
    dispute_implementable_votes: Optional[int] = 0
    current_user_implementability_vote: Optional[Literal['up', 'down', 'none']] = 'none'
    non_implementable_confirmed_by: Optional[str] = None
    implementation_status: Optional[str] = "Not Started"
    implementation_steps: Optional[List[ImplementationStep]] = None
    upvote_count: Optional[int] = 0
    current_user_vote: Optional[Literal['up', 'none']] = 'none'

    model_config = {
        "json_encoders": {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat()
        },
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class UserActionInfo(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperActionsResponse(BaseModel):
    upvotes: List[UserActionInfo]
    voted_is_implementable: List[UserActionInfo]
    voted_not_implementable: List[UserActionInfo]

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperListResponse(BaseModel):
    papers: List[PaperResponse]
    total_papers: int
    page: int
    page_size: int

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

# --- User Model ---
class User(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    github_id: int
    username: str
    avatar_url: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
        "alias_generator": to_camel
    }

class UserResponse(User):
    is_owner: bool

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        alias_generator = to_camel

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenResponse(Token):
    pass

class TokenData(BaseModel):
    username: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class UserLogin(BaseModel):
    username: str
    password: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }
