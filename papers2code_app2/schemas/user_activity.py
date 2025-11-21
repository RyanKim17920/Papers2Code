from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum

from .base import PyObjectId, _MongoModel


class LoggedActionTypes(str, Enum):
    """Definitive list of all action types currently logged to the user_actions collection."""
    UPVOTE = "upvote"
    PROFILE_UPDATED = "profile_updated"
    PROJECT_STARTED = "Project Started"
    PROJECT_JOINED = "Project Joined"
    COMMUNITY_IMPLEMENTABLE = "Community Implementable"
    COMMUNITY_NOT_IMPLEMENTABLE = "Community Not Implementable"
    ADMIN_IMPLEMENTABLE = "Admin Implementable"
    ADMIN_NOT_IMPLEMENTABLE = "Admin Not Implementable"
    VOTING = "Voting"


class UserActivity(_MongoModel):
    """Schema for tracking all user activities for analytics and dashboards."""
    user_id: Optional[PyObjectId] = Field(None, alias="userId")  # None for anonymous users
    session_id: Optional[str] = Field(None, alias="sessionId")  # Track anonymous sessions
    activity_type: LoggedActionTypes = Field(..., alias="actionType")
    timestamp: datetime = Field(default_factory=datetime.utcnow, alias="createdAt")
    paper_id: Optional[PyObjectId] = Field(None, alias="paperId")
    implementation_id: Optional[PyObjectId] = Field(None, alias="implementationId")

class PaperView(_MongoModel):
    """Optimized schema for tracking paper views with aggregated counts."""
    
    paper_id: PyObjectId = Field(..., alias="paperId")
    user_id: Optional[PyObjectId] = Field(None, alias="userId")  # None for anonymous
    session_id: Optional[str] = Field(None, alias="sessionId")
    
    # View tracking
    first_viewed: datetime = Field(default_factory=datetime.utcnow, alias="firstViewed")
    last_viewed: datetime = Field(default_factory=datetime.utcnow, alias="lastViewed")
    view_count: int = Field(1, alias="viewCount")
    
    # Duration tracking (in seconds)
    total_time_spent: int = Field(0, alias="totalTimeSpent")
    longest_session: int = Field(0, alias="longestSession")
    
    # Context
    came_from: Optional[str] = Field(None, alias="cameFrom")  # "search", "trending", "direct", etc.


class PaperStats(_MongoModel):
    """Aggregated statistics for papers."""
    
    paper_id: PyObjectId = Field(..., alias="paperId")
    
    # View statistics
    total_views: int = Field(0, alias="totalViews")
    unique_viewers: int = Field(0, alias="uniqueViewers")
    anonymous_views: int = Field(0, alias="anonymousViews")
    
    # Engagement statistics
    total_upvotes: int = Field(0, alias="totalUpVotes")
    total_downvotes: int = Field(0, alias="totalDownVotes")
    net_score: int = Field(0, alias="netScore")
    
    # Implementation statistics
    implementation_starts: int = Field(0, alias="implementationStarts")
    github_repos_added: int = Field(0, alias="githubReposAdded")
    emails_sent: int = Field(0, alias="emailsSent")
    
    # Time-based statistics
    views_last_24h: int = Field(0, alias="viewsLast24h")
    views_last_7d: int = Field(0, alias="viewsLast7d")
    views_last_30d: int = Field(0, alias="viewsLast30d")
    
    # Growth metrics
    daily_view_growth: float = Field(0.0, alias="dailyViewGrowth")
    weekly_view_growth: float = Field(0.0, alias="weeklyViewGrowth")
    
    # Last updated
    last_updated: datetime = Field(default_factory=datetime.utcnow, alias="lastUpdated")


class UserDashboardData(BaseModel):
    """Schema for user dashboard analytics."""
    
    user_id: PyObjectId = Field(..., alias="userId")
    
    # User's paper interactions
    papers_viewed: int = Field(0, alias="papersViewed")
    papers_upvoted: int = Field(0, alias="papersUpvoted")
    papers_implementing: int = Field(0, alias="papersImplementing")
    
    # Recent activity
    recent_views: list[Dict[str, Any]] = Field([], alias="recentViews")
    recent_implementations: list[Dict[str, Any]] = Field([], alias="recentImplementations")
    
    # Preferences (inferred from activity)
    favorite_tags: list[str] = Field([], alias="favoriteTags")
    preferred_venues: list[str] = Field([], alias="preferredVenues")
    
    # Generated timestamp
    generated_at: datetime = Field(default_factory=datetime.utcnow, alias="generatedAt")
