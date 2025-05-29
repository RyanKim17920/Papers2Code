import logging
from typing import List, Dict, Any, Optional, Tuple, Union
from bson import ObjectId # type: ignore
from bson.errors import InvalidId # type: ignore
from pymongo.errors import PyMongoError # type: ignore
from pymongo import DESCENDING, ASCENDING # type: ignore
from datetime import datetime, timezone, timedelta # Added timedelta

from ..database import (
    get_papers_collection_async,
    get_user_actions_collection_async,
    get_paper_links_collection_async,
    get_users_collection_async
)
from .exceptions import PaperNotFoundException, DatabaseOperationException, ServiceException
from ..schemas_papers import PaperResponse # Assuming PaperResponse is still relevant for type hinting
from ..shared import (
    IMPL_STATUS_VOTING,
    IMPL_STATUS_COMMUNITY_IMPLEMENTABLE,
    IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE,
    MAIN_STATUS_NOT_STARTED,
    MAIN_STATUS_IN_PROGRESS,
    MAIN_STATUS_COMPLETED,
    MAIN_STATUS_ABANDONED,
    MAIN_STATUS_NOT_IMPLEMENTABLE
)


logger = logging.getLogger(__name__)

class PaperViewService:
    """
    Service for handling paper viewing logic, including fetching papers,
    details, and user-specific views.
    """
    def __init__(self):
        # Ensure logger is initialized if not done by a base class or decorator
        self.logger = logging.getLogger(__name__)
        # Initialize papers_collection here if it's meant to be a member
        # Or fetch it in each method if preferred for async context
        # For now, fetching in each method as per previous async patterns

    async def get_paper_by_id(self, paper_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves a single paper by its ID.
        Includes user-specific actions if user_id is provided.
        """
        self.logger.debug(f"Service: Attempting to get paper by ID: {paper_id} for user: {user_id}")
        try:
            obj_paper_id = ObjectId(paper_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid paper ID format: {paper_id}")
            raise PaperNotFoundException(f"Invalid paper ID format: {paper_id}")

        papers_collection = await get_papers_collection_async()
        try:
            paper = await papers_collection.find_one({"_id": obj_paper_id})
        except PyMongoError as e:
            self.logger.error(f"Service: Database error while fetching paper {paper_id}: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching paper {paper_id}: {e}")

        if not paper:
            self.logger.warning(f"Service: Paper with ID {paper_id} not found.")
            raise PaperNotFoundException(f"Paper with ID {paper_id} not found.")

        self.logger.debug(f"Service: Successfully fetched paper: {paper_id}")
        return paper # The transformation to PaperResponse with user actions will be handled by utils.transform_paper_async in the router

    async def get_papers_list(
        self,
        skip: int = 0,
        limit: int = 20,
        sort_by: str = "publication_date",
        sort_order: str = "desc",
        user_id: Optional[str] = None, # For potential user-specific filtering/ranking in future
        main_status: Optional[str] = None,
        impl_status: Optional[str] = None,
        min_impl_votes: Optional[int] = None,
        min_not_impl_votes: Optional[int] = None,
        search_query: Optional[str] = None,
        tags: Optional[List[str]] = None,
        min_stars: Optional[int] = None,
        max_stars: Optional[int] = None,
        min_update_days: Optional[int] = None, # Days since last update
        max_update_days: Optional[int] = None, # Days since last update
        min_creation_days: Optional[int] = None, # Days since creation
        max_creation_days: Optional[int] = None, # Days since creation
        has_official_impl: Optional[bool] = None,
        has_community_impl: Optional[bool] = None, # Placeholder, requires complex logic
        venue: Optional[str] = None,
        author: Optional[str] = None,
        year: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Retrieves a list of papers with pagination, sorting, and filtering.
        """
        self.logger.debug(f"Service: Fetching papers list. Skip: {skip}, Limit: {limit}, SortBy: {sort_by}, SortOrder: {sort_order}, User: {user_id}, Filters: {{...}}")

        query: Dict[str, Any] = {}

        # Apply filters
        if main_status:
            query["main_status"] = main_status
        if impl_status:
            query["implementability.status"] = impl_status
        if min_impl_votes is not None:
            query["implementability.votes_for_implementable"] = {"$gte": min_impl_votes}
        if min_not_impl_votes is not None:
            query["implementability.votes_for_not_implementable"] = {"$gte": min_not_impl_votes}
        
        if search_query:            
            query["$or"] = [
                {"title": {"$regex": search_query, "$options": "i"}},
                {"abstract": {"$regex": search_query, "$options": "i"}},
                # Assuming authors_display_name is an array of strings like ["Author A, Author B", "Author C"]
                # or a single string. If it's an array of objects, path needs to be adjusted.
                {"authors_display_name": {"$regex": search_query, "$options": "i"}} 
            ]
        if tags:
            query["tags"] = {"$in": tags} 

        if min_stars is not None and max_stars is not None:
            query["stars"] = {"$gte": min_stars, "$lte": max_stars}
        elif min_stars is not None:
            query["stars"] = {"$gte": min_stars}
        elif max_stars is not None:
            query["stars"] = {"$lte": max_stars}

        now = datetime.now(timezone.utc)
        # Date-based filtering - Placeholder logic, needs schema alignment
        # Example: if 'last_update_date' is stored as datetime
        if min_update_days is not None:
            query["last_update_date"] = {"$gte": now - timedelta(days=min_update_days)}
        if max_update_days is not None:
            query["last_update_date"] = {"$lte": now - timedelta(days=max_update_days)}
        if min_creation_days is not None:
            query["creation_date"] = {"$gte": now - timedelta(days=min_creation_days)}
        if max_creation_days is not None:
            query["creation_date"] = {"$lte": now - timedelta(days=max_creation_days)}

        if has_official_impl is not None:
            # Assumes 'links.official_github_url' stores the official link URL string
            if has_official_impl:
                query["links.official_github_url"] = {"$exists": True, "$ne": "", "$ne": None}
            else:
                query["$or"] = [
                    {"links.official_github_url": {"$exists": False}},
                    {"links.official_github_url": ""},
                    {"links.official_github_url": None}
                ]
        
        # has_community_impl is more complex. 
        # It might require a join/lookup or a denormalized field on the paper document.
        # For now, this filter is a placeholder and won't work without schema support or a more complex query.
        if has_community_impl is not None:
            self.logger.warning("Filtering by 'has_community_impl' is not fully implemented and may not work as expected.")
            # Example: query["has_community_links_flag"] = has_community_impl # if such a flag exists

        if venue:
            query["venue"] = {"$regex": venue, "$options": "i"}
        if author: 
            # This assumes 'authors_parsed' is an array of arrays of strings, e.g., [["First Last"], ["Another One"]]
            # Or 'authors_display_name' is an array of strings like ["Name1", "Name2"]
            # Adjust path and query structure based on your actual schema for authors.
            # If 'authors_display_name' is a single string, this won't work directly.
            query["authors_display_name"] = {"$regex": author, "$options": "i"} # Simple regex match on display names

        if year:
            query["publication_date"] = {
                "$gte": datetime(year, 1, 1, tzinfo=timezone.utc),
                "$lt": datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            }

        mongo_sort_order = DESCENDING if sort_order == "desc" else ASCENDING
        sort_field = sort_by
        # Map API sort_by fields to actual database field names if they differ
        if sort_by == "publication_date": # Default
            sort_field = "publication_date"
        elif sort_by == "stars":
            sort_field = "stars" # Assumes a direct field named 'stars'
        elif sort_by == "last_update":
            sort_field = "last_update_date" # Assumes 'last_update_date'
        elif sort_by == "creation_date":
            sort_field = "creation_date"
        elif sort_by == "implementability_score":
            sort_field = "implementability.score" # Example path
        elif sort_by == "title":
            sort_field = "title_for_sort" # Assumes a case-insensitive sort field or use default title
        # Add more valid sort fields as needed, otherwise, it might sort by a non-existent field or error.

        papers_collection = await get_papers_collection_async()
        try:
            self.logger.debug(f"Executing paper list query: {query} with sort: {sort_field} {mongo_sort_order}")
            cursor = papers_collection.find(query).sort(sort_field, mongo_sort_order).skip(skip).limit(limit)
            papers_list = await cursor.to_list(length=limit)
            total_papers = await papers_collection.count_documents(query)
        except PyMongoError as e:
            self.logger.error(f"Service: Database error while fetching papers list: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching papers list: {e}")
        except Exception as e:
            self.logger.error(f"Service: Unexpected error during paper list retrieval: {e}", exc_info=True)
            raise ServiceException(f"An unexpected error occurred: {e}")

        self.logger.debug(f"Service: Successfully fetched {len(papers_list)} papers. Total matching: {total_papers}")
        return papers_list, total_papers

    async def get_paper_details_with_community_links(self, paper_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves a single paper by its ID, and also fetches its community-submitted links.
        """
        self.logger.debug(f"Service: Getting paper details and community links for paper_id: {paper_id}, user_id: {user_id}")
        
        paper_doc = await self.get_paper_by_id(paper_id, user_id) # Reuses the existing method

        paper_links_collection = await get_paper_links_collection_async()
        try:
            obj_paper_id = ObjectId(paper_id) 
            links_cursor = paper_links_collection.find({"paper_id": obj_paper_id, "is_approved": True})
            community_links = await links_cursor.to_list(length=None) 
        except InvalidId:
            self.logger.error(f"Service: Invalid paper ID {paper_id} encountered unexpectedly in get_paper_details_with_community_links.")
            raise PaperNotFoundException(f"Invalid paper ID format: {paper_id}")
        except PyMongoError as e:
            self.logger.error(f"Service: Database error fetching community links for paper {paper_id}: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching community links for paper {paper_id}: {e}")

        paper_doc["community_links"] = [
            {
                "link_id": str(link["_id"]),
                "url": link["url"],
                "description": link.get("description", ""),
                "submitted_by": str(link["user_id"]), 
                "submission_date": link["submission_date"],
                "link_type": link.get("link_type", "other")
            } for link in community_links
        ]
        
        self.logger.debug(f"Service: Successfully fetched paper details with {len(community_links)} community links for paper_id: {paper_id}")
        return paper_doc

    async def get_papers_by_arxiv_ids(self, arxiv_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Retrieves multiple papers based on a list of arXiv IDs.
        """
        self.logger.debug(f"Service: Attempting to get papers by arXiv IDs: {arxiv_ids}")
        if not arxiv_ids:
            return []

        papers_collection = await get_papers_collection_async()
        query = {"arxiv_id": {"$in": arxiv_ids}}
        try:
            cursor = papers_collection.find(query)
            papers_list = await cursor.to_list(length=len(arxiv_ids))
        except PyMongoError as e:
            self.logger.error(f"Service: Database error while fetching papers by arXiv IDs: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching papers by arXiv IDs: {e}")

        self.logger.debug(f"Service: Successfully fetched {len(papers_list)} papers for arXiv IDs: {arxiv_ids}")
        return papers_list

    async def get_distinct_tags(self) -> List[str]:
        """
        Retrieves a list of all distinct tags present in the papers collection.
        """
        self.logger.debug("Service: Attempting to get distinct tags.")
        papers_collection = await get_papers_collection_async()
        try:
            distinct_tags = await papers_collection.distinct("tags")
        except PyMongoError as e:
            self.logger.error(f"Service: Database error while fetching distinct tags: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching distinct tags: {e}")
        
        filtered_tags = [tag for tag in distinct_tags if tag]
        self.logger.debug(f"Service: Successfully fetched {len(filtered_tags)} distinct tags.")
        return filtered_tags

    async def get_distinct_venues(self) -> List[str]:
        """
        Retrieves a list of all distinct venues from the papers collection.
        """
        self.logger.debug("Service: Attempting to get distinct venues.")
        papers_collection = await get_papers_collection_async()
        try:
            distinct_venues = await papers_collection.distinct("venue")
        except PyMongoError as e:
            self.logger.error(f"Service: Database error while fetching distinct venues: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching distinct venues: {e}")

        filtered_venues = [venue for venue in distinct_venues if venue] 
        self.logger.debug(f"Service: Successfully fetched {len(filtered_venues)} distinct venues.")
        return filtered_venues

    async def get_distinct_authors(self) -> List[str]:
        """
        Retrieves a list of all distinct author display names.
        """
        self.logger.debug("Service: Attempting to get distinct authors.")
        papers_collection = await get_papers_collection_async()
        try:
            # This assumes `authors_display_name` is an array of strings where each string can be a list of authors.
            # Or it's a single string of authors. `distinct` on an array field flattens it.
            distinct_authors_flat = await papers_collection.distinct("authors_display_name")
        except PyMongoError as e:
            self.logger.error(f"Service: Database error while fetching distinct authors: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching distinct authors: {e}")

        filtered_authors = [author for author in distinct_authors_flat if author and isinstance(author, str)]
        self.logger.debug(f"Service: Successfully fetched {len(filtered_authors)} distinct authors.")
        return filtered_authors

    async def get_paper_count_by_status(self) -> Dict[str, int]:
        """
        Retrieves counts of papers grouped by their main_status and implementability.status.
        """
        self.logger.debug("Service: Getting paper counts by status.")
        papers_collection = await get_papers_collection_async()
        pipeline = [
            {
                "$facet": {
                    "by_main_status": [
                        {"$group": {"_id": "$main_status", "count": {"$sum": 1}}}
                    ],
                    "by_impl_status": [
                        {"$group": {"_id": "$implementability.status", "count": {"$sum": 1}}}
                    ]
                }
            }
        ]
        try:
            results = await papers_collection.aggregate(pipeline).to_list(length=1)
        except PyMongoError as e:
            self.logger.error(f"Service: Database error while getting paper counts by status: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error getting paper counts by status: {e}")

        status_counts: Dict[str, int] = {}
        if results and results[0]:
            for item in results[0].get("by_main_status", []):
                if item["_id"]: 
                    status_counts[f"main_{item['_id'].lower().replace(' ', '_')}"] = item["count"]
            for item in results[0].get("by_impl_status", []):
                if item["_id"]: 
                     status_counts[f"impl_{item['_id'].lower().replace(' ', '_')}"] = item["count"]
        
        self.logger.debug(f"Service: Successfully fetched paper counts by status: {status_counts}")
        return status_counts

    async def record_paper_view(self, paper_id: str, user_id: Optional[str] = None, ip_address: Optional[str] = None) -> None:
        """
        Records a view for a given paper.
        """
        self.logger.debug(f"Service: Recording view for paper_id: {paper_id}, user_id: {user_id}, ip: {ip_address}")
        try:
            obj_paper_id = ObjectId(paper_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid paper ID format for view recording: {paper_id}")
            raise PaperNotFoundException(f"Invalid paper ID format for view recording: {paper_id}")

        papers_collection = await get_papers_collection_async()
        try:
            update_result = await papers_collection.update_one(
                {"_id": obj_paper_id},
                {"$inc": {"view_count": 1}, "$set": {"last_viewed_at": datetime.now(timezone.utc)}}
            )
            if update_result.matched_count == 0:
                self.logger.warning(f"Service: Paper with ID {paper_id} not found during view recording.")
                raise PaperNotFoundException(f"Paper with ID {paper_id} not found for view recording.")
        except PyMongoError as e:
            self.logger.error(f"Service: Database error while recording view for paper {paper_id}: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error recording view for paper {paper_id}: {e}")
        except InvalidId: 
             self.logger.warning(f"Service: Invalid user ID format for view recording: {user_id}")
             pass 

        self.logger.info(f"Service: View recorded successfully for paper_id: {paper_id}")
        return
