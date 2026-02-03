"""
FastAPI Background Tasks Integration

Protected admin endpoints for manual triggering of background tasks.
These endpoints require owner authentication.

NOTE: These endpoints are meant to be called by:
1. Manual admin operations
2. External cron/monitoring services with proper authentication

The actual task logic (update_email_statuses_task) is also used by
cron scripts that run directly against the database.
"""

from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
import logging

from papers2code_app2.database import get_implementation_progress_collection_async
from papers2code_app2.schemas.implementation_progress import ProgressStatus, UpdateEventType
from papers2code_app2.schemas.minimal import UserSchema
from papers2code_app2.auth import get_current_owner

router = APIRouter(prefix="/admin/tasks", tags=["Background Tasks"])
logger = logging.getLogger(__name__)

async def update_email_statuses_task() -> Dict[str, Any]:
    """Background task to update email statuses to 'No Response' after 4 weeks"""
    try:
        logger.info("Running email status update task...")
        collection = await get_implementation_progress_collection_async()
        
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
        errors = []
        
        async for progress in cursor:
            try:
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
            except Exception as e:
                errors.append(f"Failed to update {progress.get('_id')}: {str(e)}")
        
        return {
            "success": True,
            "updated_count": updated_count,
            "errors": errors,
            "timestamp": current_time.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Email status update failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

@router.post("/email-status-update")
async def trigger_email_status_update(
    current_user: UserSchema = Depends(get_current_owner)
):
    """
    Manually trigger email status update (replaces Vercel cron).

    Requires owner authentication.
    """
    logger.info(f"Email status update triggered by owner: {current_user.username}")

    # Run immediately and return result
    result = await update_email_statuses_task()

    return {
        "message": "Email status update completed",
        "triggered_by": current_user.username,
        "result": result
    }

@router.get("/test")
async def test_endpoint(current_user: UserSchema = Depends(get_current_owner)):
    """
    Simple test endpoint for admin verification.

    Requires owner authentication.
    """
    return {
        "message": "Background task endpoint working!",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": "FastAPI",
        "status": "healthy",
        "authenticated_as": current_user.username
    }

@router.get("/health")
async def health_check(current_user: UserSchema = Depends(get_current_owner)):
    """
    Health check for background task system.

    Requires owner authentication.
    """
    try:
        # Test database connection (use estimated count for speed)
        collection = await get_implementation_progress_collection_async()
        await collection.estimated_document_count()

        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "authenticated_as": current_user.username
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "authenticated_as": current_user.username
        }
