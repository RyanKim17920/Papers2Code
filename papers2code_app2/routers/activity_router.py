from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

from ..auth import get_current_user, get_current_user_optional
from ..dependencies import get_activity_tracking_service
from ..schemas.user_activity import LoggedActionTypes
from ..services.activity_tracking_service import ActivityTrackingService
from ..schemas.minimal import UserSchema
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/activity", tags=["activity"])


class TrackViewRequest(BaseModel):
    """Request model for tracking paper views."""
    paper_id: str = Field(..., alias="paperId")
    came_from: Optional[str] = Field(None, alias="cameFrom")


@router.post("/paper-view")
async def track_paper_view(
    request: TrackViewRequest,
    req: Request,
    current_user: Optional[UserSchema] = Depends(get_current_user_optional),
    activity_service: ActivityTrackingService = Depends(get_activity_tracking_service)
) -> Dict[str, Any]:
    """
    Track a paper view.

    This endpoint accepts both authenticated and anonymous users.
    For authenticated users, the view is associated with their user ID.
    For anonymous users, views are tracked without user association.
    """
    user_id = str(current_user.id) if current_user else None

    try:
        result = await activity_service.track_paper_view(
            user_id=user_id,
            paper_id=request.paper_id,
            metadata={"came_from": request.came_from}
        )

        return {"success": result}

    except Exception as e:
        logger.error(f"Failed to track paper view: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to track paper view: {str(e)}")


@router.get("/paper-views/{paper_id}")
async def get_paper_view_count(
    paper_id: str,
    activity_service: ActivityTrackingService = Depends(get_activity_tracking_service)
) -> Dict[str, Any]:
    """
    Get view count for a paper.

    This is public aggregate data (total view count only, no user-specific information).
    """
    try:
        count = await activity_service.get_paper_view_count(paper_id)
        return {
            "paper_id": paper_id,
            "view_count": count
        }
    except Exception as e:
        logger.error(f"Failed to get paper view count for {paper_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get paper view count: {str(e)}")


# =============================================================================
# REMOVED ENDPOINTS (Security/Cleanup)
# =============================================================================
# The following endpoints were removed because they were either:
# 1. Not used anywhere in the codebase
# 2. Exposed sensitive user data without proper authentication
#
# Removed endpoints:
# - POST /test - Test endpoint, not used in production
# - GET /analytics/popular-papers - Not used, duplicate functionality exists elsewhere
# - GET /analytics/user-activity/{user_id} - SECURITY ISSUE: Exposed user activity
#   data publicly without authentication. User activity data should only be
#   accessible by the user themselves or by admins.
#
# If these endpoints are needed in the future, they should be re-implemented with
# proper authentication:
# - /analytics/user-activity/{user_id} should require:
#   - User authentication (get_current_user)
#   - Authorization check: user can only view their own activity, or admin can view any
# =============================================================================
