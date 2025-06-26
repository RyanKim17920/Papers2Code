"""
Modern background task runner for Papers2Code (Render-compatible)
"""
import asyncio
import logging
import schedule
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from papers2code_app2.database import get_implementation_progress_collection_async, get_user_actions_collection_async, initialize_async_db, async_db, get_paper_views_collection_async
from papers2code_app2.schemas.implementation_progress import EmailStatus

logger = logging.getLogger(__name__)

class BackgroundTaskRunner:
    """Handles background tasks like email status updates"""
    
    def __init__(self):
        self.is_running = False
        
    async def update_email_statuses(self) -> Dict[str, Any]:
        """Update email statuses that are due (replaces cron job)"""
        try:
            logger.info("Starting email status update task...")
            collection = await get_implementation_progress_collection_async()
            
            # Find emails sent more than 4 weeks ago that still have "Sent" status
            four_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=4)
            
            cursor = collection.find({
                "emailStatus": EmailStatus.SENT.value,
                "emailSentAt": {"$exists": True, "$ne": None, "$lte": four_weeks_ago}
            })
            
            updated_count = 0
            errors = []
            
            async for progress in cursor:
                try:
                    result = await collection.update_one(
                        {"_id": progress["_id"]},
                        {
                            "$set": {
                                "emailStatus": EmailStatus.NO_RESPONSE.value,
                                "updatedAt": datetime.now(timezone.utc)
                            }
                        }
                    )
                    
                    if result.modified_count > 0:
                        updated_count += 1
                        logger.debug(f"Updated email status for progress {progress['_id']}")
                        
                except Exception as e:
                    error_msg = f"Failed to update progress {progress.get('_id', 'unknown')}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
            
            result = {
                "success": True,
                "updated_count": updated_count,
                "errors": errors,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"Email status update completed: {updated_count} updated, {len(errors)} errors")
            return result
            
        except Exception as e:
            error_result = {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            logger.error(f"Email status update failed: {e}")
            return error_result
    
    async def update_view_analytics(self) -> Dict[str, Any]:
        """Aggregate user view analytics (recent views per user and popular papers)."""
        try:
            logger.info("Starting view analytics update task...")
            await initialize_async_db()
            views_coll = await get_paper_views_collection_async()
            db = async_db  # Use already-initialized async_db
            if db is None:
                raise RuntimeError("Async DB not initialized")

            user_recent_coll = db["user_recent_views"]
            popular_recent_coll = db["popular_papers_recent"]

            # Time window: last 7 days
            window_start = datetime.now(timezone.utc) - timedelta(days=7)

            # 1) Per-user recent views (limit 10)
            pipeline_user = [
                {"$match": {"timestamp": {"$gte": window_start}}},
                {"$sort": {"timestamp": -1}},
                {"$group": {"_id": "$userId", "recent_papers": {"$push": "$paperId"}}},
                {"$project": {"recent_papers": {"$slice": ["$recent_papers", 10]}}}
            ]
            async for doc in views_coll.aggregate(pipeline_user):
                user_id = doc["_id"] or "anonymous"
                await user_recent_coll.update_one(
                    {"_id": user_id},
                    {"$set": {"recent_papers": doc["recent_papers"], "last_updated": datetime.now(timezone.utc)}},
                    upsert=True,
                )

            # 2) Global popular papers (view count in window)
            pipeline_global = [
                {"$match": {"timestamp": {"$gte": window_start}}},
                {"$group": {"_id": "$paperId", "view_count": {"$sum": 1}}},
                {"$sort": {"view_count": -1}},
                {"$limit": 20},
            ]
            popular_list = await views_coll.aggregate(pipeline_global).to_list(length=20)
            await popular_recent_coll.update_one(
                {"_id": "global_recent"},
                {"$set": {"papers": popular_list, "last_updated": datetime.now(timezone.utc)}},
                upsert=True,
            )

            logger.info("View analytics update completed")
            return {"success": True, "updated_users": "done", "popular_count": len(popular_list)}
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

# For manual testing
async def test_email_update():
    """Test the email update function manually"""
    runner = BackgroundTaskRunner()
    result = await runner.update_email_statuses()
    print(f"Email update test result: {result}")
    return result

if __name__ == "__main__":
    # For testing
    import logging
    logging.basicConfig(level=logging.INFO)
    
    # Test the email update function
    asyncio.run(test_email_update())
