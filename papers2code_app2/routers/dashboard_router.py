import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..schemas.minimal import UserSchema
from ..services.dashboard_service import DashboardService, dashboard_service
from ..schemas.papers import PaperResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger(__name__)

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
    logger.info(f"Fetching dashboard data for user {user_id}")

    try:
        logger.info("Fetching trending papers...")
        trending_papers = await service.get_trending_papers()
        logger.info(f"Trending papers fetched: {len(trending_papers) if trending_papers else 0} items")

        logger.info("Fetching user contributions...")
        my_contributions = await service.get_user_contributions(user_id)
        logger.info(f"User contributions fetched: {len(my_contributions) if my_contributions else 0} items")

        logger.info("Fetching recently viewed papers...")
        recently_viewed = await service.get_recently_viewed_papers(user_id)
        logger.info(f"Recently viewed papers fetched: {len(recently_viewed) if recently_viewed else 0} items")

        logger.info("Fetching user upvoted papers...")
        upvoted_papers = await service.get_user_upvoted_papers(user_id)
        logger.info(f"User upvoted papers fetched: {len(upvoted_papers) if upvoted_papers else 0} items")

        response_data = {
            "trendingPapers": trending_papers,
            "myContributions": my_contributions,
            "recentlyViewed": recently_viewed,
            "bookmarkedPapers": upvoted_papers,  # Using bookmarkedPapers to represent upvoted papers for now
        }
        logger.info(f"Dashboard data prepared for user {user_id}. Returning response.")
        
        return response_data
    except Exception as e:
        logger.error(f"Dashboard data fetch failed for user {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail="Failed to fetch dashboard data."
        ) 