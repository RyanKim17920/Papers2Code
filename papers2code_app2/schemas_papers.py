from pydantic import BaseModel, Field, HttpUrl, computed_field
from pydantic.alias_generators import to_camel
from typing import List, Optional
from datetime import datetime

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

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperResponse(BasePaper):
    """Schema for representing a paper when returned by API endpoints, including its ID and user-specific interaction details."""
    id: str
    current_user_implementability_vote: Optional[str] = Field(None, alias="currentUserImplementabilityVote")
    current_user_vote: Optional[str] = Field(None, alias="currentUserVote")

    # Aggregated counts - to be populated by backend logic from user actions
    non_implementable_votes: int = Field(0, alias="nonImplementableVotes")
    dispute_implementable_votes: int = Field(0, alias="disputeImplementableVotes")

    @computed_field(alias="isImplementable")
    @property
    def is_implementable(self) -> bool:
        """Determines if the paper is currently considered implementable based on its status."""
        return self.status != "Not Implementable"

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel,
        "json_encoders": {
            datetime: lambda dt: dt.isoformat(),
        }
    }

class PaginatedPaperResponse(BaseModel):
    """Schema for responses that return a paginated list of papers."""
    papers: List[PaperResponse]
    total_count: int
    page: int
    page_size: int
    has_more: bool

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class SetImplementabilityRequest(BaseModel):
    """Request schema for setting or updating the implementability status of a paper."""
    status: str
    reason: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperActionUserDetail(BaseModel):
    """Schema for detailed information about a user who performed an action on a paper."""
    user_id: str
    username: str
    avatar_url: Optional[HttpUrl] = None
    action_type: str
    created_at: datetime

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel,
        "json_encoders": {
            datetime: lambda dt: dt.isoformat(),
        }
    }

class PaperActionsSummaryResponse(BaseModel):
    """Response schema summarizing various user actions associated with a paper."""
    paper_id: str
    upvotes: List[PaperActionUserDetail] = []
    saves: List[PaperActionUserDetail] = []
    implementability_flags: List[PaperActionUserDetail] = []

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }
