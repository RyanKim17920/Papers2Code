from datetime import datetime
from typing import Optional, Dict, Any
from papers2code_app2.database import get_paper_views_collection_async
from bson import ObjectId

class ActivityTrackingService:
    """
    Service for tracking paper view events into a dedicated collection.
    """
    
    def __init__(self):
        self.paper_views_collection = None
    
    async def _init_collection(self):
        """Initialize the database collection."""
        if self.paper_views_collection is None:
            self.paper_views_collection = await get_paper_views_collection_async()
    
    async def track_paper_view(
        self, 
        user_id: Optional[str], 
        paper_id: str, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Track a paper view event.
        
        Args:
            user_id: The ID of the user (optional for anonymous views)
            paper_id: The ID of the paper being viewed
            metadata: Additional metadata (e.g., came_from, session_id)
            
        Returns:
            bool: True if tracking was successful, False otherwise
        """
        try:
            await self._init_collection()
            
            activity_data = {
                "paperId": paper_id,
                "timestamp": datetime.utcnow(),
                "metadata": metadata or {}
            }
            
            # Include user_id if provided (for logged-in users)
            if user_id:
                activity_data["userId"] = user_id
                
                # For logged-in users, use upsert to avoid duplicates
                # Replace any existing view by the same user for the same paper
                filter_criteria = {
                    "userId": user_id,
                    "paperId": paper_id
                }
                
                result = await self.paper_views_collection.replace_one(
                    filter_criteria,
                    activity_data,
                    upsert=True
                )
                return True
            else:
                # For anonymous users, still insert new records
                result = await self.paper_views_collection.insert_one(activity_data)
                return result.inserted_id is not None
            
        except Exception as e:
            print(f"Error tracking paper view: {e}")
            return False
    
    async def get_paper_view_count(self, paper_id: str) -> int:
        """
        Get the total number of views for a paper.
        
        Args:
            paper_id: The ID of the paper
            
        Returns:
            int: The number of views
        """
        try:
            await self._init_collection()
            
            count = await self.paper_views_collection.count_documents({
                "paperId": paper_id
            })
            return count
        except Exception as e:
            print(f"Error getting paper view count: {e}")
            return 0
    
    async def get_user_paper_views(self, user_id: str) -> list:
        """
        Get all paper views by a specific user.
        
        Args:
            user_id: The ID of the user
            
        Returns:
            list: List of paper view records
        """
        try:
            await self._init_collection()
            
            views = await self.paper_views_collection.find({
                "userId": user_id
            }).sort("timestamp", -1).to_list(length=None)
            return views
        except Exception as e:
            print(f"Error getting user paper views: {e}")
            return []

# Create a singleton instance
activity_tracking_service = ActivityTrackingService()
