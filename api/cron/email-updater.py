"""
Vercel Cron Job for Email Status Updates

This serverless function runs every 5 minutes to update email statuses
from "Sent" to "No Response" after 4 weeks.
"""

import json
import sys
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

try:
    from papers2code_app2.database import get_implementation_progress_collection_async
    from papers2code_app2.schemas.implementation_progress import EmailStatus
    from bson import ObjectId
except ImportError as e:
    print(f"Import error: {e}")
    # For Vercel, we might need to handle imports differently
    pass

async def update_email_statuses():
    """Update email statuses that are due"""
    try:
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
                    print(f"Updated progress {progress['_id']} to 'No Response'")
                
            except Exception as e:
                error_msg = f"Error updating progress {progress.get('_id')}: {str(e)}"
                errors.append(error_msg)
                print(error_msg)
        
        return {
            "success": True,
            "updated_count": updated_count,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

def handler(request):
    """Vercel serverless function handler"""
    import asyncio
    
    # Verify this is a cron request or allow manual testing
    if hasattr(request, 'headers'):
        # In production, Vercel adds special headers for cron jobs
        auth_header = request.headers.get('authorization', '')
        if not auth_header.startswith('Bearer ') and request.method != 'GET':
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Unauthorized'})
            }
    
    # Run the async function
    try:
        result = asyncio.run(update_email_statuses())
        
        status_code = 200 if result.get('success') else 500
        
        return {
            'statusCode': status_code,
            'headers': {
                'Content-Type': 'application/json',
            },
            'body': json.dumps(result, indent=2)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
            },
            'body': json.dumps({
                'success': False,
                'error': f'Handler error: {str(e)}',
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
        }

# For Vercel
def main(request):
    return handler(request)
