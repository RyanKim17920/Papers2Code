from pydantic import BaseModel, Field, EmailStr
from typing import Literal, Optional, List
from bson import ObjectId # Import ObjectId
from datetime import datetime

# --- Pydantic ObjectId Handling ---
# Pydantic doesn't have a native ObjectId type, so we create a custom one.
# This allows validation and serialization of MongoDB ObjectIds.
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

# --- Request Models ---
class FlagActionRequest(BaseModel):
    action: Literal['confirm', 'dispute', 'retract']

class SetImplementabilityRequest(BaseModel):
    statusToSet: str # Example values: 'confirmed_implementable_db', 'confirmed_non_implementable_db', 'voting'

class VoteRequest(BaseModel):
    voteType: Literal['up', 'none']

# --- Response Models (Mirrors transform_paper output structure) ---
# Define fields based on what `transform_paper` actually returns and what the client expects.
# This is a simplified example; you'll need to expand it based on your `Paper` model.
class PaperResponse(BaseModel):
    id: str # MongoDB ObjectId as string
    title: Optional[str] = None
    # Add other fields from your Paper model that are sent to the client
    # e.g., authors, abstract, url_pdf, is_implementable, nonImplementableStatus, etc.
    is_implementable: Optional[bool] = None
    nonImplementableStatus: Optional[str] = None
    nonImplementableVotes: Optional[int] = 0
    disputeImplementableVotes: Optional[int] = 0
    nonImplementableFlaggedBy: Optional[PyObjectId] = None # Or str if you always convert
    nonImplementableConfirmedBy: Optional[str] = None
    status: Optional[str] = None # Display status
    # ... other fields from transform_paper

    class Config:
        json_encoders = {
            ObjectId: str, # Ensure ObjectIds are serialized as strings
            datetime: lambda dt: dt.isoformat() # Ensure datetimes are ISO strings
        }
        # If you use PyObjectId directly in your model fields (e.g., nonImplementableFlaggedBy: PyObjectId)
        # and want to allow assignment from string in request bodies or when creating model instances:
        # arbitrary_types_allowed = True 

# New models for get_paper_actions response
class UserActionInfo(BaseModel):
    id: str
    username: str
    avatarUrl: Optional[str] = None

class PaperActionsResponse(BaseModel):
    upvotes: List[UserActionInfo]
    votedIsImplementable: List[UserActionInfo]
    votedNotImplementable: List[UserActionInfo]

class PaperListResponse(BaseModel):
    papers: List[PaperResponse]
    total_papers: int
    page: int
    page_size: int

# --- User Model (for dependency injection, placeholder) ---
class User(BaseModel): # Existing User model, ensure it has all necessary fields from GitHub + DB
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    githubId: int # Changed from Optional[int] to int, as it's a primary identifier from GitHub
    username: str
    avatarUrl: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    lastLogin: Optional[datetime] = None
    createdAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True # For PyObjectId
        json_encoders = {ObjectId: str} # ObjectId is now defined

class UserResponse(User): # Extends User, adds isOwner
    isOwner: bool

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenResponse(Token): # Added to explicitly define the response for /refresh_token
    pass

class TokenData(BaseModel):
    username: Optional[str] = None

class UserCreate(BaseModel): # For potential future local registration
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel): # For potential future local login
    username: str # or email
    password: str

