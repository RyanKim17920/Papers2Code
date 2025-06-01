from typing import List, Optional, Any
from pydantic import BaseModel, Field, HttpUrl, AnyUrl
from datetime import datetime, timezone
from enum import Enum

from bson import ObjectId
from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    AnyUrl,
    GetCoreSchemaHandler,
    GetJsonSchemaHandler
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema

from .schemas_db import PyObjectId, _MongoModel


# -----------------------------------------------------------------------------
# Enums
# -----------------------------------------------------------------------------
class AuthorOutreachStatus(str, Enum):  
    NOT_INITIATED = "Not Initiated"
    CONTACT_SENT = "Contact Initiated - Awaiting Response"
    RESPONSE_APPROVED = "Response Received - Approved Proceeding"
    RESPONSE_DECLINED = "Response Received - Declined Proceeding"
    RESPONSE_OWN_CODE = "Response Received - Provided Own Code"
    NO_RESPONSE = "No Response - Grace Period Ended"


class ComponentCategory(str, Enum): 
    CORE = "core"
    ADDON = "addon"


class ComponentStatus(str, Enum):  
    TO_DO = "To Do"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    BLOCKED = "Blocked"
    SKIPPED = "Skipped"


class ProgressStatus(str, Enum):
    AUTHOR_OUTREACH_PENDING = "Author Outreach Pending"
    AUTHOR_CONTACT_INITIATED = "Author Contact Initiated"
    ROADMAP_DEFINITION = "Roadmap Definition"
    IMPLEMENTATION_ACTIVE = "Implementation Active"
    IMPLEMENTATION_PAUSED = "Implementation Paused"
    REVIEW_READY = "Review Ready"
    COMPLETED = "Completed"
    ABANDONED = "Abandoned"


# -----------------------------------------------------------------------------
# Author‑outreach sub‑docs (shortened names)
# -----------------------------------------------------------------------------
class ContactLog(BaseModel): 
    date_initiated: Optional[datetime] = None
    method: Optional[str] = None
    recipient: Optional[str] = None
    response_deadline: Optional[datetime] = None


class AuthResponse(BaseModel): 
    date_received: Optional[datetime] = None
    summary: Optional[str] = None
    can_proceed: Optional[bool] = None


class EmailGuide(BaseModel): 
    subject: str = "Inquiry about code for your paper"
    body: str = "Dear Dr. …"
    notes: str = "Replace placeholders such as {Paper Title}."


class AuthorOutreach(BaseModel):  
    status: AuthorOutreachStatus = Field(default=AuthorOutreachStatus.NOT_INITIATED)
    first_contact: ContactLog = Field(default_factory=ContactLog)
    author_response: AuthResponse = Field(default_factory=AuthResponse)
    email_guidance: EmailGuide = Field(default_factory=EmailGuide)


# -----------------------------------------------------------------------------
# Road‑map 
# -----------------------------------------------------------------------------
class Component(_MongoModel):
    description: Optional[str] = None
    category: ComponentCategory = Field(default=ComponentCategory.CORE)
    status: ComponentStatus = Field(default=ComponentStatus.TO_DO)
    steps: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    order: int


class ComponentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ComponentCategory] = None
    status: Optional[ComponentStatus] = None
    steps: Optional[List[str]] = None
    notes: Optional[str] = None
    order: Optional[int] = None
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Section(_MongoModel): 
    title: str
    description: Optional[str] = None
    order: int
    is_default: bool = False
    components: List[Component] = Field(default_factory=list)


class Roadmap(BaseModel):
    repository_url: Optional[AnyUrl] = None
    overall_progress: int = Field(0, ge=0, le=100)
    sections: List[Section] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# Implementation progress
# -----------------------------------------------------------------------------
class ImplementationProgress(_MongoModel):
    paper_id: PyObjectId
    status: ProgressStatus = Field(default=ProgressStatus.AUTHOR_OUTREACH_PENDING)
    initiated_by: PyObjectId
    contributors: List[PyObjectId] = Field(default_factory=list)
    author_outreach: AuthorOutreach = Field(default_factory=AuthorOutreach)
    implementation_roadmap: Roadmap = Field(default_factory=Roadmap)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def new(cls, paper_id: PyObjectId, user_id: PyObjectId) -> 'ImplementationProgress': 
        return cls(
            paper_id=paper_id,
            initiated_by=user_id,
            contributors=[user_id],
            implementation_roadmap=Roadmap(sections=create_default_sections()),
        )


class ProgressUpdate(BaseModel):  
    status: Optional[ProgressStatus] = None
    implementation_roadmap: Optional[Roadmap] = None
    model_config = ConfigDict(extra="forbid")


# -----------------------------------------------------------------------------
# Defaults helper (uses new names)
# -----------------------------------------------------------------------------
def create_default_sections() -> List[Section]:
    core = Section(
        title="Core Functionalities",
        description="Bare minimum to reproduce the paper’s main result.",
        order=1,
        is_default=True,
        components=[
            Component(
                name="Quick‑start Environment",
                order=1,
                steps=[
                    "Create requirements.txt / environment.yml",
                    "Add install instructions to README",
                ],
            ),
            Component(
                name="Core Model / Algorithm",
                order=2,
                steps=["Implement forward pass", "Unit‑test on toy data"],
            ),
            Component(
                name="Minimal Train & Eval",
                order=3,
                steps=["Run once", "Compare metric to paper"],
            ),
        ],
    )

    addon = Section(
        title="Add‑on Functionalities",
        description="Nice extras volunteers can add if they have time.",
        order=2,
        is_default=True,
        components=[
            Component(
                name="Small Improvement / Extension",
                category=ComponentCategory.ADDON,
                order=1,
                steps=["e.g. extra loss term"],
            ),
            Component(
                name="Tiny Visualization Notebook",
                category=ComponentCategory.ADDON,
                order=2,
                steps=["Plot one key figure"],
            ),
            Component(
                name="Pre‑trained Checkpoint",
                category=ComponentCategory.ADDON,
                order=3,
                steps=["Save weights", "Upload to repo"],
            ),
        ],
    )
    return [core, addon]
