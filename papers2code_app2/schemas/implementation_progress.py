from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from bson import ObjectId

from .db_models import PyObjectId, _MongoModel
from .shared import camel_case_config

# -----------------------------------------------------------------------------
# Update Event Types
# -----------------------------------------------------------------------------
class UpdateEventType(str, Enum):
    """Types of events that can occur in implementation progress timeline."""
    INITIATED = "Initiated"
    CONTRIBUTOR_JOINED = "Contributor Joined"
    EMAIL_SENT = "Email Sent"
    STATUS_CHANGED = "Status Changed"
    GITHUB_REPO_LINKED = "GitHub Repo Linked"
    GITHUB_REPO_UPDATED = "GitHub Repo Updated"
    VALIDATION_STARTED = "Validation Started"
    VALIDATION_COMPLETED = "Validation Completed"

# -----------------------------------------------------------------------------
# Status Enums (for status_changed events)
# -----------------------------------------------------------------------------
class ProgressStatus(str, Enum):
    """Status values for implementation progress."""
    NOT_STARTED = "Not Started"
    STARTED = "Started"
    EMAIL_SENT = "Email Sent"
    OFFICIAL_CODE_POSTED = "Official Code Posted"
    CODE_NEEDS_REFACTORING = "Code Needs Refactoring"
    REFACTORING_STARTED = "Refactoring Started"
    REFACTORING_FINISHED = "Refactoring Finished"
    VALIDATION_IN_PROGRESS = "Validation in Progress"
    VALIDATION_COMPLETED = "Validation Completed"
    NO_CODE_FROM_AUTHOR = "No Code from Author"
    GITHUB_CREATED = "GitHub Created"
    CODE_NEEDED = "Code Needed"
    REFUSED_TO_UPLOAD = "Refused to Upload"
    NO_RESPONSE = "No Response"

# -----------------------------------------------------------------------------
# Update Event Schema
# -----------------------------------------------------------------------------
class ProgressUpdateEvent(BaseModel):
    """Individual update event in the implementation progress timeline."""
    event_type: UpdateEventType
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: Optional[PyObjectId] = None  # User who triggered this event
    details: Optional[Dict[str, Any]] = Field(default_factory=dict)  # Event-specific data
    
    model_config = camel_case_config

# -----------------------------------------------------------------------------
# Implementation Progress Schema
# -----------------------------------------------------------------------------
class ImplementationProgress(_MongoModel):
    """
    Implementation progress tracking with timeline-based updates.
    Note: _id will be the paper_id (ObjectId)
    """
    # Core fields
    initiated_by: PyObjectId
    contributors: List[PyObjectId] = Field(default_factory=list)
    status: ProgressStatus = Field(default=ProgressStatus.STARTED)
    latest_update: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    github_repo_id: Optional[str] = None  # GitHub repository ID/name
    
    # Timeline of all updates
    updates: List[ProgressUpdateEvent] = Field(default_factory=list)
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def new(cls, paper_id: PyObjectId, user_id: PyObjectId) -> 'ImplementationProgress':
        """Create a new implementation progress with initial event."""
        now = datetime.now(timezone.utc)
        initial_event = ProgressUpdateEvent(
            event_type=UpdateEventType.INITIATED,
            timestamp=now,
            user_id=user_id,
            details={}
        )
        return cls(
            _id=paper_id,
            initiated_by=user_id,
            contributors=[user_id],
            status=ProgressStatus.STARTED,
            latest_update=now,
            updates=[initial_event],
            created_at=now,
            updated_at=now,
        )
    
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()},
    )

# -----------------------------------------------------------------------------
# Update Request Schema
# -----------------------------------------------------------------------------
class ProgressUpdateRequest(BaseModel):
    """Request schema for updating implementation progress."""
    status: Optional[ProgressStatus] = None
    github_repo_id: Optional[str] = None
    model_config = camel_case_config
