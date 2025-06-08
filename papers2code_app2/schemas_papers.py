from pydantic import BaseModel, Field, HttpUrl, computed_field
from typing import List, Optional, Literal, TYPE_CHECKING
from datetime import datetime

from .schemas_db import PyObjectId # ADDED: Import PyObjectId

if TYPE_CHECKING:
    from .schemas_implementation_progress import ImplementationProgress

from .shared import (
    camel_case_config,
    camel_case_config_with_datetime,
    set_implementability_config,
)


# --- Type Definitions for Literal Strings ---
ImplementabilityStatusType = Literal[
    "Voting",
    "Community Not Implementable",
    "Community Implementable",
    "Admin Not Implementable",
    "Admin Implementable"
]

# --- Base Models for Paper Representation ---
class BasePaper(BaseModel):
    """Base schema for core paper attributes, based on the provided dictionary structure."""
    pwc_url: Optional[HttpUrl] = Field(None, alias="pwcUrl")
    arxiv_id: Optional[str] = Field(None, alias="arxivId")
    title: Optional[str] = None
    abstract: Optional[str] = None
    authors: Optional[List[str]] = None
    url_abs: Optional[HttpUrl] = Field(None, alias="urlAbs")
    url_pdf: Optional[HttpUrl] = Field(None, alias="urlPdf")
    publication_date: Optional[datetime] = Field(None, alias="publicationDate")
    venue: Optional[str] = Field(None, alias="proceeding")
    tags: Optional[List[str]] = Field([], alias="tasks")

    # --- Implementability Fields ---
    upvote_count: int = Field(0, alias="upvoteCount")
    status: str = Field("Not Started", alias="status")
    implementability_status: ImplementabilityStatusType = Field("Voting", alias="implementabilityStatus") # 'voting' | 'Community Not Implementable' | 'Community Implementable' | 'Admin Not Implementable' | 'Admin Implementable'

    model_config = camel_case_config

class PaperResponse(BasePaper):
    """Schema for representing a paper when returned by API endpoints, including its ID and user-specific interaction details."""
    id: PyObjectId 
    current_user_implementability_vote: Optional[str] = Field(None, alias="currentUserImplementabilityVote")
    current_user_vote: Optional[str] = Field(None, alias="currentUserVote")

    # Aggregated counts - to be populated by backend logic from user actions
    not_implementable_votes: int = Field(0, alias="nonImplementableVotes")
    implementable_votes: int = Field(0, alias="isImplementableVotes")    # ADDED: Optional field for implementation progress - using forward reference
    implementation_progress: Optional["ImplementationProgress"] = Field(None, alias="implementationProgress")


    @computed_field(alias="isImplementable")
    @property
    def is_implementable(self) -> bool:
        """Determines if the paper is currently considered implementable based on its status."""
        return self.status != "Not Implementable"

    model_config = camel_case_config_with_datetime

class PaginatedPaperResponse(BaseModel):
    """Schema for responses that return a paginated list of papers."""
    papers: List[PaperResponse]
    total_count: int
    page: int
    page_size: int
    has_more: bool

    model_config = camel_case_config

class SetImplementabilityRequest(BaseModel):
    """Request schema for setting or updating the implementability status of a paper."""
    status_to_set: str = Field(..., alias="statusToSet")
    reason: Optional[str] = None

    model_config = set_implementability_config

class PaperActionUserDetail(BaseModel):
    """Schema for detailed information about a user who performed an action on a paper."""
    user_id: PyObjectId 
    username: str
    avatar_url: Optional[HttpUrl] = None
    action_type: str
    created_at: datetime

    model_config = camel_case_config_with_datetime

class PaperActionsSummaryResponse(BaseModel):
    """Response schema summarizing various user actions associated with a paper."""
    paper_id: PyObjectId = Field(..., alias="paperId")
    upvotes: List[PaperActionUserDetail] = Field(default_factory=list, alias="upvotes")
    saves: List[PaperActionUserDetail] = Field(default_factory=list, alias="saves") # Frontend might expect 'saves' or 'savedBy'
    voted_is_implementable: List[PaperActionUserDetail] = Field(default_factory=list, alias="votedIsImplementable")
    voted_not_implementable: List[PaperActionUserDetail] = Field(default_factory=list, alias="votedNotImplementable")
    
    model_config = camel_case_config
