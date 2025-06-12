
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional
from datetime import datetime

from .db_models import PyObjectId
from .minimal import UserSchema # For detailed user profile
from .papers import PaperResponse # Use full PaperResponse instead of BasePaper
from .shared import camel_case_config

class UserProfileResponse(BaseModel):
    """Response model for the user profile page."""
    user_details: UserSchema
    upvoted_papers: List[PaperResponse] = Field(default_factory=list)
    contributed_papers: List[PaperResponse] = Field(default_factory=list)

    model_config = camel_case_config
