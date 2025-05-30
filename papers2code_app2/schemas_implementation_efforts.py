from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Literal
from datetime import datetime
from bson import ObjectId

# -----------------------------------------------------------------------------
# Shared helpers & config
# -----------------------------------------------------------------------------
class PyObjectId(ObjectId):
    """ObjectId field that serialises as str and validates input."""

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


class _MongoModel(BaseModel):
    """Base class with Mongo‑friendly config."""

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }


# -----------------------------------------------------------------------------
# Author‑outreach
# -----------------------------------------------------------------------------
class FirstContact(_MongoModel):
    date_initiated: Optional[datetime] = None
    method: Optional[str] = None  # e.g. "Email to first author"
    recipient: Optional[str] = None
    response_deadline: Optional[datetime] = None


class AuthorResponse(_MongoModel):
    date_received: Optional[datetime] = None
    summary: Optional[str] = None
    can_proceed: Optional[bool] = None


class EmailGuidance(_MongoModel):
    subject: str = "Inquiry about code for your paper"
    body: str = "Dear Dr. …"
    notes: str = "Replace placeholders such as {Paper Title}."


class AuthorOutreach(_MongoModel):
    status: Literal[
        "Not Initiated",
        "Guidance Prepared",
        "Contact Initiated - Awaiting Response",
        "Response Received - Approved Proceeding",
        "Response Received - Declined Proceeding",
        "Response Received - Provided Own Code",
        "No Response - Grace Period Ended",
    ] = "Not Initiated"
    first_contact: FirstContact = Field(default_factory=FirstContact)
    author_response: AuthorResponse = Field(default_factory=AuthorResponse)
    email_guidance: EmailGuidance = Field(default_factory=EmailGuidance)


# -----------------------------------------------------------------------------
# Road‑map
# -----------------------------------------------------------------------------
class Component(_MongoModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    description: Optional[str] = None
    category: Literal["core", "addon"] = "core"  # still useful for filtering
    status: Literal["To Do", "In Progress", "Completed", "Blocked", "Skipped"] = "To Do"
    assigned_to: List[PyObjectId] = Field(default_factory=list)
    steps: List[str] = Field(default_factory=list)  # small optional checklist
    notes: Optional[str] = None
    order: int


class Section(_MongoModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    title: str
    description: Optional[str] = None
    order: int
    is_default: bool = False
    components: List[Component] = Field(default_factory=list)


class Roadmap(_MongoModel):
    repository_url: Optional[HttpUrl] = None
    overall_progress: int = Field(default=0, ge=0, le=100)
    sections: List[Section] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# Implementation effort
# -----------------------------------------------------------------------------
class ImplementationEffort(_MongoModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    paper_id: PyObjectId
    status: Literal[
        "Author Outreach Pending",
        "Author Contact Initiated",
        "Roadmap Definition",
        "Implementation Active",
        "Implementation Paused",
        "Review Ready",
        "Completed",
        "Abandoned",
    ] = "Author Outreach Pending"
    initiated_by: PyObjectId
    contributors: List[PyObjectId] = Field(default_factory=list)
    author_outreach: AuthorOutreach = Field(default_factory=AuthorOutreach)
    implementation_roadmap: Roadmap = Field(default_factory=Roadmap)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @classmethod
    def new(cls, paper_id: PyObjectId, user_id: PyObjectId):
        """Factory that pre‑fills contributors and default sections."""
        return cls(
            paper_id=paper_id,
            initiated_by=user_id,
            contributors=[user_id],
            implementation_roadmap=Roadmap(sections=create_default_sections()),
        )


class ImplementationEffortUpdate(_MongoModel):
    status: Optional[ImplementationEffort.model_fields["status"].annotation] = None
    contributors: Optional[List[PyObjectId]] = None
    author_outreach: Optional[AuthorOutreach] = None
    implementation_roadmap: Optional[Roadmap] = None


# -----------------------------------------------------------------------------
# Defaults & utilities
# -----------------------------------------------------------------------------

def create_default_sections() -> List[Section]:
    """Return both Core and Add‑on sections with editable default tasks."""
    core_section = Section(
        title="Core Functionalities",
        description="Bare minimum to reproduce the paper’s main result.",
        order=1,
        is_default=True,
        components=[
            Component(
                name="Quick‑start Environment",
                order=1,
                category="core",
                steps=[
                    "Create requirements.txt or environment.yml",
                    "Add install instructions to README",
                ],
            ),
            Component(
                name="Core Model / Algorithm",
                order=2,
                category="core",
                steps=[
                    "Implement forward pass",
                    "Unit‑test on toy data",
                ],
            ),
            Component(
                name="Minimal Train & Eval",
                order=3,
                category="core",
                steps=[
                    "Run once with default hyper‑params",
                    "Print key metric; compare to paper",
                ],
            ),
        ],
    )

    addon_section = Section(
        title="Add‑on Functionalities",
        description="Nice extras volunteers can add if they have time.",
        order=2,
        is_default=True,
        components=[
            Component(
                name="Small Improvement / Extension",
                order=1,
                category="addon",
                steps=["e.g. extra loss term, minor tweak"],
            ),
            Component(
                name="Tiny Visualization Notebook",
                order=2,
                category="addon",
                steps=["Plot one key figure"],
            ),
            Component(
                name="Pre‑trained Checkpoint",
                order=3,
                category="addon",
                steps=["Save weights", "Upload to repo"],
            ),
        ],
    )

    return [core_section, addon_section]
