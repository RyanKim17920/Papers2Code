"""
FastAPI Background Tasks Integration

Add these endpoints to your main FastAPI app for manual testing
"""

from fastapi import APIRouter, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
import logging

from papers2code_app2.database import get_implementation_progress_collection_async
from papers2code_app2.schemas.implementation_progress import EmailStatus

router = APIRouter(prefix="/admin/tasks", tags=["Background Tasks"])
logger = logging.getLogger(__name__)

async def update_email_statuses_task() -> Dict[str, Any]:
    """Background task to update email statuses"""
    try:
        logger.info("Running email status update task...")
        collection = await get_implementation_progress_collection_async()
        
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
            except Exception as e:
                errors.append(f"Failed to update {progress.get('_id')}: {str(e)}")
        
        return {
            "success": True,
            "updated_count": updated_count,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Email status update failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

@router.post("/email-status-update")
async def trigger_email_status_update(background_tasks: BackgroundTasks):
    """Manually trigger email status update (replaces Vercel cron)"""
    
    # Run immediately and return result
    result = await update_email_statuses_task()
    
    return {
        "message": "Email status update completed",
        "result": result
    }

@router.get("/test")
async def test_endpoint():
    """Simple test endpoint (replaces Vercel cron test)"""
    return {
        "message": "Background task endpoint working!",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": "FastAPI",
        "status": "healthy"
    }

@router.get("/health")
async def health_check():
    """Health check for background task system"""
    try:
        # Test database connection
        collection = await get_implementation_progress_collection_async()
        await collection.count_documents({})
        
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
