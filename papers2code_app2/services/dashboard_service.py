import logging
from typing import List, Dict, Any
from bson import ObjectId

from ..database import (
    get_papers_collection_async,
    get_implementation_progress_collection_async,
    get_paper_views_collection_async,
    get_popular_papers_recent_collection_async,
    get_user_actions_collection_async,
)
from ..schemas.papers import PaperResponse
from ..utils import transform_paper_async

logger = logging.getLogger(__name__)

class DashboardService:
    async def get_trending_papers(self) -> List[PaperResponse]:
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
            
            # Transform each paper using the utility function
            response = []
            for paper_doc in papers_list:
                # For trending papers, we don't need user-specific data, so we can pass None for user_id
                transformed_paper = await transform_paper_async(paper_doc, None, detail_level="full")
                response.append(PaperResponse(**transformed_paper))
                
            logger.info("Successfully retrieved and sorted trending papers.")
            return response
        except Exception as e:
            logger.error(f"Error in get_trending_papers: {e}", exc_info=True)
            raise

    async def get_user_contributions(self, user_id: str) -> List[PaperResponse]:
        """
        Retrieves papers a user is contributing to.
        Uses the same logic as user service: checks both implementation progress and user actions.
        """
        logger.info(f"Starting get_user_contributions for user_id: {user_id}")
        try:
            progress_coll = await get_implementation_progress_collection_async()
            papers_coll = await get_papers_collection_async()
            user_actions_coll = await get_user_actions_collection_async()
            
            user_obj_id = ObjectId(user_id)
            contributed_paper_ids = set()

            # First, check implementation progress records where user is a contributor
            logger.info(f"Finding progress docs for user {user_id}")
            progress_cursor = progress_coll.find({"contributors": user_obj_id})
            progress_docs = await progress_cursor.to_list(length=100)
            logger.info(f"Found {len(progress_docs)} contribution documents.")
            
            for progress in progress_docs:
                contributed_paper_ids.add(progress["_id"])

            # Also check user actions for "Project Joined" and "Project Started"
            project_actions_cursor = user_actions_coll.find({
                "userId": user_obj_id,
                "actionType": {"$in": ["Project Joined", "Project Started"]}
            })
            project_actions = await project_actions_cursor.to_list(length=100)
            logger.info(f"Found {len(project_actions)} project actions.")
            
            for action in project_actions:
                paper_id = action.get('paperId')
                if paper_id:
                    contributed_paper_ids.add(paper_id)

            logger.info(f"Total unique contributed paper IDs: {len(contributed_paper_ids)}")

            if not contributed_paper_ids:
                logger.info("User has no contributions.")
                return []

            # Fetch the full paper details for these contributions
            paper_ids_list = list(contributed_paper_ids)
            logger.info(f"Fetching paper details for {len(paper_ids_list)} contributions.")
            papers_cursor = papers_coll.find({"_id": {"$in": paper_ids_list}})
            papers_list = await papers_cursor.to_list(length=len(paper_ids_list))
            logger.info(f"Fetched {len(papers_list)} paper details for contributions.")
             
            # Transform each paper using the utility function
            response = []
            for paper_doc in papers_list:
                transformed_paper = await transform_paper_async(paper_doc, user_id, detail_level="full")
                response.append(PaperResponse(**transformed_paper))
                
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

            # Transform each paper using the utility function
            response = []
            for paper_doc in ordered_papers:
                transformed_paper = await transform_paper_async(paper_doc, user_id, detail_level="full")
                response.append(PaperResponse(**transformed_paper))
                
            logger.info(f"Successfully retrieved {len(response)} recently viewed papers.")
            return response
        except Exception as e:
            logger.error(f"Error in get_recently_viewed_papers for user {user_id}: {e}", exc_info=True)
            raise

# Singleton instance
dashboard_service = DashboardService()