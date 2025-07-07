import logging
from typing import List, Dict, Any
from bson import ObjectId

from ..database import (
    get_papers_collection_async,
    get_implementation_progress_collection_async,
    get_paper_views_collection_async,
    get_popular_papers_recent_collection_async,
)
from ..schemas.papers import PaperResponse

logger = logging.getLogger(__name__)

class DashboardService:
    async def get_trending_papers(self) -> List[Dict[str, Any]]:
        logger.info("Starting get_trending_papers")
        try:
            popular_coll = await get_popular_papers_recent_collection_async()
            papers_coll = await get_papers_collection_async()
            
            logger.info("Fetching trending data from popular_papers_recent collection")
            trending_data = await popular_coll.find_one({"_id": "global_recent"})
            
            if not trending_data or not trending_data.get("papers"):
                logger.warning("No trending paper data found.")
                return []

            paper_views_map = {item["_id"]: item["view_count"] for item in trending_data["papers"]}
            paper_ids = list(paper_views_map.keys())
            logger.info(f"Found {len(paper_ids)} trending paper IDs.")

            logger.info("Fetching full paper details for trending papers.")
            papers_cursor = papers_coll.find({"_id": {"$in": paper_ids}})
            papers_list = await papers_cursor.to_list(length=len(paper_ids))
            logger.info(f"Fetched {len(papers_list)} paper details.")

            for paper in papers_list:
                paper["recent_view_count"] = paper_views_map.get(paper["_id"], 0)
            
            papers_list.sort(key=lambda p: p["recent_view_count"], reverse=True)
            logger.info("Successfully retrieved and sorted trending papers.")
            return papers_list
        except Exception as e:
            logger.error(f"Error in get_trending_papers: {e}", exc_info=True)
            raise

    async def get_user_contributions(self, user_id: str) -> List[PaperResponse]:
        logger.info(f"Starting get_user_contributions for user_id: {user_id}")
        try:
            progress_coll = await get_implementation_progress_collection_async()
            papers_coll = await get_papers_collection_async()
            user_obj_id = ObjectId(user_id)

            logger.info(f"Finding progress docs for user {user_id}")
            progress_cursor = progress_coll.find({"contributors": user_obj_id})
            progress_docs = await progress_cursor.to_list(length=100)
            logger.info(f"Found {len(progress_docs)} contribution documents.")
            
            paper_ids = [doc["_id"] for doc in progress_docs]

            if not paper_ids:
                logger.info("User has no contributions.")
                return []

            logger.info(f"Fetching paper details for {len(paper_ids)} contributions.")
            papers_cursor = papers_coll.find({"_id": {"$in": paper_ids}})
            papers_list = await papers_cursor.to_list(length=len(paper_ids))
            logger.info(f"Fetched {len(papers_list)} paper details for contributions.")
             
            response = [PaperResponse(**p) for p in papers_list]
            logger.info(f"Successfully retrieved {len(response)} user contributions.")
            return response
        except Exception as e:
            logger.error(f"Error in get_user_contributions for user {user_id}: {e}", exc_info=True)
            raise

    async def get_recently_viewed_papers(self, user_id: str) -> List[PaperResponse]:
        logger.info(f"Starting get_recently_viewed_papers for user_id: {user_id}")
        try:
            views_coll = await get_paper_views_collection_async()
            papers_coll = await get_papers_collection_async()
            user_obj_id = ObjectId(user_id)

            logger.info(f"Aggregating recent views for user {user_id}")
            recent_views_pipeline = [
                {"$match": {"userId": user_obj_id}},
                {"$sort": {"timestamp": -1}},
                {"$group": {
                    "_id": "$paperId",
                    "latest_view": {"$first": "$timestamp"}
                }},
                {"$sort": {"latest_view": -1}},
                {"$limit": 10}
            ]
            
            cursor = await views_coll.aggregate(recent_views_pipeline)
            recent_views = await cursor.to_list(length=10)
            logger.info(f"Found {len(recent_views)} recently viewed paper entries.")
            
            if not recent_views:
                return []

            paper_ids = [view["_id"] for view in recent_views]
            logger.info(f"Fetching details for {len(paper_ids)} recently viewed papers.")
            
            papers_cursor = papers_coll.find({"_id": {"$in": paper_ids}})
            papers_list = await papers_cursor.to_list(length=None)
            papers_map = {p["_id"]: p for p in papers_list}
            logger.info(f"Fetched {len(papers_list)} paper details.")
            
            ordered_papers = [papers_map[pid] for pid in paper_ids if pid in papers_map]
            logger.info(f"Ordered {len(ordered_papers)} papers based on recency.")

            response = [PaperResponse(**p) for p in ordered_papers]
            logger.info(f"Successfully retrieved {len(response)} recently viewed papers.")
            return response
        except Exception as e:
            logger.error(f"Error in get_recently_viewed_papers for user {user_id}: {e}", exc_info=True)
            raise

# Singleton instance
dashboard_service = DashboardService()