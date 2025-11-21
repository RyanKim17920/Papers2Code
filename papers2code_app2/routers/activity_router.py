from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..dependencies import get_activity_tracking_service
from ..schemas.user_activity import LoggedActionTypes
from ..services.activity_tracking_service import ActivityTrackingService
from ..schemas.minimal import UserSchema

router = APIRouter(prefix="/activity", tags=["activity"])


class TrackViewRequest(BaseModel):
    """Request model for tracking paper views."""
    paper_id: str = Field(..., alias="paperId")
    came_from: Optional[str] = Field(None, alias="cameFrom")


@router.post("/paper-view")
async def track_paper_view(
    request: TrackViewRequest,
    req: Request,
    current_user: Optional[UserSchema] = Depends(get_current_user),
    activity_service: ActivityTrackingService = Depends(get_activity_tracking_service)
) -> Dict[str, Any]:
    """Track a paper view."""
    
    user_id = str(current_user.id) if current_user else None
    
    try:
        result = await activity_service.track_paper_view(
            user_id=user_id,
            paper_id=request.paper_id,
            metadata={"came_from": request.came_from}
        )
        
        return {"success": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to track paper view: {str(e)}")


@router.get("/paper-views/{paper_id}")
async def get_paper_view_count(
    paper_id: str,
    activity_service: ActivityTrackingService = Depends(get_activity_tracking_service)
) -> Dict[str, Any]:
    """Get view count for a paper."""
    
    try:
        count = await activity_service.get_paper_view_count(paper_id)
        return {
            "paper_id": paper_id,
            "view_count": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get paper view count: {str(e)}")


@router.post("/test")
async def test_activity_tracking(
    req: Request,
    current_user: Optional[dict] = Depends(get_current_user),
    activity_service: ActivityTrackingService = Depends(get_activity_tracking_service)
) -> Dict[str, Any]:
    """Test endpoint to verify activity tracking is working."""
    
    user_id = str(current_user["_id"]) if current_user else None
    
    try:
        # Test tracking a paper view (use a dummy paper ID)
        result = await activity_service.track_paper_view(
            user_id=user_id,
            paper_id="507f1f77bcf86cd799439011",  # Dummy ObjectId
            metadata={"came_from": "test"}
        )
        
        return {
            "success": True,
            "message": "Activity tracking is working!",
            "result": result
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


from ..services.paper_analytics_service import paper_analytics_service, PaperAnalyticsService

@router.get("/analytics/popular-papers")
async def get_popular_papers(
    limit: int = 10,
    analytics_service: PaperAnalyticsService = Depends(lambda: paper_analytics_service)
) -> Dict[str, Any]:
    """Get the most upvoted papers for analytics."""
    try:
        return await analytics_service.get_popular_papers(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@router.get("/analytics/user-activity/{user_id}")
async def get_user_activity_summary(
    user_id: str,
    activity_service: ActivityTrackingService = Depends(get_activity_tracking_service)
) -> Dict[str, Any]:
    """Get activity summary for a specific user."""
    try:
        views = await activity_service.get_user_paper_views(user_id)
        
        # Calculate summary statistics
        total_views = len(views)
        unique_papers = len(set(view.get("paperId") for view in views if view.get("paperId")))
        
        return {
            "user_id": user_id,
            "total_paper_views": total_views,
            "unique_papers_viewed": unique_papers,
            "recent_views": views[:5]  # Last 5 views
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user activity: {str(e)}")
