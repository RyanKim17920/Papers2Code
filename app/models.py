from dataclasses import dataclass, field
from typing import List, Optional, Literal
from datetime import datetime

# Note: These models are primarily for type hinting and potential future use (e.g., with Pydantic).
# The current application logic often works directly with dictionaries from MongoDB.

@dataclass
class Author:
    name: str

@dataclass
class ImplementationStep:
    id: int
    name: str
    description: str
    status: Literal['pending', 'in-progress', 'completed', 'skipped']

@dataclass
class Paper:
    id: str # MongoDB ObjectId as string
    pwcUrl: Optional[str] = None
    arxivId: Optional[str] = None
    title: Optional[str] = None
    abstract: Optional[str] = None
    authors: List[Author] = field(default_factory=list)
    urlAbs: Optional[str] = None
    urlPdf: Optional[str] = None
    date: Optional[str] = None # Stored as string after transformation
    proceeding: Optional[str] = None
    tasks: List[str] = field(default_factory=list)
    is_implementable: bool = True # Corresponds to 'is_implementable' in DB
    nonImplementableStatus: Literal['implementable', 'flagged_non_implementable', 'confirmed_non_implementable'] = 'implementable'
    nonImplementableVotes: int = 0
    disputeImplementableVotes: int = 0
    nonImplementableConfirmedBy: Optional[Literal['community', 'owner']] = None
    status: str = "Not Started" # Corresponds to 'status' in DB (overall implementation status)
    implementationSteps: List[ImplementationStep] = field(default_factory=list)
    upvoteCount: int = 0
    # Fields added during transformation, not directly in DB paper doc usually
    currentUserImplementabilityVote: Literal['up', 'down', 'none'] = 'none'
    currentUserVote: Literal['up', 'none'] = 'none'

@dataclass
class User:
    id: str # MongoDB ObjectId as string
    githubId: int
    username: str
    avatarUrl: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None # Note: May not always be provided by GitHub
    isAdmin: bool = False
    isOwner: bool = False
    createdAt: Optional[datetime] = None
    lastLogin: Optional[datetime] = None

@dataclass
class UserAction:
    id: str # MongoDB ObjectId as string
    userId: str # MongoDB ObjectId as string
    paperId: str # MongoDB ObjectId as string
    actionType: Literal['upvote', 'confirm_non_implementable', 'dispute_non_implementable'] # Extend as needed
    createdAt: Optional[datetime] = None

@dataclass
class RemovedPaper(Paper): # Inherits fields from Paper
    original_id: Optional[str] = None # The original _id before removal
    removedAt: Optional[datetime] = None
    removedBy: Optional[dict] = None # Could be {'userId': str, 'username': str}
    original_pwc_url: Optional[str] = None # Backup of pwc_url if it existed