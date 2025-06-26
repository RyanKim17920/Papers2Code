from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..schemas.minimal import UserSchema
from ..services.dashboard_service import DashboardService, dashboard_service
from ..schemas.papers import PaperResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/data")
async def get_dashboard_data(
    current_user: Optional[UserSchema] = Depends(get_current_user),
    service: DashboardService = Depends(lambda: dashboard_service),
):
    """
    Unified endpoint to fetch all data for the user dashboard.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = str(current_user.id)

    try:
        trending_papers = await service.get_trending_papers()
        my_contributions = await service.get_user_contributions(user_id)
        recently_viewed = await service.get_recently_viewed_papers(user_id)

        # Convert trending papers to PaperResponse for consistency
        trending_papers_response = [PaperResponse(**p) for p in trending_papers]

        return {
            "trendingPapers": trending_papers_response,
            "myContributions": my_contributions,
            "recentlyViewed": recently_viewed,
        }
    except Exception as e:
        # It's better to log the actual error
        # logger.error(f"Dashboard data fetch failed for user {user_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to fetch dashboard data."
        ) 