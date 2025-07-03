import logging
from typing import List, Dict, Any
from bson import ObjectId

from ..database import (
    async_db,
    get_papers_collection_async,
    get_implementation_progress_collection_async,
)
from ..schemas.papers import PaperResponse

logger = logging.getLogger(__name__)

class DashboardService:
    async def get_trending_papers(self) -> List[Dict[str, Any]]:
        """
        Retrieves the most viewed papers from the pre-aggregated analytics collection.
        """
        if not async_db:
            raise RuntimeError("Database not initialized.")
        
        popular_coll = async_db["popular_papers_recent"]
        papers_coll = await get_papers_collection_async()
        
        trending_data = await popular_coll.find_one({"_id": "global_recent"})
        if not trending_data or not trending_data.get("papers"):
            return []

        # Extract paper IDs and create a map of view counts
        paper_views_map = {item["_id"]: item["view_count"] for item in trending_data["papers"]}
        paper_ids = list(paper_views_map.keys())

        # Fetch full paper details
        papers_cursor = papers_coll.find({"_id": {"$in": paper_ids}})
        papers_list = await papers_cursor.to_list(length=len(paper_ids))

        # Add view count to each paper object and sort by it
        for paper in papers_list:
            paper["recent_view_count"] = paper_views_map.get(paper["_id"], 0)
        
        papers_list.sort(key=lambda p: p["recent_view_count"], reverse=True)

        return papers_list

    async def get_user_contributions(self, user_id: str) -> List[PaperResponse]:
        """
        Retrieves papers a user is contributing to.
        """
        progress_coll = await get_implementation_progress_collection_async()
        papers_coll = await get_papers_collection_async()
        
        user_obj_id = ObjectId(user_id)

        # Find all progress docs the user is a contributor to
        progress_cursor = progress_coll.find({"contributors": user_obj_id})
        progress_docs = await progress_cursor.to_list(length=100) # Limit to 100 contributions
        
        paper_ids = [doc["_id"] for doc in progress_docs]

        if not paper_ids:
            return []

        # Fetch the full paper details for these contributions
        papers_cursor = papers_coll.find({"_id": {"$in": paper_ids}})
        papers_list = await papers_cursor.to_list(length=len(paper_ids))
        
        return [PaperResponse(**p) for p in papers_list]

    async def get_recently_viewed_papers(self, user_id: str) -> List[PaperResponse]:
        """
        Retrieves recently viewed papers for a user from the analytics collection.
        """
        if not async_db: 
            raise RuntimeError("Database not initialized.")

        recent_views_coll = async_db["user_recent_views"]
        papers_coll = await get_papers_collection_async()
        user_obj_id = ObjectId(user_id)

        user_views_data = await recent_views_coll.find_one({"_id": user_obj_id})
        
        if not user_views_data or not user_views_data.get("recent_papers"):
            return []

        paper_ids = user_views_data["recent_papers"]
        
        # Fetch full paper details and preserve the recent viewing order
        papers_cursor = papers_coll.find({"_id": {"$in": paper_ids}})
        papers_map = {p["_id"]: p for p in await papers_cursor.to_list(length=len(paper_ids))}
        
        # Order papers based on the user's recent view list
        ordered_papers = [papers_map[pid] for pid in paper_ids if pid in papers_map]

        return [PaperResponse(**p) for p in ordered_papers]

# Singleton instance
dashboard_service = DashboardService()  