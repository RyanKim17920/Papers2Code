"""
Modern background task runner for Papers2Code (Render-compatible)
"""
import asyncio
import logging
import schedule
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from papers2code_app2.database import (
    get_implementation_progress_collection_async,
    get_user_actions_collection_async,
    initialize_async_db,
    async_db,
    get_paper_views_collection_async,
    get_popular_papers_recent_collection_async
)
from papers2code_app2.schemas.implementation_progress import ProgressStatus, UpdateEventType

logger = logging.getLogger(__name__)

class BackgroundTaskRunner:
    """Handles background tasks like email status updates"""
    
    def __init__(self):
        self.is_running = False
        
    async def update_email_statuses(self) -> Dict[str, Any]:
        """Update email statuses to 'No Response' after 4 weeks using timeline events"""
        try:
            logger.info("Starting optimized email status update task...")
            collection = await get_implementation_progress_collection_async()
            
            # Calculate threshold once
            four_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=4)
            current_time = datetime.now(timezone.utc)
            
            # Find progress documents where:
            # - status is "Started" (meaning email was sent but no response yet)
            # - there's an "Email Sent" event in the updates array older than 4 weeks
            cursor = collection.find({
                "status": ProgressStatus.STARTED.value,
                "updates": {
                    "$elemMatch": {
                        "eventType": UpdateEventType.EMAIL_SENT.value,
                        "timestamp": {"$lte": four_weeks_ago}
                    }
                }
            })
            
            updated_count = 0
            
            # Process each document individually to add timeline events
            async for progress in cursor:
                # Create a status changed event
                status_event = {
                    "eventType": UpdateEventType.STATUS_CHANGED.value,
                    "timestamp": current_time,
                    "userId": progress.get("initiatedBy"),  # System update, use initiator
                    "details": {
                        "previousStatus": ProgressStatus.STARTED.value,
                        "newStatus": ProgressStatus.NO_RESPONSE.value,
                        "reason": "Auto-updated: No response after 4 weeks"
                    }
                }
                
                result = await collection.update_one(
                    {"_id": progress["_id"]},
                    {
                        "$set": {
                            "status": ProgressStatus.NO_RESPONSE.value,
                            "latestUpdate": current_time,
                            "updatedAt": current_time
                        },
                        "$push": {
                            "updates": status_event
                        }
                    }
                )
                if result.modified_count > 0:
                    updated_count += 1
            
            return {
                "success": True,
                "updated_count": updated_count,
                "errors": [],
                "timestamp": current_time.isoformat()
            }
            
        except Exception as e:
            error_result = {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            logger.error(f"Email status update failed: {e}")
            return error_result
    
    async def update_view_analytics(self) -> Dict[str, Any]:
        """Optimized view analytics using sliding window approach - no redundant user tracking."""
        try:
            logger.info("Starting optimized view analytics update task...")
            
            views_coll = await get_paper_views_collection_async()
            popular_recent_coll = await get_popular_papers_recent_collection_async()

            now = datetime.now(timezone.utc)
            window_start = now - timedelta(days=7)

            # Get the last update timestamp for incremental processing
            last_update_doc = await popular_recent_coll.find_one({"_id": "last_update"})
            last_update = last_update_doc.get("timestamp", window_start) if last_update_doc else window_start
            
            # Only process new views since last update for efficiency
            new_views_pipeline = [
                {"$match": {
                    "timestamp": {"$gte": last_update, "$lt": now}
                }},
                {"$group": {
                    "_id": "$paperId",  # Only track paper views, not per-user
                    "count": {"$sum": 1},
                    "latest_timestamp": {"$max": "$timestamp"}
                }}
            ]
            
            # Process new views incrementally
            try:
                paper_view_updates = {}
                
                # PyMongo async aggregation - get all results as a list first
                agg_cursor = await views_coll.aggregate(new_views_pipeline)
                cursor_results = await agg_cursor.to_list(length=None)
                
                for view_group in cursor_results:
                    paper_id = view_group["_id"]
                    count = view_group["count"]
                    
                    # Accumulate paper view counts
                    paper_view_updates[paper_id] = paper_view_updates.get(paper_id, 0) + count
                        
            except Exception as e:
                logger.warning(f"Error processing new views: {e}")
                paper_view_updates = {}
            
            
            # Update popular papers with sliding window
            # Remove old entries and add new ones
            cutoff_time = now - timedelta(days=7)
            
            # Get existing popular papers data
            existing_popular = await popular_recent_coll.find_one({"_id": "global_recent"})
            current_papers = existing_popular.get("papers", []) if existing_popular else []
            
            # Create a map of current paper counts
            paper_counts = {paper["_id"]: paper["view_count"] for paper in current_papers}
            
            # Apply incremental updates
            for paper_id, new_views in paper_view_updates.items():
                if paper_id in paper_counts:
                    paper_counts[paper_id] += new_views
                else:
                    paper_counts[paper_id] = new_views
            
            # Rebuild top 20 list efficiently
            popular_list = [
                {"_id": paper_id, "view_count": count}
                for paper_id, count in sorted(paper_counts.items(), key=lambda x: x[1], reverse=True)[:20]
            ]
            
            # Update popular papers collection
            await popular_recent_coll.update_one(
                {"_id": "global_recent"},
                {"$set": {"papers": popular_list, "last_updated": now}},
                upsert=True,
            )
            
            # Update last processed timestamp
            await popular_recent_coll.update_one(
                {"_id": "last_update"},
                {"$set": {"timestamp": now}},
                upsert=True
            )

            logger.info(f"Optimized view analytics completed: processed {len(paper_view_updates)} papers (no redundant user tracking)")
            return {"success": True, "processed_papers": len(paper_view_updates), "user_updates": 0}
            
        except Exception as e:
            logger.error(f"View analytics update failed: {e}")
            return {"success": False, "error": str(e)}
    
    def schedule_tasks(self):
        """Schedule background tasks"""
        # Run email updates every 6 hours
        schedule.every(6).hours.do(lambda: asyncio.run(self.update_email_statuses()))
        # Run view analytics every hour
        schedule.every(1).hours.do(lambda: asyncio.run(self.update_view_analytics()))
        
        logger.info("Background tasks scheduled")
    
    def run_scheduler(self):
        """Run the task scheduler (blocking)"""
        self.is_running = True
        logger.info("Starting background task scheduler...")
        
        while self.is_running:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    
    def stop(self):
        """Stop the scheduler"""
        self.is_running = False
        logger.info("Background task scheduler stopped")