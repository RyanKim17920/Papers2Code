import logging
import re
import time
from typing import List, Dict, Any, Optional, Tuple
from bson import ObjectId  # type: ignore
from bson.errors import InvalidId  # type: ignore
from pymongo.errors import PyMongoError  # type: ignore
from pymongo import DESCENDING, ASCENDING  # type: ignore
from datetime import datetime

from ..database import (
    get_papers_collection_async,
    get_implementation_progress_collection_async,
    get_user_actions_collection_async,
)
from .exceptions import PaperNotFoundException, DatabaseOperationException, ServiceException
from ..cache import paper_cache
from ..shared import config_settings


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

    async def get_paper_by_id(self, paper_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:  # noqa: ARG002 - user_id reserved for future user-specific data
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
                self.logger.debug(f"Service: Using ObjectId query filter: {query_filter}")
                progress_document = await implementation_progress_collection.find_one(query_filter)

                # If not found with ObjectId, try with string (backward compatibility)
                if not progress_document:
                    query_filter = {"_id": paper_id}
                    self.logger.debug(f"Service: Using string query filter: {query_filter}")
                    progress_document = await implementation_progress_collection.find_one(query_filter)
            except Exception:
                # If ObjectId conversion fails, just try with string
                query_filter = {"_id": paper_id}
                self.logger.debug(f"Service: Using string query filter: {query_filter}")
                progress_document = await implementation_progress_collection.find_one(query_filter)

            self.logger.debug(f"Service: Result of find_one for paper_id '{paper_id}': {progress_document}")
            if progress_document:
                # Convert the raw document to a proper ImplementationProgress model
                # This ensures that the _id field is converted to id and all other fields are properly validated
                from ..schemas.implementation_progress import ImplementationProgress
                progress_model = ImplementationProgress(**progress_document)
                # Use model_dump(by_alias=True) to properly serialize with camelCase field names
                # This will convert _id to id, snake_case to camelCase, etc.
                progress_dict = progress_model.model_dump(by_alias=True, mode='json')
                self.logger.debug(f"Service: Progress model ID: {progress_model.id}")
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
        has_code: Optional[bool] = None,
        contributor_id: Optional[str] = None,
        venue: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        service_start_time = time.time()
        self.logger.info(f"get_papers_list called with: skip={skip}, limit={limit}, sort_by='{sort_by}', searchQuery='{search_query}', author='{author}'")
        
        # Create cache key from search parameters (exclude user_id from public cache)
        cache_params = {
            "skip": skip,
            "limit": limit,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "search_query": search_query,
            "author": author,
            "start_date": start_date,
            "end_date": end_date,
            "main_status": main_status,
            "impl_status": impl_status,
            "tags": sorted(tags) if tags else None,  # Sort for consistent caching
            "has_official_impl": has_official_impl,
            "has_code": has_code,
            "contributor_id": contributor_id,
            "venue": venue
        }
        
        # Try to get from cache first
        cached_result = await paper_cache.get_cached_result(**cache_params)
        if cached_result:
            self.logger.info(f"CACHE HIT: Returning cached result in {time.time() - service_start_time:.4f}s")
            return cached_result["papers"], cached_result["total_count"]
        
        # Check if Atlas Search will be active
        is_atlas_search_active = bool(search_query or author)
        
        if is_atlas_search_active:
            # TWO-PHASE APPROACH FOR ATLAS SEARCH
            papers, total_count = await self._get_papers_list_atlas_two_phase(
                skip, limit, sort_by, sort_order, user_id, search_query, author,
                start_date, end_date, main_status, impl_status, tags, has_official_impl, has_code, contributor_id, venue
            )
        else:
            # STANDARD MONGODB QUERY (unchanged)
            papers, total_count = await self._get_papers_list_standard(
                skip, limit, sort_by, sort_order, user_id, search_query, author,
                start_date, end_date, main_status, impl_status, tags, has_official_impl, has_code, contributor_id, venue
            )
        
        # Cache the result for future requests
        result_to_cache = {
            "papers": papers,
            "total_count": total_count
        }
        await paper_cache.cache_result(result_to_cache, **cache_params)
        
        self.logger.info(f"CACHE MISS: Query completed and cached in {time.time() - service_start_time:.4f}s")
        return papers, total_count

    async def _get_papers_list_atlas_two_phase(
        self,
        skip: int, limit: int, sort_by: str, sort_order: str, user_id: Optional[str],
        search_query: Optional[str], author: Optional[str], start_date: Optional[str],
        end_date: Optional[str], main_status: Optional[str], impl_status: Optional[str],
        tags: Optional[List[str]], has_official_impl: Optional[bool], has_code: Optional[bool], 
        contributor_id: Optional[str], venue: Optional[str]
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Two-phase Atlas Search: Get IDs first, then fetch full documents only for displayed items"""
        
        self.logger.debug(f"Atlas Search starting: search_query='{search_query}', author='{author}'")
        
        atlas_search_index_name = config_settings.ATLAS_SEARCH_INDEX_NAME
        papers_collection = await get_papers_collection_async()
        
        # Build Atlas Search compound clauses
        atlas_compound_must: List[Dict[str, Any]] = []
        atlas_compound_should: List[Dict[str, Any]] = []
        atlas_compound_filter: List[Dict[str, Any]] = []

        # Build search conditions
        if search_query:
            # Single text query — Lucene handles tokenization + BM25 scoring internally
            # Much faster than per-term must clauses (1 query vs N queries)
            atlas_compound_must.append({"text": {"query": search_query, "path": ["title", "abstract"]}})
            # Heavy title boost so title-matching papers rank first
            title_boost = config_settings.ATLAS_SEARCH_TITLE_BOOST
            atlas_compound_should.append({"text": {"query": search_query, "path": "title", "score": {"boost": {"value": title_boost}}}})
            # Recency tiebreaker — slightly boost newer papers when relevance is close
            # near score decays from 1→0.5 over 180 days; boost 1.5 is small vs title boost (10)
            atlas_compound_should.append({
                "near": {
                    "path": "publicationDate",
                    "origin": datetime.utcnow(),
                    "pivot": 15552000000,  # 180 days in ms
                    "score": {"boost": {"value": 1.5}}
                }
            })

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
            escaped_venue = re.escape(venue)
            atlas_compound_filter.append({"regex": {"query": escaped_venue, "path": "proceeding", "allowAnalyzedField": True}})
        
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

        # Has code filter (checks hasCode field)
        if has_code is not None:
            if has_code:
                atlas_compound_filter.append({"term": {"query": True, "path": "hasCode"}})
            else:
                atlas_compound_filter.append({
                    "compound": {
                        "should": [
                            {"term": {"query": False, "path": "hasCode"}},
                            {"bool": {"mustNot": [{"exists": {"path": "hasCode"}}]}}
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
            self.logger.warning("Atlas Search compound is empty, falling back to standard query")
            return await self._get_papers_list_standard(
                skip, limit, sort_by, sort_order, user_id, search_query, author,
                start_date, end_date, main_status, impl_status, tags, has_official_impl, has_code, contributor_id, venue
            )

        search_stage = {
            "$search": {
                "index": atlas_search_index_name,
                "compound": search_stage_compound,
                "count": {"type": "lowerBound", "threshold": 1000},
                "returnStoredSource": True  # Return fields from index, skip collection fetch
            }
        }

        # Sorting — Atlas Search returns by relevance by default, only add $sort for non-relevance
        needs_explicit_sort = False
        sort_doc: Dict[str, Any] = {}
        parsed_sort_order_val = DESCENDING if sort_order == "desc" else ASCENDING

        if sort_by in ("relevance", "newest") and search_query:
            pass  # Atlas Search default relevance order is correct
        elif sort_by == "newest":
            sort_doc = {"publicationDate": DESCENDING}
            needs_explicit_sort = True
        elif sort_by == "oldest":
            sort_doc = {"publicationDate": ASCENDING}
            needs_explicit_sort = True
        elif sort_by == "upvotes":
            sort_doc = {"upvoteCount": parsed_sort_order_val}
            needs_explicit_sort = True
        elif sort_by == "publication_date":
            sort_doc = {"publicationDate": parsed_sort_order_val}
            needs_explicit_sort = True
        elif sort_by == "title":
            sort_doc = {"title": parsed_sort_order_val}
            needs_explicit_sort = True

        # Build pipeline: $search (returnStoredSource) → ($sort) → $skip → $limit → $addFields
        # storedSource returns fields directly from the index — no collection fetch needed
        results_pipeline = [search_stage]

        if needs_explicit_sort:
            results_pipeline.append({"$sort": sort_doc})

        results_pipeline.append({"$skip": skip})
        results_pipeline.append({"$limit": limit})
        results_pipeline.append({"$addFields": {"meta": "$$SEARCH_META"}})

        search_start = time.time()

        try:
            # Single pipeline — count embedded via $$SEARCH_META (no separate count query)
            results_cursor = await papers_collection.aggregate(results_pipeline)
            papers_list = await results_cursor.to_list(length=limit)

            # Extract count from $$SEARCH_META embedded in each document
            MAX_COUNT = 10000
            total_papers = 0
            if papers_list:
                meta = papers_list[0].get("meta", {})
                total_papers = min(meta.get("count", {}).get("lowerBound", 0), MAX_COUNT)
                for paper in papers_list:
                    paper.pop("meta", None)

            self.logger.info(f"Atlas Search: {time.time() - search_start:.4f}s, {len(papers_list)} results, ~{total_papers} total")

            return papers_list, total_papers
            
        except PyMongoError as e:
            self.logger.error(f"Atlas Search error: {e}", exc_info=True)
            self.logger.info("Falling back to standard query")
            return await self._get_papers_list_standard(
                skip, limit, sort_by, sort_order, user_id, search_query, author,
                start_date, end_date, main_status, impl_status, tags, has_official_impl, has_code, contributor_id, venue
            )

    async def _get_papers_list_standard(
        self,
        skip: int, limit: int, sort_by: str, sort_order: str, user_id: Optional[str],  # noqa: ARG002 - user_id reserved for future use
        search_query: Optional[str], author: Optional[str], start_date: Optional[str],
        end_date: Optional[str], main_status: Optional[str], impl_status: Optional[str],
        tags: Optional[List[str]], has_official_impl: Optional[bool], has_code: Optional[bool],
        contributor_id: Optional[str], venue: Optional[str]
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
            escaped_venue = re.escape(venue)
            mongo_filter_conditions.append({"proceeding": {"$regex": escaped_venue, "$options": "i"}})
        
        # Text search: Use MongoDB text index for search_query and/or author
        # Note: MongoDB allows only ONE $text operator per query, so we combine them
        text_search_terms = []
        if search_query:
            text_search_terms.append(search_query)
        if author:
            # Wrap author in quotes for phrase matching in text search
            text_search_terms.append(f'"{author}"')

        if text_search_terms:
            combined_search = " ".join(text_search_terms)
            self.logger.debug(f"Adding text search for: '{combined_search}'")
            mongo_filter_conditions.append({
                "$text": {"$search": combined_search}
            })

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

        # Has code filter
        if has_code is not None:
            if has_code:
                mongo_filter_conditions.append({"hasCode": True})
            else:
                mongo_filter_conditions.append({
                    "$or": [{"hasCode": False}, {"hasCode": {"$exists": False}}]
                })

        # Contributor filter - find all papers where user has performed ANY action
        if contributor_id:
            try:
                contributor_obj_id = ObjectId(contributor_id)
                user_actions_collection = await get_user_actions_collection_async()
                
                # Find all distinct paper IDs where this user has performed any action
                paper_ids_with_actions = await user_actions_collection.distinct(
                    "paperId",
                    {"userId": contributor_obj_id}
                )
                
                if paper_ids_with_actions:
                    # Convert paper IDs to ObjectId if they're strings
                    paper_obj_ids = []
                    for pid in paper_ids_with_actions:
                        try:
                            if isinstance(pid, str):
                                paper_obj_ids.append(ObjectId(pid))
                            else:
                                paper_obj_ids.append(pid)
                        except Exception:
                            continue
                    
                    if paper_obj_ids:
                        mongo_filter_conditions.append({"_id": {"$in": paper_obj_ids}})
                    else:
                        # No valid paper IDs found
                        self.logger.info(f"No papers found for contributor: {contributor_id}")
                        return [], 0
                else:
                    # No actions found for this contributor, return empty result
                    self.logger.info(f"No papers found for contributor: {contributor_id}")
                    return [], 0
            except Exception as e:
                self.logger.warning(f"Invalid contributor ID format: {e}")
                return [], 0

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

        try:
            self.logger.info(f"Executing standard find query: {final_query} with sort: {sort_doc}, skip: {skip}, limit: {limit}")
            sort_criteria = list(sort_doc.items()) if sort_doc else None

            find_call_start_time = time.time()
            
            # OPTIMIZATION: Project only needed fields for list view
            list_view_projection = {
                "_id": 1,
                "title": 1,
                "authors": 1,
                "publicationDate": 1,
                "upvoteCount": 1,
                "status": 1,
                "urlGithub": 1,
                "urlAbs": 1,
                "urlPdf": 1,
                "hasCode": 1,
                "abstract": 1,
                "venue": 1,
                "tasks": 1,
                "implementabilityStatus": 1,
                "pwcUrl": 1,
                "arxivId": 1
            }
            
            # Add query hints for better index usage
            cursor = papers_collection.find(final_query, list_view_projection)
            
            # Apply index hints based on query and sort criteria (if enabled)
            # Wrapped in try/except to gracefully handle missing indexes
            # NOTE: MongoDB does not allow hint() with $text queries - skip hints when text search is active
            uses_text_search = bool(text_search_terms)
            if config_settings.ENABLE_QUERY_HINTS and sort_criteria and not uses_text_search:
                sort_field = sort_criteria[0][0]
                try:
                    # Use appropriate index hints for common sort patterns
                    if sort_field == "publicationDate":
                        if main_status:
                            cursor = cursor.hint("status_1_publicationDate_-1_papers_async")
                        else:
                            cursor = cursor.hint("publicationDate_-1_papers_async")
                    elif sort_field == "upvoteCount":
                        if main_status:
                            cursor = cursor.hint("status_1_upvoteCount_-1_papers_async")
                        else:
                            cursor = cursor.hint("upvoteCount_-1_papers_async")
                    elif sort_field == "title":
                        cursor = cursor.hint("title_1_papers_async")
                except Exception as hint_error:
                    self.logger.warning(f"Index hint failed, proceeding without hint: {hint_error}")

                cursor = cursor.sort(sort_criteria)
            elif sort_criteria:
                cursor = cursor.sort(sort_criteria)
            else:
                # Default hint for unsorted queries (skip if text search is active)
                if config_settings.ENABLE_QUERY_HINTS and main_status and not uses_text_search:
                    try:
                        cursor = cursor.hint("status_1_publicationDate_-1_papers_async")
                    except Exception as hint_error:
                        self.logger.warning(f"Default index hint failed: {hint_error}")
            
            cursor = cursor.skip(skip).limit(limit)
            self.logger.info(f"Standard find query construction took: {time.time() - find_call_start_time:.4f}s")
            
            find_fetch_start_time = time.time()
            papers_list = await cursor.to_list(length=limit)
            self.logger.info(f"Standard find cursor.to_list() took: {time.time() - find_fetch_start_time:.4f}s")
            
            count_start_time = time.time()
            
            # Optimize count operation - use bounded count for speed
            MAX_COUNT = 10000  # Cap count for performance (UI shows "10,000+ results")

            if not final_query:
                # No filters - use cached estimated count
                total_papers = await papers_collection.estimated_document_count()
                self.logger.info(f"Standard estimated_document_count took: {time.time() - count_start_time:.4f}s")
            else:
                # Use bounded count aggregation - much faster than count_documents for complex queries
                # This avoids scanning the entire collection for text search queries
                count_pipeline = [
                    {"$match": final_query},
                    {"$limit": MAX_COUNT},  # Stop counting after MAX_COUNT
                    {"$count": "total"}
                ]
                count_cursor = await papers_collection.aggregate(count_pipeline)
                count_result = await count_cursor.to_list(length=1)
                total_papers = count_result[0]["total"] if count_result else 0
                self.logger.info(f"Standard bounded_count took: {time.time() - count_start_time:.4f}s (capped at {MAX_COUNT})")
            
            self.logger.info(f"Standard query total time: {time.time() - service_start_time:.4f}s")
            return papers_list, total_papers
            
        except PyMongoError as e:
            self.logger.error(f"Database error in standard query: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching papers list: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected error in standard query: {e}", exc_info=True)
            raise ServiceException(f"An unexpected error occurred: {e}")

    async def get_distinct_tags(self, search_query: Optional[str] = None) -> List[str]:
        """
        Retrieves a list of distinct tags from the papers collection.
        Optionally filters tags by a search query.
        Uses caching (1 hour TTL) since tags change rarely.
        """
        try:
            # Try cache first (for full list, filtering is done in-memory)
            cached_tags = await paper_cache.get_cached_metadata("tags")
            if cached_tags is not None:
                all_tags = cached_tags
            else:
                # Cache miss - fetch from database
                papers_collection = await get_papers_collection_async()
                all_tags = await papers_collection.distinct("tasks")
                all_tags = sorted([tag for tag in all_tags if tag is not None])
                # Cache the full list
                await paper_cache.set_cached_metadata("tags", all_tags)

            # Filter tags if search query is provided (done in-memory, fast)
            if search_query and search_query.strip():
                search_lower = search_query.strip().lower()
                return [tag for tag in all_tags if search_lower in tag.lower()]

            return all_tags
        except PyMongoError as e:
            self.logger.error(f"Database error fetching distinct tags: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching distinct tags: {e}")

    async def get_distinct_venues(self) -> List[str]:
        """
        Retrieves a list of distinct venues from the papers collection.
        Uses caching (1 hour TTL) since venues change rarely.
        """
        try:
            # Try cache first
            cached_venues = await paper_cache.get_cached_metadata("venues")
            if cached_venues is not None:
                return cached_venues

            # Cache miss - fetch from database
            papers_collection = await get_papers_collection_async()
            venues = await papers_collection.distinct("proceeding")
            venues = sorted([v for v in venues if v])
            # Cache the result
            await paper_cache.set_cached_metadata("venues", venues)
            return venues
        except PyMongoError as e:
            self.logger.error(f"Database error fetching distinct venues: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching distinct venues: {e}")

    async def get_distinct_authors(self) -> List[str]:
        """
        Retrieves a list of distinct authors from the papers collection.
        Note: This flattens the authors array.
        Uses caching (1 hour TTL) since author list changes rarely.
        """
        try:
            # Try cache first
            cached_authors = await paper_cache.get_cached_metadata("authors")
            if cached_authors is not None:
                return cached_authors

            # Cache miss - fetch from database
            papers_collection = await get_papers_collection_async()
            # Use aggregation to unwind authors array and get distinct values
            pipeline = [
                {"$unwind": "$authors"},
                {"$group": {"_id": "$authors"}},
                {"$sort": {"_id": 1}},
                {"$limit": 1000}  # Limit to prevent huge result sets
            ]
            agg_cursor = await papers_collection.aggregate(pipeline)
            result = await agg_cursor.to_list(length=1000)
            authors = [doc["_id"] for doc in result if doc.get("_id")]
            # Cache the result
            await paper_cache.set_cached_metadata("authors", authors)
            return authors
        except PyMongoError as e:
            self.logger.error(f"Database error fetching distinct authors: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching distinct authors: {e}")

    async def get_paper_count_by_status(self) -> Dict[str, int]:
        """
        Returns a count of papers grouped by their implementation status.
        """
        try:
            papers_collection = await get_papers_collection_async()
            pipeline = [
                {"$group": {"_id": "$status", "count": {"$sum": 1}}},
                {"$sort": {"_id": 1}}
            ]
            agg_cursor = await papers_collection.aggregate(pipeline)
            result = await agg_cursor.to_list(length=None)
            counts = {doc["_id"]: doc["count"] for doc in result}
            return counts
        except PyMongoError as e:
            self.logger.error(f"Database error fetching status counts: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching status counts: {e}")

    async def get_papers_by_arxiv_ids(self, arxiv_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Retrieves papers by a list of arXiv IDs.
        """
        try:
            papers_collection = await get_papers_collection_async()
            papers = await papers_collection.find({"arxivId": {"$in": arxiv_ids}}).to_list(length=len(arxiv_ids))
            return papers
        except PyMongoError as e:
            self.logger.error(f"Database error fetching papers by arXiv IDs: {e}", exc_info=True)
            raise DatabaseOperationException(f"Error fetching papers by arXiv IDs: {e}")


    # ... any other methods ...