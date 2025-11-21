#!/usr/bin/env python3
"""
Popular Papers Analytics Script

This script calculates and caches popular papers based on view analytics,
upvotes, and other engagement metrics. It's designed to run as a cron job
and integrates with the existing background tasks system.

Usage:
- As a standalone script: python popular-papers.py
- As a cron job: 0 */3 * * * /usr/bin/python3 /path/to/popular-papers.py
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

from papers2code_app2.background_tasks import BackgroundTaskRunner
from papers2code_app2.database import (
    initialize_async_db, 
    get_papers_collection_async,
    get_paper_views_collection_async,
    get_user_actions_collection_async,
    async_db
)


def setup_logging():
    """Configure logging for the cron job."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            # Optional: Add file handler for persistent logs
            # logging.FileHandler('/var/log/papers2code/popular-papers.log')
        ]
    )
    
    return logging.getLogger(__name__)


async def calculate_popular_papers_metrics() -> Dict[str, Any]:
    """
    Calculate popular papers based on multiple metrics.
    Returns analytics data for caching.
    """
    logger = logging.getLogger(__name__)
    
    try:
        papers_coll = await get_papers_collection_async()
        views_coll = await get_paper_views_collection_async()
        
        # Time windows for different popularity metrics
        now = datetime.now(timezone.utc)
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
        analytics_result = {
            "trending_papers": [],
            "most_upvoted": [],
            "recently_added": [],
            "timestamp": now.isoformat()
        }
        
        
        
        # 4. Most upvoted papers (all time)
        most_upvoted_cursor = papers_coll.find(
            {"upvoteCount": {"$gt": 0}},
            {
                "title": 1,
                "upvoteCount": 1,
                "status": 1,
                "publicationDate": 1,
                "venue": 1
            }
        ).sort("upvoteCount", -1).limit(20)
        
        analytics_result["most_upvoted"] = [
            {
                "paper_id": str(doc["_id"]),
                "title": doc.get("title", ""),
                "upvote_count": doc.get("upvoteCount", 0),
                "status": doc.get("status", ""),
                "publication_date": doc.get("publicationDate"),
                "venue": doc.get("venue", "")
            }
            async for doc in most_upvoted_cursor
        ]
        
        # 5. Recently added papers (last 7 days)
        recently_added_cursor = papers_coll.find(
            {"createdAt": {"$gte": week_ago}},
            {
                "title": 1,
                "createdAt": 1,
                "status": 1,
                "upvoteCount": 1,
                "venue": 1
            }
        ).sort("createdAt", -1).limit(20)
        
        analytics_result["recently_added"] = [
            {
                "paper_id": str(doc["_id"]),
                "title": doc.get("title", ""),
                "created_at": doc.get("createdAt"),
                "status": doc.get("status", ""),
                "upvote_count": doc.get("upvoteCount", 0),
                "venue": doc.get("venue", "")
            }
            async for doc in recently_added_cursor
        ]
        
        # 4. Trending papers (upvotes in the last 7 days)
        trending_pipeline = [
            {"$match": {"actionType": "upvote", "createdAt": {"$gte": week_ago}}},
            {"$group": {"_id": "$paperId", "recent_upvotes": {"$sum": 1}}},
            {"$sort": {"recent_upvotes": -1}},
            {"$limit": 20},
            {"$lookup": {
                "from": "papers",
                "localField": "_id",
                "foreignField": "_id",
                "as": "paper_info"
            }},
            {"$unwind": "$paper_info"},
            {"$project": {
                "paper_id": "$_id",
                "title": "$paper_info.title",
                "recent_upvotes": 1,
                "upvote_count": "$paper_info.upvoteCount",
                "status": "$paper_info.status",
                "publication_date": "$paper_info.publicationDate"
            }}
        ]

        user_actions_coll = await get_user_actions_collection_async()
        trending_cursor = await user_actions_coll.aggregate(trending_pipeline)
        analytics_result["trending_papers"] = await trending_cursor.to_list(length=20)
        
        logger.info("Popular papers analytics calculated successfully")
        return analytics_result
        
    except Exception as e:
        logger.error(f"Error calculating popular papers metrics: {e}", exc_info=True)
        raise


async def cache_popular_papers_results(analytics_data: Dict[str, Any]) -> bool:
    """Cache the popular papers results in the database."""
    logger = logging.getLogger(__name__)
    
    try:
        if async_db is None:
            raise RuntimeError("Async DB not initialized")
            
        popular_papers_cache = async_db["popular_papers_cache"]
        
        # Store the results with timestamp
        cache_doc = {
            "_id": "latest",
            "data": analytics_data,
            "last_updated": datetime.now(timezone.utc)
        }
        
        await popular_papers_cache.replace_one(
            {"_id": "latest"},
            cache_doc,
            upsert=True
        )
        
        logger.info("Popular papers results cached successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error caching popular papers results: {e}", exc_info=True)
        return False


async def run_popular_papers_analytics():
    """Run the popular papers analytics task."""
    logger = setup_logging()
    
    try:
        logger.info("Starting popular papers analytics cron job...")
        
        # Initialize database connection
        await initialize_async_db()
        
        # Also run the background task for view analytics
        runner = BackgroundTaskRunner()
        view_analytics_result = await runner.update_view_analytics()
        
        if view_analytics_result.get("success"):
            logger.info("View analytics update completed successfully")
        else:
            logger.warning(f"View analytics update had issues: {view_analytics_result}")
        
        # Calculate popular papers metrics
        analytics_data = await calculate_popular_papers_metrics()
        
        # Cache the results
        cache_success = await cache_popular_papers_results(analytics_data)
        
        if cache_success:
            logger.info(
                f"Popular papers analytics completed successfully. "
                f"Calculated metrics for {len(analytics_data)} categories."
            )
        else:
            logger.error("Failed to cache popular papers results")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Critical error in popular papers cron job: {e}", exc_info=True)
        sys.exit(1)


def main():
    """Main entry point for the cron job."""
    try:
        asyncio.run(run_popular_papers_analytics())
    except KeyboardInterrupt:
        print("Popular papers analytics interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
