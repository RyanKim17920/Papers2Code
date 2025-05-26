from pydantic import BaseModel, Field, HttpUrl
from pydantic.alias_generators import to_camel
from typing import List, Optional
from datetime import datetime, timezone

# --- Base Models ---
class BasePaper(BaseModel):
    title: str
    authors: List[str]
    publication_date: Optional[datetime] = None
    abstract: Optional[str] = None
    arxiv_id: Optional[str] = None
    doi: Optional[str] = None
    url_pdf: Optional[HttpUrl] = None
    url_abs: Optional[HttpUrl] = None
    tags: Optional[List[str]] = []
    # New fields for advanced filtering
    publication_year: Optional[int] = None
    venue: Optional[str] = None
    citations_count: Optional[int] = None
    # Fields for tracking and moderation
    added_by_username: Optional[str] = None
    added_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_modified_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_approved: bool = False
    approved_by_username: Optional[str] = None
    approval_date: Optional[datetime] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperCreate(BasePaper):
    pass

class PaperUpdate(BaseModel):
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    publication_date: Optional[datetime] = None
    abstract: Optional[str] = None
    arxiv_id: Optional[str] = None
    doi: Optional[str] = None
    url_pdf: Optional[HttpUrl] = None
    url_abs: Optional[HttpUrl] = None
    tags: Optional[List[str]] = None
    publication_year: Optional[int] = None
    venue: Optional[str] = None
    citations_count: Optional[int] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperResponse(BasePaper):
    id: str # MongoDB ObjectId as string

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel,
        "json_encoders": {
            datetime: lambda dt: dt.isoformat(),
        }
    }

# --- Models for Paper Actions (Likes, Saves) ---
class UserActionBase(BaseModel):
    user_id: str
    paper_id: str
    action_type: str # e.g., 'like', 'save'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class UserActionCreate(UserActionBase):
    pass

class UserActionResponse(UserActionBase):
    id: str # MongoDB ObjectId as string

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel,
        "json_encoders": {
            datetime: lambda dt: dt.isoformat(),
        }
    }

# --- Models for Paper Views ---
class PaperViewBase(BaseModel):
    paper_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    viewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperViewCreate(PaperViewBase):
    pass

class PaperViewResponse(PaperViewBase):
    id: str # MongoDB ObjectId as string

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel,
        "json_encoders": {
            datetime: lambda dt: dt.isoformat(),
        }
    }

# --- Advanced Search and Filtering Models ---
class AdvancedPaperFilters(BaseModel):
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    publication_year_min: Optional[int] = None
    publication_year_max: Optional[int] = None
    venue: Optional[str] = None
    arxiv_id: Optional[str] = None
    doi: Optional[str] = None
    tags: Optional[List[str]] = None
    is_approved: Optional[bool] = None
    sort_by: Optional[str] = 'publication_date'
    sort_order: Optional[str] = 'desc'

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaginatedPaperResponse(BaseModel):
    papers: List[PaperResponse]
    total_count: int
    page: int
    page_size: int
    has_more: bool

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperVoteRequest(BaseModel):
    vote_type: str # 'up' or 'none'

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class ArxivPaperRequest(BaseModel):
    arxiv_id: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class FlagActionRequest(BaseModel):
    action: str # e.g., 'confirm', 'dispute', 'retract'

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class BulkActionRequest(BaseModel):
    paper_ids: List[str]
    action: str # e.g., 'approve', 'unapprove'

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class SetImplementabilityRequest(BaseModel):
    status: str # e.g., 'confirmed_non_implementable', 'disputed_non_implementable', 'neutral'
    reason: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class BulkActionResponse(BaseModel):
    successful_ids: List[str]
    failed_ids: List[str]
    message: str

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }

class PaperActionDetail(BaseModel):
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
    paper_id: str
    upvotes: List[PaperActionDetail] = []
    saves: List[PaperActionDetail] = [] # Assuming you might want to track saves too
    implementability_flags: List[PaperActionDetail] = [] # For confirm/dispute non-implementable

    model_config = {
        "populate_by_name": True,
        "alias_generator": to_camel
    }
