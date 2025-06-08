import logging
import shlex
import time # Add time import for performance logging
from typing import List, Dict, Any, Optional, Tuple
from bson import ObjectId  # type: ignore
from bson.errors import InvalidId  # type: ignore
from pymongo.errors import PyMongoError  # type: ignore
from pymongo import DESCENDING, ASCENDING  # type: ignore
from datetime import datetime

from ..database import (
    get_papers_collection_async,
    get_implementation_progress_collection_async,
)
from .exceptions import PaperNotFoundException, DatabaseOperationException, ServiceException


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
            query_filter = {"paperId": paper_id} # No matter what DO NOT CHANGE THIS LINE I SWEAR
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
        sort_by: str = "newest",
        sort_order: str = "desc",
        user_id: Optional[str] = None,
        search_query: Optional[str] = None,
        author: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        main_status: Optional[str] = None,
        impl_status: Optional[str] = None,
        tags: Optional[List[str]] = None,
        has_official_impl: Optional[bool] = None,
        venue: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        service_start_time = time.time()
        self.logger.info(f"get_papers_list called with: skip={skip}, limit={limit}, sort_by=\'{sort_by}\', searchQuery=\'{search_query}\', author=\'{author}\'")
        
        pipeline: List[Dict[str, Any]] = []
        mongo_filter_conditions: List[Dict[str, Any]] = [] # For $match stage after $search or for find()
        
        atlas_search_index_name = "default" 
        atlas_overall_limit = 2400 

        atlas_compound_must: List[Dict[str, Any]] = []
        atlas_compound_should: List[Dict[str, Any]] = []
        atlas_compound_filter: List[Dict[str, Any]] = [] # Filters for $search stage's 'filter' clause

        # Determine if Atlas Search will be active.
        # Atlas Search is active if a text search_query or author filter is provided.
        is_atlas_search_active = bool(search_query or author)

        # Populate mongo_filter_conditions (for the non-Atlas search path)
        # AND populate atlas_compound_filter (if Atlas Search is active)

        if main_status:
            mongo_filter_conditions.append({"status": main_status})
            if is_atlas_search_active:
                atlas_compound_filter.append({"term": {"query": main_status, "path": "status"}})
        
        if impl_status:
            mongo_filter_conditions.append({"implementabilityStatus": impl_status})
            if is_atlas_search_active:
                atlas_compound_filter.append({"term": {"query": impl_status, "path": "implementabilityStatus"}})
        
        if tags:
            mongo_filter_conditions.append({"tasks": {"$in": tags}})
            if is_atlas_search_active:
                # Assuming 'tasks' is an array of strings and indexed appropriately for 'terms' query
                atlas_compound_filter.append({"terms": {"query": tags, "path": "tasks"}})
        
        if venue:
            mongo_filter_conditions.append({"proceeding": {"$regex": venue, "$options": "i"}})
            if is_atlas_search_active:
                # Atlas 'regex' is case-sensitive by default.
                # For case-insensitivity, ensure the index analyzer handles it, or adjust the regex pattern.
                # allowAnalyzedField: True can be used if the field is analyzed in a way that supports the regex.
                atlas_compound_filter.append({"regex": {"query": venue, "path": "proceeding", "allowAnalyzedField": True}})

        date_filter_parts_mongo = {}
        date_filter_parts_atlas_range = {} # For Atlas 'range' query
        try:
            if start_date:
                dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                date_filter_parts_mongo["$gte"] = dt_start
                if is_atlas_search_active:
                    date_filter_parts_atlas_range["gte"] = dt_start
            
            if end_date:
                dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                if dt_end.hour == 0 and dt_end.minute == 0 and dt_end.second == 0:
                    dt_end = dt_end.replace(hour=23, minute=59, second=59, microsecond=999999)
                date_filter_parts_mongo["$lte"] = dt_end
                if is_atlas_search_active:
                    date_filter_parts_atlas_range["lte"] = dt_end
            
            if date_filter_parts_mongo:
                mongo_filter_conditions.append({"publicationDate": date_filter_parts_mongo})
            if is_atlas_search_active and date_filter_parts_atlas_range:
                # Ensure 'publicationDate' is indexed as a date type in Atlas Search
                atlas_compound_filter.append({"range": {"path": "publicationDate", **date_filter_parts_atlas_range}})
        except ValueError as e:
            self.logger.warning(f"Invalid date format for start_date/end_date: {e}. Date filter will be ignored.")

        if has_official_impl is not None:
            if has_official_impl:
                mongo_filter_conditions.append({"pwc_url": {"$exists": True, "$nin": ["", None]}})
                if is_atlas_search_active:
                    atlas_compound_filter.append({
                        "compound": {
                            "must": [{"exists": {"path": "pwc_url"}}],
                            "mustNot": [{"term": {"query": "", "path": "pwc_url"}}] 
                        }
                    })
            else: # has_official_impl is False
                mongo_filter_conditions.append({
                    "$or": [{"pwc_url": {"$exists": False}}, {"pwc_url": ""}, {"pwc_url": None}]
                })
                if is_atlas_search_active:
                    atlas_compound_filter.append({
                        "compound": {
                            "should": [
                                {"bool": {"mustNot": [{"exists": {"path": "pwc_url"}}]}}, 
                                {"term": {"query": "", "path": "pwc_url"}}
                            ],
                            "minimumShouldMatch": 1 
                        }
                    })

        # Build Atlas $search stage components
        if search_query:
            try:
                search_terms = shlex.split(search_query)
            except ValueError:
                search_terms = search_query.split()
                self.logger.warning(f"shlex split failed for search_query \'{search_query}\', using simple split.")
            
            for term in search_terms:
                atlas_compound_must.append({"text": {"query": term, "path": ["title", "abstract"]}})
            atlas_compound_should.append({"text": {"query": search_query, "path": "title", "score": {"boost": {"value": 5}}}})

        if author:
            # Author queries are added to the 'filter' part of the compound $search operator
            atlas_compound_filter.append({"text": {"query": author, "path": "authors"}}) 
        
        if is_atlas_search_active:
            search_stage_compound: Dict[str, Any] = {}
            if atlas_compound_must:
                search_stage_compound["must"] = atlas_compound_must
            if atlas_compound_should:
                search_stage_compound["should"] = atlas_compound_should
            if atlas_compound_filter:
                search_stage_compound["filter"] = atlas_compound_filter  # Now includes all filters
            
            # If compound is empty (e.g. empty search_query/author and no other Atlas filters triggered),
            # then $search stage is not meaningful. Fallback to non-search.
            if not search_stage_compound:
                self.logger.warning("Atlas search compound operator is empty. Falling back to standard find.")
                is_atlas_search_active = False 
            
            if is_atlas_search_active: # Re-check after potential fallback
                search_stage: Dict[str, Any] = {
                    "$search": {"index": atlas_search_index_name, "compound": search_stage_compound}
                }
                if search_query: # Add highlight only if main text search was done
                    search_stage["$search"]["highlight"] = {"path": ["title", "abstract"]}
                pipeline.append(search_stage)

        # REMOVED: The $match stage for mongo_filter_conditions when is_atlas_search_active is true.
        # These filters are now part of the $search stage's 'filter' clause.

        # Add score field and filter by score threshold if Atlas search with search_query
        if is_atlas_search_active and search_query: # Score is relevant if there was a text search query
            pipeline.append({"$addFields": {"score": {"$meta": "searchScore"}}})
            score_threshold = 3.0 
            pipeline.append({"$match": {"score": {"$gt": score_threshold}}})

        # Sorting
        sort_doc: Dict[str, Any] = {}
        parsed_sort_order_val = DESCENDING if sort_order == "desc" else ASCENDING

        # If Atlas search was active due to search_query, and sort is relevance/newest, prefer score.
        if is_atlas_search_active and search_query and (sort_by == "relevance" or sort_by == "newest"):
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
            self.logger.warning(f"Unsupported sort_by value: \'{sort_by}\'. Defaulting.")
            if is_atlas_search_active and search_query:
                 sort_doc = {"score": DESCENDING} 
            else:
                 sort_doc = {"publicationDate": DESCENDING}
        
        papers_collection = await get_papers_collection_async()
        papers_list: List[Dict[str, Any]] = []
        total_papers: int = 0

        db_call_overall_start_time = time.time()
        try:
            if is_atlas_search_active:
                if sort_doc: 
                    pipeline.append({"$sort": sort_doc})
                
                pipeline.append({"$limit": atlas_overall_limit}) 
                
                facet_stage = {"$facet": {
                    "paginatedResults": [{"$skip": skip}, {"$limit": limit}],
                    "totalCount": [{"$count": "count"}]
                }}
                pipeline.append(facet_stage)
                
                self.logger.info(f"Executing Atlas Search aggregation pipeline (first 3 stages if long, else full): {pipeline[:3] if len(pipeline) > 3 else pipeline}")
                
                agg_pipeline_start_time = time.time()
                agg_results_cursor = await papers_collection.aggregate(pipeline)
                self.logger.info(f"Atlas Search papers_collection.aggregate call took: {time.time() - agg_pipeline_start_time:.4f}s")

                agg_fetch_start_time = time.time()
                agg_results = await agg_results_cursor.to_list(length=None) 
                self.logger.info(f"Atlas Search agg_results_cursor.to_list() took: {time.time() - agg_fetch_start_time:.4f}s")
                
                if agg_results and agg_results[0]:
                    papers_list = agg_results[0].get('paginatedResults', [])
                    total_papers_list = agg_results[0].get('totalCount', [])
                    if total_papers_list:
                        total_papers = total_papers_list[0].get('count', 0)
                    else: 
                        total_papers = 0 
                else: 
                    papers_list = []
                    total_papers = 0

            else: # Standard find query (not Atlas Search)
                # mongo_filter_conditions are used here
                final_query = {"$and": mongo_filter_conditions} if mongo_filter_conditions else {}
                
                self.logger.info(f"Executing standard find query: {final_query} with sort: {sort_doc}, skip: {skip}, limit: {limit}")
                sort_criteria = list(sort_doc.items()) if sort_doc else None

                find_call_start_time = time.time()
                cursor = papers_collection.find(final_query)
                if sort_criteria:
                    cursor = cursor.sort(sort_criteria)
                cursor = cursor.skip(skip).limit(limit)
                self.logger.info(f"Standard find query construction (before to_list) took: {time.time() - find_call_start_time:.4f}s")
                
                find_fetch_start_time = time.time()
                papers_list = await cursor.to_list(length=limit)
                self.logger.info(f"Standard find cursor.to_list() took: {time.time() - find_fetch_start_time:.4f}s")
                
                count_start_time = time.time()
                if not final_query: # No filters applied, use estimated count
                    total_papers = await papers_collection.estimated_document_count()
                    self.logger.info(f"Standard papers_collection.estimated_document_count() took: {time.time() - count_start_time:.4f}s")
                else: # Filters are present, need an accurate count for the filtered set
                    total_papers = await papers_collection.count_documents(final_query)
                    self.logger.info(f"Standard papers_collection.count_documents({final_query}) took: {time.time() - count_start_time:.4f}s")
            
            self.logger.info(f"DB interaction block (querying and fetching) took: {time.time() - db_call_overall_start_time:.4f}s")
            self.logger.info(f"Total time for get_papers_list (before return): {time.time() - service_start_time:.4f}s")
            return papers_list, total_papers

        except PyMongoError as e:
            self.logger.error(f"Service: Database error while fetching papers list: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching papers list: {e}")
        except Exception as e:
            self.logger.error(f"Service: Unexpected error during paper list retrieval: {e}", exc_info=True)
            raise ServiceException(f"An unexpected error occurred: {e}")

    # ... any other methods ...