from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field

from .db_models import PyObjectId, _MongoModel
from .shared import camel_case_config

# -----------------------------------------------------------------------------
# Simplified Enums
# -----------------------------------------------------------------------------
class EmailStatus(str, Enum):  
    NOT_SENT = "Not Sent"
    SENT = "Sent"
    RESPONSE_RECEIVED = "Response Received"
    CODE_UPLOADED = "Code Uploaded"
    CODE_NEEDS_REFACTORING = "Code Needs Refactoring"
    REFACTORING_IN_PROGRESS = "Refactoring in Progress"
    REFUSED_TO_UPLOAD = "Refused to Upload"
    NO_RESPONSE = "No Response" 

# -----------------------------------------------------------------------------
# Simplified Implementation Progress
# -----------------------------------------------------------------------------
class ImplementationProgress(_MongoModel):
    # Note: _id will be the paper_id (ObjectId)
    initiated_by: PyObjectId
    contributors: List[PyObjectId] = Field(default_factory=list)
    email_status: EmailStatus = Field(default=EmailStatus.NOT_SENT)
    email_sent_at: Optional[datetime] = None  # When the email was sent (for cooldown)
    github_repo_id: Optional[str] = None  # GitHub repository ID/name
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def new(cls, paper_id: PyObjectId, user_id: PyObjectId) -> 'ImplementationProgress':
        return cls(
            _id=paper_id,  # Use _id directly instead of id
            initiated_by=user_id,
            contributors=[user_id],
            email_status=EmailStatus.NOT_SENT,
        )
    
    model_config = camel_case_config

class ProgressUpdate(BaseModel):  
    email_status: Optional[EmailStatus] = None
    github_repo_id: Optional[str] = None
    model_config = camel_case_config
