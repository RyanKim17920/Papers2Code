import logging
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING, ASCENDING
from pymongo.errors import OperationFailure
from dateutil.parser import parse as parse_date
from dateutil.parser._parser import ParserError
import shlex

from ..database import get_papers_collection_sync
from ..shared import config_settings, MAIN_STATUS_NOT_IMPLEMENTABLE
from ..schemas_papers import PaperResponse # Assuming PaperResponse is the output model, adjust if needed
from ..services.exceptions import PaperNotFoundException, ServiceException

class PaperViewService:
    def __init__(self):
        self.papers_collection = get_papers_collection_sync()
        self.logger = logging.getLogger(__name__)

    def get_paper_by_id(self, paper_id: str) -> dict:
        """
        Retrieves a single paper by its ID.
        Raises PaperNotFoundException if not found or ID is invalid.
        """
        self.logger.info(f"Service: Attempting to fetch paper with ID: {paper_id}")
        try:
            obj_id = ObjectId(paper_id)
        except InvalidId:
            self.logger.warning(f"Service: Invalid paper ID format: {paper_id}")
            raise PaperNotFoundException(paper_id=f"Invalid paper ID format: {paper_id}") # Pass paper_id to exception

        paper_doc = self.papers_collection.find_one({"_id": obj_id})
        if not paper_doc:
            self.logger.warning(f"Service: Paper not found with ID: {paper_id}")
            raise PaperNotFoundException(paper_id=paper_id)
        
        self.logger.info(f"Service: Successfully fetched paper with ID: {paper_id}")
        return paper_doc

    def get_papers_paginated(
        self,
        limit: int,
        page: int,
        search: Optional[str] = None,
        sort: str = "newest",
        start_date_str: Optional[str] = None, # Renamed from startDate for clarity
        end_date_str: Optional[str] = None,   # Renamed from endDate for clarity
        search_authors: Optional[str] = None
    ) -> tuple[list[dict], int]:
        """
        Retrieves a paginated list of papers, with optional search, filtering, and sorting.
        Handles date parsing, Atlas Search, and standard MongoDB queries.
        Returns a tuple: (list of paper documents, total count).
        Raises ServiceException for database/search operation failures or InvalidDateException for date parsing errors.
        """
        self.logger.info(
            f"Service: get_papers_paginated called with - limit: {limit}, page: {page}, "
            f"search: '{search}', sort: '{sort}', startDate: '{start_date_str}', "
            f"endDate: '{end_date_str}', searchAuthors: '{search_authors}'"
        )

        start_date_obj = None
        end_date_obj = None
        try:
            if start_date_str:
                start_date_obj = parse_date(start_date_str).replace(hour=0, minute=0, second=0, microsecond=0)
            if end_date_str:
                end_date_obj = parse_date(end_date_str).replace(hour=23, minute=59, second=59, microsecond=999999)
        except ParserError as e:
            self.logger.warning(f"Service: Invalid date format provided: {e}")
            # Consider creating a specific InvalidDateException or re-use InvalidActionException
            raise ServiceException(f"Invalid date format: {e}. Please use YYYY-MM-DD or similar.")

        skip = (page - 1) * limit
        papers_cursor_list = []
        total_count = 0

        search_term_cleaned = search.strip() if search else None
        search_authors_cleaned = search_authors.strip() if search_authors else None

        is_search_active = bool(search_term_cleaned or start_date_obj or end_date_obj or search_authors_cleaned)

        try:
            if is_search_active:
                atlas_search_index_name = config_settings.ATLAS_SEARCH_INDEX_NAME
                score_threshold = config_settings.ATLAS_SEARCH_SCORE_THRESHOLD
                overall_limit = config_settings.ATLAS_SEARCH_OVERALL_LIMIT

                must_clauses = []
                should_clauses = []
                filter_clauses = []

                if search_term_cleaned:
                    try:
                        terms = shlex.split(search_term_cleaned)
                    except ValueError:
                        terms = search_term_cleaned.split()
                    
                    must_clauses.extend([
                        {
                            "text": {
                                "query": t,
                                "path": ["title", "abstract"],
                                "fuzzy": {"maxEdits": 1, "prefixLength": 1}
                            }
                        } for t in terms
                    ])
                    should_clauses.append({
                        "text": {
                            "query": search_term_cleaned,
                            "path": "title",
                            "score": {"boost": {"value": config_settings.ATLAS_SEARCH_TITLE_BOOST}}
                        }
                    })

                date_range_query = {}
                if start_date_obj:
                    date_range_query["gte"] = start_date_obj
                if end_date_obj:
                    date_range_query["lte"] = end_date_obj
                if date_range_query:
                    filter_clauses.append({"range": {"path": "publication_date", **date_range_query}})

                if search_authors_cleaned:
                    filter_clauses.append({"text": {"query": search_authors_cleaned, "path": "authors"}})
                
                search_operator = {"index": atlas_search_index_name, "compound": {}}
                if must_clauses:
                    search_operator["compound"]["must"] = must_clauses
                if should_clauses:
                    search_operator["compound"]["should"] = should_clauses
                if filter_clauses:
                    search_operator["compound"]["filter"] = filter_clauses

                if config_settings.STATUS_CONFIRMED_NOT_IMPLEMENTABLE_DB:
                    search_operator["compound"].setdefault("mustNot", []).append({
                        "text": {
                            "query": config_settings.STATUS_CONFIRMED_NOT_IMPLEMENTABLE_DB,
                            "path": "status"
                        }
                    })

                # Check if search is still active after building clauses
                if not search_operator["compound"].get("must") and \
                   not search_operator["compound"].get("should") and \
                   not search_operator["compound"].get("filter") and \
                   not search_operator["compound"].get("mustNot"):
                    is_search_active = False 
                elif not must_clauses and not should_clauses:
                    search_operator["compound"].pop("must", None)
                    search_operator["compound"].pop("should", None)
                    if not filter_clauses and not search_operator["compound"].get("mustNot"):
                        is_search_active = False

                if is_search_active:
                    search_pipeline_stages = [{"$search": search_operator}]
                    if search_term_cleaned: # Sort by score only if there was a text search
                        search_pipeline_stages.extend([
                            {"$addFields": {"score": {"$meta": "searchScore"}, "highlights": {"$meta": "searchHighlights"}}},
                            {"$match": {"score": {"$gt": score_threshold}}}
                        ])
                        # Use publicationDate as secondary sort for Atlas Search
                        sort_stage = {"$sort": {"score": DESCENDING, "publicationDate": DESCENDING}} 
                    else: # If no text search, sort by publicationDate (or other specified sort if adapted)
                        # This part might need adjustment if 'sort' param should influence Atlas Search when no text search
                        sort_field_db = "publicationDate" # Default for Atlas when no text search
                        sort_order_db = DESCENDING
                        if sort == 'oldest':
                            sort_order_db = ASCENDING
                        # 'upvotes' sort for Atlas Search without text search needs careful consideration
                        # as $meta searchScore won't be present. Assuming upvoteCount is indexed for search if used here.
                        elif sort == 'upvotes':
                             # This might not be ideal with $search if upvoteCount isn't part of the search index in a way that allows direct sorting.
                             # For simplicity, keeping publicationDate sort here. A more complex setup might be needed for upvote sort in Atlas Search without text.
                            self.logger.warning("Service: 'upvotes' sort with Atlas Search without text query might not behave as expected. Defaulting to publicationDate sort.")
                        sort_stage = {"$sort": {sort_field_db: sort_order_db}}

                    search_pipeline_stages.append(sort_stage)
                    search_pipeline_stages.append({"$limit": overall_limit}) # Overall limit for Atlas performance

                    facet_pipeline = search_pipeline_stages + [
                        {"$facet": {
                            "paginatedResults": [{"$skip": skip}, {"$limit": limit}],
                            "totalCount": [{"$count": 'count'}]
                        }}
                    ]
                    
                    self.logger.debug(f"Service: Executing Atlas Search pipeline: {facet_pipeline}")
                    results = list(self.papers_collection.aggregate(facet_pipeline, allowDiskUse=True))
                    if results and results[0]:
                        total_count = results[0]['totalCount'][0]['count'] if results[0]['totalCount'] else 0
                        papers_cursor_list = results[0]['paginatedResults']
                    else:
                        papers_cursor_list = []
                        total_count = 0
                    self.logger.info(f"Service: Atlas Search returned {len(papers_cursor_list)} papers, total_count: {total_count}")

            if not is_search_active: # Standard MongoDB query
                base_filter = {}
                if config_settings.STATUS_CONFIRMED_NOT_IMPLEMENTABLE_DB:
                     base_filter["status"] = {"$ne": config_settings.STATUS_CONFIRMED_NOT_IMPLEMENTABLE_DB}
                
                # Date filtering for standard query
                date_filter_mongo = {}
                if start_date_obj:
                    date_filter_mongo["$gte"] = start_date_obj
                if end_date_obj:
                    date_filter_mongo["$lte"] = end_date_obj
                if date_filter_mongo:
                    base_filter["publication_date"] = date_filter_mongo
                
                # Author filtering for standard query (simple text match, case-insensitive if collation is set on DB/collection)
                if search_authors_cleaned:
                    # This is a basic substring match. For more advanced author search, consider regex or specific indexing.
                    base_filter["authors"] = {"$regex": search_authors_cleaned, "$options": "i"} 

                self.logger.debug(f"Service: Executing standard MongoDB query with filter: {base_filter}")

                sort_criteria_mongo = []
                if sort == 'oldest':
                    sort_criteria_mongo = [("publicationDate", ASCENDING)]
                elif sort == 'upvotes':
                    sort_criteria_mongo = [("upvoteCount", DESCENDING), ("publicationDate", DESCENDING)]
                else: # Default is 'newest'
                    sort_criteria_mongo = [("publicationDate", DESCENDING)]
                
                total_count = self.papers_collection.count_documents(base_filter)
                if total_count > 0:
                    papers_cursor = self.papers_collection.find(base_filter).sort(sort_criteria_mongo).skip(skip).limit(limit)
                    papers_cursor_list = list(papers_cursor)
                else:
                    papers_cursor_list = []
                self.logger.info(f"Service: Standard query returned {len(papers_cursor_list)} papers, total_count: {total_count}")

            return papers_cursor_list, total_count

        except OperationFailure as op_error:
            self.logger.exception("Service: MongoDB OperationFailure occurred.")
            raise ServiceException(f"Database operation failed: {str(op_error)}")
        except Exception as e:
            self.logger.exception("Service: An unexpected error occurred during paper retrieval.")
            raise ServiceException(f"An unexpected error occurred: {str(e)}")
