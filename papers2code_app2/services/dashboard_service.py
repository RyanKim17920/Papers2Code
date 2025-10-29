import logging
from typing import List, Dict, Any
from bson import ObjectId
from datetime import datetime, timedelta
from ..schemas.user_activity import LoggedActionTypes

from ..database import (
    get_papers_collection_async,
    get_implementation_progress_collection_async,
    get_paper_views_collection_async,
    get_popular_papers_recent_collection_async,
    get_user_actions_collection_async,
)
from ..schemas.papers import PaperResponse
from ..utils import transform_papers_batch

logger = logging.getLogger(__name__)

class DashboardService:
    async def get_trending_papers(self, time_window_days: int = 7) -> List[PaperResponse]:
        logger.info(f"Starting get_trending_papers based on upvotes in the last {time_window_days} days.")
        try:
            user_actions_coll = await get_user_actions_collection_async()
            papers_coll = await get_papers_collection_async()
            
            # Calculate the cutoff date for trending calculation
            cutoff_date = datetime.utcnow() - timedelta(days=time_window_days)
            
            # Aggregation pipeline to find top upvoted papers
            trending_pipeline = [
                {"$match": {
                    "actionType": LoggedActionTypes.UPVOTE.value,
                    "createdAt": {"$gte": cutoff_date}
                }},
                {"$group": {
                    "_id": "$paperId",
                    "recent_upvotes": {"$sum": 1}
                }},
                {"$sort": {"recent_upvotes": -1}},
                {"$limit": 10} # Limit to top 10 trending papers
            ]
            
            cursor = await user_actions_coll.aggregate(trending_pipeline)
            trending_data = await cursor.to_list(length=10)
            
            if not trending_data:
                logger.warning("No trending paper data found based on recent upvotes.")
                return []

            paper_upvotes_map = {item["_id"]: item["recent_upvotes"] for item in trending_data}
            paper_ids = list(paper_upvotes_map.keys())
            logger.info(f"Found {len(paper_ids)} trending paper IDs based on upvotes.")

            # Prepare projection and convert IDs to ObjectId when needed
            summary_projection = {
                "title": 1, "authors": 1, "publicationDate": 1, "upvoteCount": 1, "status": 1,
                "abstract": 1, "venue": 1, "tasks": 1, "implementabilityStatus": 1,
                "urlGithub": 1, "urlAbs": 1, "urlPdf": 1, "hasCode": 1
            }
            # Convert string ids to ObjectId if possible, otherwise keep as-is
            paper_object_ids = []
            for pid in paper_ids:
                if isinstance(pid, ObjectId):
                    paper_object_ids.append(pid)
                elif isinstance(pid, str) and ObjectId.is_valid(pid):
                    paper_object_ids.append(ObjectId(pid))
                else:
                    # Skip invalid ids
                    logger.warning(f"Skipping invalid paper id in trending results: {pid}")

            if not paper_object_ids:
                logger.warning("No valid paper IDs to fetch for trending papers.")
                return []

            # Fetch paper summaries
            papers_cursor = papers_coll.find({"_id": {"$in": paper_object_ids}}, summary_projection)
            papers_list = await papers_cursor.to_list(length=len(paper_object_ids))

            # Map counts by stringified id to handle type differences
            upvotes_by_str_id = {str(k): v for k, v in paper_upvotes_map.items()}

            # Attach recent upvote count
            for paper in papers_list:
                paper["recent_upvote_count"] = upvotes_by_str_id.get(str(paper["_id"]), 0)

            # Sort by recent upvotes desc
            papers_list.sort(key=lambda p: p.get("recent_upvote_count", 0), reverse=True)

            # OPTIMIZATION: Use batch transformation
            transformed_papers = await transform_papers_batch(papers_list, None, detail_level="summary")
            response = [PaperResponse(**paper) for paper in transformed_papers]
                
            logger.info("Successfully retrieved and sorted trending papers based on upvotes.")
            return response
        except Exception as e:
            logger.error(f"Error in get_trending_papers: {e}", exc_info=True)
            raise

    async def get_user_contributions(self, user_id: str) -> List[PaperResponse]:
        logger.info(f"Starting get_user_contributions for user_id: {user_id}")
        try:
            progress_coll = await get_implementation_progress_collection_async()
            papers_coll = await get_papers_collection_async()
            user_actions_coll = await get_user_actions_collection_async()
            
            user_obj_id = ObjectId(user_id)
            contributed_paper_ids = set()
            progress_cursor = progress_coll.find({"contributors": user_obj_id})
            progress_docs = await progress_cursor.to_list(length=100)
            logger.info(f"Found {len(progress_docs)} contribution documents.")
            for progress in progress_docs:
                contributed_paper_ids.add(progress["_id"])
            project_actions_cursor = user_actions_coll.find({
                "userId": user_obj_id,
                "actionType": {"$in": [LoggedActionTypes.PROJECT_JOINED.value, LoggedActionTypes.PROJECT_STARTED.value]}
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
            summary_projection = {
                "title": 1, "authors": 1, "publicationDate": 1, "upvoteCount": 1, "status": 1,
                "abstract": 1, "venue": 1, "tasks": 1, "implementabilityStatus": 1,
                "urlGithub": 1, "urlAbs": 1, "urlPdf": 1, "hasCode": 1
            }
            paper_ids_list = list(contributed_paper_ids)
            logger.info(f"Fetching paper details for {len(paper_ids_list)} contributions.")
            papers_cursor = papers_coll.find({"_id": {"$in": paper_ids_list}}, summary_projection)
            papers_list = await papers_cursor.to_list(length=len(paper_ids_list))
            logger.info(f"Fetched {len(papers_list)} paper details for contributions.")
            
            # OPTIMIZATION: Use batch transformation
            transformed_papers = await transform_papers_batch(papers_list, user_id, detail_level="summary")
            response = [PaperResponse(**paper) for paper in transformed_papers]
            
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

            logger.info(f"Aggregating recent views for user {user_id}")
            # Match userId directly as a string, as it's stored that way
            recent_views_pipeline = [
                {"$match": {"userId": user_id}},
                {"$sort": {"timestamp": -1}},
                {"$group": {
                    "_id": "$paperId",
                    "latest_view": {"$first": "$timestamp"}
                }},
                {"$sort": {"latest_view": -1}},
                {"$limit": 25}
            ]
            
            cursor = await views_coll.aggregate(recent_views_pipeline)
            recent_views = await cursor.to_list(length=10)
            logger.info(f"Found {len(recent_views)} recently viewed paper entries.")

            if not recent_views:
                return []

            # Extract paper IDs (which are strings) and convert them to ObjectIds for the next query
            paper_id_strings = [view["_id"] for view in recent_views]
            paper_ids = [ObjectId(pid) for pid in paper_id_strings if ObjectId.is_valid(pid)]
            
            logger.info(f"Fetching details for {len(paper_ids)} recently viewed papers.")
            summary_projection = {
                "title": 1, "authors": 1, "publicationDate": 1, "upvoteCount": 1, "status": 1,
                "abstract": 1, "venue": 1, "tasks": 1, "implementabilityStatus": 1,
                "urlGithub": 1, "urlAbs": 1, "urlPdf": 1, "hasCode": 1
            }
            
            papers_cursor = papers_coll.find({"_id": {"$in": paper_ids}}, summary_projection)
            papers_list = await papers_cursor.to_list(length=len(paper_ids))
            papers_map = {p["_id"]: p for p in papers_list}
            logger.info(f"Fetched {len(papers_list)} paper details.")

            # Order the fetched papers based on the recency of views
            ordered_papers = [papers_map[pid] for pid in paper_ids if pid in papers_map]
            
            logger.info(f"Ordered {len(ordered_papers)} papers based on recency.")
            
            # OPTIMIZATION: Use batch transformation
            transformed_papers = await transform_papers_batch(ordered_papers, user_id, detail_level="summary")
            response = [PaperResponse(**paper) for paper in transformed_papers]
                
            logger.info(f"Successfully retrieved {len(response)} recently viewed papers.")
            return response
        except Exception as e:
            logger.error(f"Error in get_recently_viewed_papers for user {user_id}: {e}", exc_info=True)
            raise

    async def get_user_upvoted_papers(self, user_id: str) -> List[PaperResponse]:
        """Get papers upvoted by the user."""
        logger.info(f"Starting get_user_upvoted_papers for user_id: {user_id}")
        try:
            user_actions_coll = await get_user_actions_collection_async()
            papers_coll = await get_papers_collection_async()
            
            user_obj_id = ObjectId(user_id)
            
            # Find all upvote actions by the user
            upvote_actions_cursor = user_actions_coll.find({
                "userId": user_obj_id,
                "actionType": LoggedActionTypes.UPVOTE.value
            }).sort("createdAt", -1).limit(50)  # Get most recent 50 upvotes
            
            upvote_actions = await upvote_actions_cursor.to_list(length=50)
            logger.info(f"Found {len(upvote_actions)} upvote actions.")
            
            if not upvote_actions:
                return []
            
            # Extract paper IDs
            paper_ids = [action["paperId"] for action in upvote_actions]
            
            # Fetch paper details
            summary_projection = {
                "title": 1, "authors": 1, "publicationDate": 1, "upvoteCount": 1, "status": 1,
                "abstract": 1, "venue": 1, "tasks": 1, "implementabilityStatus": 1,
                "urlGithub": 1, "urlAbs": 1, "urlPdf": 1, "hasCode": 1
            }
            
            papers_cursor = papers_coll.find({"_id": {"$in": paper_ids}}, summary_projection)
            papers_list = await papers_cursor.to_list(length=len(paper_ids))
            
            # Create a map for ordering
            papers_map = {p["_id"]: p for p in papers_list}
            
            # Order papers based on upvote recency
            ordered_papers = [papers_map[pid] for pid in paper_ids if pid in papers_map]
            
            # OPTIMIZATION: Use batch transformation
            transformed_papers = await transform_papers_batch(ordered_papers, user_id, detail_level="summary")
            response = [PaperResponse(**paper) for paper in transformed_papers]
                
            logger.info(f"Successfully retrieved {len(response)} upvoted papers.")
            return response
        except Exception as e:
            logger.error(f"Error in get_user_upvoted_papers for user {user_id}: {e}", exc_info=True)
            raise

# Singleton instance
dashboard_service = DashboardService()