import logging
import shlex
from typing import List, Dict, Any, Optional, Tuple
from bson import ObjectId # type: ignore
from bson.errors import InvalidId # type: ignore
from pymongo.errors import PyMongoError # type: ignore
from pymongo import DESCENDING, ASCENDING # type: ignore
from datetime import datetime, timedelta

from ..database import (
    get_papers_collection_async,
    get_user_actions_collection_async,
    get_users_collection_async,
    get_implementation_progress_collection_async # ADDED
)
from .exceptions import PaperNotFoundException, DatabaseOperationException, ServiceException
from ..schemas_papers import PaperResponse 
from ..schemas_implementation_progress import ImplementationProgress # ADDED
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
        Includes user-specific actions if user_id is provided and implementation progress.
        """
        #self.logger.debug(f"Service: Attempting to get paper by ID: {paper_id} for user: {user_id}")
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

        # Fetch and attach implementation progress
        implementation_progress_collection = await get_implementation_progress_collection_async()
        try:
            # Query by the 'paper_id' field in the implementation_progress collection,
            # using the string paper_id from the function argument.
            
            # Enhanced logging for debugging
            #self.logger.info(f"Service: Attempting to find implementation_progress for paper_id: '{paper_id}' (type: {type(paper_id)})")
            query_filter = {"paper_id": paper_id}
            #self.logger.info(f"Service: Using query filter: {query_filter}")
            
            progress_document = await implementation_progress_collection.find_one(query_filter)
            
            #self.logger.info(f"Service: Result of find_one for paper_id '{paper_id}': {progress_document}")
            if progress_document:
                # paper["implementationProgress"] will be this raw dictionary.
                # Pydantic (in PaperResponse model which includes ImplementationProgress)
                # will parse this. The ImplementationProgress schema has paper_id: PyObjectId,
                # which should handle converting the string paper_id from progress_document
                # into an ObjectId within the model instance.
                paper["implementationProgress"] = progress_document
            else:
                paper["implementationProgress"] = None
        except PyMongoError as e:
            self.logger.error(f"Service: Database error while fetching implementation progress for paper {paper_id}: {e}", exc_info=True)
            # Decide if this should raise an error or just log and continue without progress info
            paper["implementationProgress"] = None # Default to None on error


        #self.logger.debug(f"Service: Successfully fetched paper: {paper_id}")
        return paper # The transformation to PaperResponse with user actions will be handled by utils.transform_paper_async in the router

    async def get_papers_list(
        self,
        skip: int = 0,
        limit: int = 20,
        sort_by: str = "newest", # Default API sort_by, changed from publication_date
        sort_order: str = "desc",        # Default API sort_order
        user_id: Optional[str] = None, # For potential user-specific filtering/ranking in future
        search_query: Optional[str] = None, # For 'search' functionality (title, abstract)
        author: Optional[str] = None, # For 'searchAuthors' functionality
        start_date: Optional[str] = None, # For 'startDate' (publicationDate filter)
        end_date: Optional[str] = None,   # For 'endDate' (publicationDate filter)
        # The following filters are kept assuming their fields are in BasePaper.
        # If not, they should also be removed or handled.
        main_status: Optional[str] = None,
        impl_status: Optional[str] = None,
        tags: Optional[List[str]] = None,
        has_official_impl: Optional[bool] = None,
        venue: Optional[str] = None
        # Removed parameters based on fields not in BasePaper or not yet supported by frontend:
        # min_impl_votes, min_not_impl_votes, min_stars, max_stars,
        # min_update_days, max_update_days, min_creation_days, max_creation_days,
        # has_community_impl, year (replaced by start_date/end_date)
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Retrieves a list of papers with pagination, sorting, and filtering.
        Simplified to reflect currently supported fields and frontend capabilities.
        """
        """
        self.logger.debug(
            f"Service: Fetching papers list. Skip: {skip}, Limit: {limit}, SortBy: {sort_by}, "
            f"SortOrder: {sort_order}, User: {user_id}, SearchQuery: '{search_query}', Author: '{author}', "
            f"Filters: main_status='{main_status}', impl_status='{impl_status}', tags='{tags}', "
            f"has_official_impl='{has_official_impl}', venue='{venue}', "
            f"start_date='{start_date}', end_date='{end_date}'"
        )
        """
        pipeline: List[Dict[str, Any]] = []
        mongo_filter_conditions: List[Dict[str, Any]] = [] # For $match stage after $search or for find()
        is_atlas_search_active = False
        atlas_search_index_name = "default" # Make configurable if needed
        atlas_overall_limit = 2400 # Make configurable if needed

        # 1. Populate mongo_filter_conditions from various non-text filters
        if main_status:
            mongo_filter_conditions.append({"status": main_status})
        if impl_status:
            mongo_filter_conditions.append({"implementabilityStatus": impl_status})
        if tags:
            mongo_filter_conditions.append({"tasks": {"$in": tags}})
        if venue:
            mongo_filter_conditions.append({"proceeding": {"$regex": venue, "$options": "i"}})

        date_filter_parts = {}
        try:
            if start_date:
                dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                date_filter_parts["$gte"] = dt_start
            if end_date:
                dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                if dt_end.hour == 0 and dt_end.minute == 0 and dt_end.second == 0:
                    dt_end = dt_end.replace(hour=23, minute=59, second=59, microsecond=999999)
                date_filter_parts["$lte"] = dt_end
            if date_filter_parts:
                mongo_filter_conditions.append({"publicationDate": date_filter_parts})
        except ValueError as e:
            self.logger.warning(f"Invalid date format for start_date/end_date: {e}. Date filter will be ignored.")

        if has_official_impl is not None:
            if has_official_impl:
                mongo_filter_conditions.append({"pwcUrl": {"$exists": True, "$ne": "", "$ne": None}})
            else:
                mongo_filter_conditions.append({
                    "$or": [{"pwcUrl": {"$exists": False}}, {"pwcUrl": ""}, {"pwcUrl": None}]
                })

        # 2. Build Atlas $search stage if search_query or author are present
        atlas_compound_must: List[Dict[str, Any]] = []
        atlas_compound_should: List[Dict[str, Any]] = []
        atlas_compound_filter: List[Dict[str, Any]] = []

        if search_query:
            is_atlas_search_active = True
            try:
                search_terms = shlex.split(search_query)
            except ValueError:
                search_terms = search_query.split()
                self.logger.warning(f"shlex split failed for search_query '{search_query}', using simple split.")
            
            for term in search_terms:
                atlas_compound_must.append({
                    "text": {"query": term, "path": ["title", "abstract"]}
                })
            atlas_compound_should.append({ # Boost title matches more
                "text": {"query": search_query, "path": "title", "score": {"boost": {"value": 5}}} # Increased boost to 5
            })

        if author:
            is_atlas_search_active = True
            # Add author to the 'filter' part of the compound query if it's a text search on authors
            # Or, if 'authors' is an array of strings and you want exact matches, consider 'term' or 'terms' operator
            atlas_compound_filter.append({"text": {"query": author, "path": "authors"}}) 
        
        if is_atlas_search_active:
            search_stage_compound: Dict[str, Any] = {}
            if atlas_compound_must: search_stage_compound["must"] = atlas_compound_must
            if atlas_compound_should: search_stage_compound["should"] = atlas_compound_should
            if atlas_compound_filter: search_stage_compound["filter"] = atlas_compound_filter
            
            if not search_stage_compound:
                self.logger.warning("Atlas search marked active but no search clauses generated. Falling back.")
                is_atlas_search_active = False
            else:
                search_stage: Dict[str, Any] = {
                    "$search": {"index": atlas_search_index_name, "compound": search_stage_compound}
                }
                if search_query: # Add highlight only if main text search was done
                    search_stage["$search"]["highlight"] = {"path": ["title", "abstract"]}
                pipeline.append(search_stage)

        # 3. Add $match stage for all other (non-text) filters if Atlas Search is active
        if is_atlas_search_active and mongo_filter_conditions:
            pipeline.append({"$match": {"$and": mongo_filter_conditions}})

        # 4. Add score field and filter by score threshold if Atlas search with search_query
        if is_atlas_search_active and search_query:
            pipeline.append({"$addFields": {"score": {"$meta": "searchScore"}}})
            score_threshold = 3.0  # From old app, ensure it's a float
            pipeline.append({"$match": {"score": {"$gt": score_threshold}}})

        # 5. Sorting
        sort_doc: Dict[str, Any] = {}
        parsed_sort_order_val = DESCENDING if sort_order == "desc" else ASCENDING

        if is_atlas_search_active and search_query and (sort_by == "relevance" or sort_by == "newest"):
            # Sort by the 'score' field we added if search_query is active and relevance is requested
            sort_doc = {"score": DESCENDING}
        elif sort_by == "newest":
            sort_doc = {"publicationDate": DESCENDING}
        elif sort_by == "oldest":
            sort_doc = {"publicationDate": ASCENDING}
        elif sort_by == "upvotes":
            sort_doc = {"upvoteCount": parsed_sort_order_val}
        elif sort_by == "publication_date":
            sort_doc = {"publicationDate": parsed_sort_order_val}
        elif sort_by == "title":
            sort_doc = {"title": parsed_sort_order_val}
        else:
            self.logger.warning(f"Unsupported sort_by value: '{sort_by}'. Defaulting to 'newest' or relevance.")
            if is_atlas_search_active and search_query:
                 sort_doc = {"score": DESCENDING} # Default to score if search active
            else:
                 sort_doc = {"publicationDate": DESCENDING} # Default to newest otherwise
        
        papers_collection = await get_papers_collection_async()
        papers_list: List[Dict[str, Any]] = []
        total_papers: int = 0

        try:
            if is_atlas_search_active:
                if sort_doc: # Ensure sort_doc is not empty before adding $sort
                    pipeline.append({"$sort": sort_doc})
                
                # Limit before facet for performance, then paginate within facet
                pipeline.append({"$limit": atlas_overall_limit}) 
                
                facet_stage = {"$facet": {
                    "paginatedResults": [{"$skip": skip}, {"$limit": limit}],
                    "totalCount": [{"$count": "count"}]
                }}
                pipeline.append(facet_stage)
                
                #self.logger.debug(f"Executing Atlas Search aggregation pipeline: {pipeline}")
                agg_results_cursor = await papers_collection.aggregate(pipeline) # Added await
                agg_results = await agg_results_cursor.to_list(length=None) 
                
                if agg_results and agg_results[0]:
                    papers_list = agg_results[0].get('paginatedResults', [])
                    total_papers_list = agg_results[0].get('totalCount', [])
                    if total_papers_list:
                        total_papers = total_papers_list[0].get('count', 0)
                    else: # No documents matched the $search and subsequent $match stages
                        total_papers = 0 
                else: # Should not happen if aggregation runs, but good for safety
                    papers_list = []
                    total_papers = 0

            else: # Standard find query (not Atlas Search)
                # mongo_filter_conditions are used here
                final_query = {"$and": mongo_filter_conditions} if mongo_filter_conditions else {}
                
                #self.logger.debug(f"Executing standard find query: {final_query} with sort: {sort_doc}")
                # pymongo's find().sort() can take a list of tuples or a dict for single field sort
                # For multi-field sort, it must be a list of tuples.
                # Our sort_doc is a dict, e.g. {"publicationDate": -1}
                # If sort_doc can have multiple keys (it doesn't currently), convert to list of tuples
                sort_criteria = list(sort_doc.items()) if sort_doc else None

                cursor = papers_collection.find(final_query)
                if sort_criteria:
                    cursor = cursor.sort(sort_criteria)
                cursor = cursor.skip(skip).limit(limit)
                
                papers_list = await cursor.to_list(length=limit)
                total_papers = await papers_collection.count_documents(final_query)
            
            #self.logger.debug(f"Service: Successfully fetched {len(papers_list)} papers. Total matching: {total_papers}")
            return papers_list, total_papers

        except PyMongoError as e:
            self.logger.error(f"Service: Database error while fetching papers list: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching papers list: {e}")
        except Exception as e:
            self.logger.error(f"Service: Unexpected error during paper list retrieval: {e}", exc_info=True)
            raise ServiceException(f"An unexpected error occurred: {e}")

    # ... any other methods ...