from typing import Dict, Any
from ..database import get_user_actions_collection_async
from ..schemas.user_activity import LoggedActionTypes
import logging

class PaperAnalyticsService:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    async def get_popular_papers(self, limit: int = 10) -> Dict[str, Any]:
        """Get the most upvoted papers for analytics."""
        try:
            collection = await get_user_actions_collection_async()
            pipeline = [
                {"$match": {"actionType": LoggedActionTypes.UPVOTE.value}},
                {"$group": {
                    "_id": "$paperId",
                    "upvote_count": {"$sum": 1},
                    "last_upvoted": {"$max": "$createdAt"}
                }},
                {"$project": {
                    "paper_id": "$_id",
                    "upvote_count": 1,
                    "last_upvoted": 1,
                    "_id": 0
                }},
                {"$sort": {"upvote_count": -1}},
                {"$limit": limit}
            ]
            agg_cursor = await collection.aggregate(pipeline)
            results = await agg_cursor.to_list(length=limit)
            return {
                "popular_papers": results,
                "total_papers_with_upvotes": len(results)
            }
        except Exception as e:
            self.logger.error(f"Failed to get analytics: {str(e)}")
            raise

# Singleton instance
paper_analytics_service = PaperAnalyticsService()
