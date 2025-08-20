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
            # Updated: Now we search by _id since the implementation progress document's _id is the paper_id
            try:
                paper_obj_id = ObjectId(paper_id)
                # First try with ObjectId
                query_filter = {"_id": paper_obj_id}
                self.logger.info(f"Service: Using ObjectId query filter: {query_filter}")
                progress_document = await implementation_progress_collection.find_one(query_filter)
                
                # If not found with ObjectId, try with string (backward compatibility)
                if not progress_document:
                    query_filter = {"_id": paper_id}
                    self.logger.info(f"Service: Using string query filter: {query_filter}")
                    progress_document = await implementation_progress_collection.find_one(query_filter)
            except Exception:
                # If ObjectId conversion fails, just try with string
                query_filter = {"_id": paper_id}
                self.logger.info(f"Service: Using string query filter: {query_filter}")
                progress_document = await implementation_progress_collection.find_one(query_filter)
            
            self.logger.info(f"Service: Result of find_one for paper_id '{paper_id}': {progress_document}")
            if progress_document:
                # Convert the raw document to a proper ImplementationProgress model
                # This ensures that the _id field is converted to id and all other fields are properly validated
                from ..schemas.implementation_progress import ImplementationProgress
                progress_model = ImplementationProgress(**progress_document)
                # Use model_dump() without by_alias to get proper field names, then ensure id is included
                progress_dict = progress_model.model_dump()
                progress_dict['id'] = str(progress_model.id)  # Ensure id is a string
                self.logger.info(f"Service: Progress model ID: {progress_model.id}")
                self.logger.info(f"Service: Progress dict: {progress_dict}")
                paper["implementationProgress"] = progress_dict
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
        self.logger.info(f"get_papers_list called with: skip={skip}, limit={limit}, sort_by='{sort_by}', searchQuery='{search_query}', author='{author}'")
        
        # Check if Atlas Search will be active
        is_atlas_search_active = bool(search_query or author)
        
        if is_atlas_search_active:
            # TWO-PHASE APPROACH FOR ATLAS SEARCH
            return await self._get_papers_list_atlas_two_phase(
                skip, limit, sort_by, sort_order, user_id, search_query, author,
                start_date, end_date, main_status, impl_status, tags, has_official_impl, venue
            )
        else:
            # STANDARD MONGODB QUERY (unchanged)
            return await self._get_papers_list_standard(
                skip, limit, sort_by, sort_order, user_id, search_query, author,
                start_date, end_date, main_status, impl_status, tags, has_official_impl, venue
            )

    async def _get_papers_list_atlas_two_phase(
        self,
        skip: int, limit: int, sort_by: str, sort_order: str, user_id: Optional[str],
        search_query: Optional[str], author: Optional[str], start_date: Optional[str],
        end_date: Optional[str], main_status: Optional[str], impl_status: Optional[str],
        tags: Optional[List[str]], has_official_impl: Optional[bool], venue: Optional[str]
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Two-phase Atlas Search: Get IDs first, then fetch full documents only for displayed items"""
        
        atlas_search_index_name = "default"
        papers_collection = await get_papers_collection_async()
        
        # PHASE 1: Get just IDs and scores (minimal data transfer)
        phase1_pipeline = []
        atlas_compound_must: List[Dict[str, Any]] = []
        atlas_compound_should: List[Dict[str, Any]] = []
        atlas_compound_filter: List[Dict[str, Any]] = []

        # Build search conditions
        if search_query:
            try:
                search_terms = shlex.split(search_query)
            except ValueError:
                search_terms = search_query.split()
                self.logger.warning(f"shlex split failed for search_query '{search_query}', using simple split.")
            
            for term in search_terms:
                atlas_compound_must.append({"text": {"query": term, "path": ["title", "abstract"]}})
            atlas_compound_should.append({"text": {"query": search_query, "path": "title", "score": {"boost": {"value": 5}}}})

        if author:
            atlas_compound_filter.append({"text": {"query": author, "path": "authors"}})

        # Add other filters to Atlas compound
        if main_status:
            atlas_compound_filter.append({"term": {"query": main_status, "path": "status"}})
        if impl_status:
            atlas_compound_filter.append({"term": {"query": impl_status, "path": "implementabilityStatus"}})
        if tags:
            atlas_compound_filter.append({"terms": {"query": tags, "path": "tasks"}})
        if venue:
            atlas_compound_filter.append({"regex": {"query": venue, "path": "proceeding", "allowAnalyzedField": True}})
        
        # Date filters
        try:
            date_filter_parts_atlas_range = {}
            if start_date:
                dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                date_filter_parts_atlas_range["gte"] = dt_start
            if end_date:
                dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                if dt_end.hour == 0 and dt_end.minute == 0 and dt_end.second == 0:
                    dt_end = dt_end.replace(hour=23, minute=59, second=59, microsecond=999999)
                date_filter_parts_atlas_range["lte"] = dt_end
            if date_filter_parts_atlas_range:
                atlas_compound_filter.append({"range": {"path": "publicationDate", **date_filter_parts_atlas_range}})
        except ValueError as e:
            self.logger.warning(f"Invalid date format: {e}. Date filter ignored.")

        # Official implementation filter
        if has_official_impl is not None:
            if has_official_impl:
                atlas_compound_filter.append({
                    "compound": {
                        "must": [{"exists": {"path": "pwc_url"}}],
                        "mustNot": [{"term": {"query": "", "path": "pwc_url"}}]
                    }
                })
            else:
                atlas_compound_filter.append({
                    "compound": {
                        "should": [
                            {"bool": {"mustNot": [{"exists": {"path": "pwc_url"}}]}},
                            {"term": {"query": "", "path": "pwc_url"}}
                        ],
                        "minimumShouldMatch": 1
                    }
                })

        # Build Atlas search stage
        search_stage_compound: Dict[str, Any] = {}
        if atlas_compound_must:
            search_stage_compound["must"] = atlas_compound_must
        if atlas_compound_should:
            search_stage_compound["should"] = atlas_compound_should
        if atlas_compound_filter:
            search_stage_compound["filter"] = atlas_compound_filter

        if not search_stage_compound:
            self.logger.warning("Atlas search compound is empty, falling back to standard query")
            return await self._get_papers_list_standard(
                skip, limit, sort_by, sort_order, user_id, search_query, author,
                start_date, end_date, main_status, impl_status, tags, has_official_impl, venue
            )

        # Phase 1 pipeline: Get IDs only
        search_stage = {"$search": {"index": atlas_search_index_name, "compound": search_stage_compound}}
        if search_query:
            search_stage["$search"]["highlight"] = {"path": ["title", "abstract"]}
        
        phase1_pipeline.append(search_stage)
        
        # Add score field and filter if needed
        if search_query:
            phase1_pipeline.append({"$addFields": {"score": {"$meta": "searchScore"}}})
            phase1_pipeline.append({"$match": {"score": {"$gt": 3.0}}})

        # Minimal projection - just _id and score for sorting
        phase1_pipeline.append({"$project": {"_id": 1, "score": 1, "publicationDate": 1, "upvoteCount": 1, "title": 1}})
        
        # Sorting
        sort_doc: Dict[str, Any] = {}
        parsed_sort_order_val = DESCENDING if sort_order == "desc" else ASCENDING
        
        if search_query and (sort_by == "relevance" or sort_by == "newest"):
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
            sort_doc = {"score": DESCENDING} if search_query else {"publicationDate": DESCENDING}
        
        if sort_doc:
            phase1_pipeline.append({"$sort": sort_doc})

        # Get total count and paginated IDs
        phase1_pipeline.append({
            "$facet": {
                "paginatedResults": [{"$skip": skip}, {"$limit": limit}],
                "totalCount": [{"$count": "count"}]
            }
        })

        phase1_start = time.time()
        self.logger.info("PHASE 1: Getting IDs only from Atlas Search")
        
        try:
            agg_results_cursor = await papers_collection.aggregate(phase1_pipeline)
            agg_results = await agg_results_cursor.to_list(length=None)
            
            self.logger.info(f"PHASE 1 completed in {time.time() - phase1_start:.4f}s")
            
            if not agg_results or not agg_results[0]:
                return [], 0
                
            paginated_results = agg_results[0].get('paginatedResults', [])
            total_count_list = agg_results[0].get('totalCount', [])
            total_papers = total_count_list[0].get('count', 0) if total_count_list else 0
            
            if not paginated_results:
                return [], total_papers
            
            # PHASE 2: Get full documents for displayed items only
            phase2_start = time.time()
            self.logger.info(f"PHASE 2: Fetching full documents for {len(paginated_results)} items")
            
            # Extract IDs in the correct order
            paper_ids = [result["_id"] for result in paginated_results]
            
            # Fetch full documents maintaining order
            full_papers = await papers_collection.find(
                {"_id": {"$in": paper_ids}}
            ).to_list(length=None)
            
            # Create a mapping for quick lookup
            papers_map = {str(paper["_id"]): paper for paper in full_papers}
            
            # Maintain the original order from phase 1
            ordered_papers = []
            for paper_id in paper_ids:
                if str(paper_id) in papers_map:
                    ordered_papers.append(papers_map[str(paper_id)])
            
            self.logger.info(f"PHASE 2 completed in {time.time() - phase2_start:.4f}s")
            self.logger.info(f"Total two-phase Atlas Search took: {time.time() - phase1_start:.4f}s")
            
            return ordered_papers, total_papers
            
        except PyMongoError as e:
            self.logger.error(f"Atlas Search two-phase error: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error in Atlas Search: {e}")

    async def _get_papers_list_standard(
        self,
        skip: int, limit: int, sort_by: str, sort_order: str, user_id: Optional[str],
        search_query: Optional[str], author: Optional[str], start_date: Optional[str],
        end_date: Optional[str], main_status: Optional[str], impl_status: Optional[str],
        tags: Optional[List[str]], has_official_impl: Optional[bool], venue: Optional[str]
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Standard MongoDB find query (no Atlas Search)"""
        
        service_start_time = time.time()
        papers_collection = await get_papers_collection_async()
        mongo_filter_conditions: List[Dict[str, Any]] = []

        # Build filter conditions
        if main_status:
            mongo_filter_conditions.append({"status": main_status})
        if impl_status:
            mongo_filter_conditions.append({"implementabilityStatus": impl_status})
        if tags:
            mongo_filter_conditions.append({"tasks": {"$in": tags}})
        if venue:
            mongo_filter_conditions.append({"proceeding": {"$regex": venue, "$options": "i"}})

        # Date filters
        date_filter_parts_mongo = {}
        try:
            if start_date:
                dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                date_filter_parts_mongo["$gte"] = dt_start
            if end_date:
                dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                if dt_end.hour == 0 and dt_end.minute == 0 and dt_end.second == 0:
                    dt_end = dt_end.replace(hour=23, minute=59, second=59, microsecond=999999)
                date_filter_parts_mongo["$lte"] = dt_end
            if date_filter_parts_mongo:
                mongo_filter_conditions.append({"publicationDate": date_filter_parts_mongo})
        except ValueError as e:
            self.logger.warning(f"Invalid date format: {e}. Date filter ignored.")

        # Official implementation filter
        if has_official_impl is not None:
            if has_official_impl:
                mongo_filter_conditions.append({"pwc_url": {"$exists": True, "$nin": ["", None]}})
            else:
                mongo_filter_conditions.append({
                    "$or": [{"pwc_url": {"$exists": False}}, {"pwc_url": ""}, {"pwc_url": None}]
                })

        # Build final query
        final_query = {"$and": mongo_filter_conditions} if mongo_filter_conditions else {}
        
        # Sorting
        sort_doc: Dict[str, Any] = {}
        parsed_sort_order_val = DESCENDING if sort_order == "desc" else ASCENDING
        
        if sort_by == "newest":
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
            sort_doc = {"publicationDate": DESCENDING}

        db_call_overall_start_time = time.time()
        try:
            self.logger.info(f"Executing standard find query: {final_query} with sort: {sort_doc}, skip: {skip}, limit: {limit}")
            sort_criteria = list(sort_doc.items()) if sort_doc else None

            find_call_start_time = time.time()
            cursor = papers_collection.find(final_query)
            if sort_criteria:
                cursor = cursor.sort(sort_criteria)
            cursor = cursor.skip(skip).limit(limit)
            self.logger.info(f"Standard find query construction took: {time.time() - find_call_start_time:.4f}s")
            
            find_fetch_start_time = time.time()
            papers_list = await cursor.to_list(length=limit)
            self.logger.info(f"Standard find cursor.to_list() took: {time.time() - find_fetch_start_time:.4f}s")
            
            count_start_time = time.time()
            if not final_query:
                total_papers = await papers_collection.estimated_document_count()
                self.logger.info(f"Standard estimated_document_count took: {time.time() - count_start_time:.4f}s")
            else:
                total_papers = await papers_collection.count_documents(final_query)
                self.logger.info(f"Standard count_documents took: {time.time() - count_start_time:.4f}s")
            
            self.logger.info(f"Standard query total time: {time.time() - service_start_time:.4f}s")
            return papers_list, total_papers
            
        except PyMongoError as e:
            self.logger.error(f"Database error in standard query: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching papers list: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected error in standard query: {e}", exc_info=True)
            raise ServiceException(f"An unexpected error occurred: {e}")

    # ... any other methods ...