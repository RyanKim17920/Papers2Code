from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import Optional
from pymongo import DESCENDING, ASCENDING
from pymongo.errors import OperationFailure
from bson import ObjectId
from bson.errors import InvalidId
from dateutil.parser import parse as parse_date
from dateutil.parser._parser import ParserError
import shlex
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging

from ..schemas_papers import PaperResponse, PaginatedPaperResponse
from ..schemas_minimal import UserSchema
from ..shared import (
    get_papers_collection_sync,
    transform_paper_sync,
    config_settings
)
from ..auth import get_current_user_optional

router = APIRouter(
    prefix="/papers",
    tags=["paper-views"],
)

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

@router.get("", response_model=PaginatedPaperResponse)
@limiter.limit("100/minute")
async def get_papers(
    request: Request,
    limit: int = Query(12, gt=0),
    page: int = Query(1, gt=0),
    search: Optional[str] = Query(None, alias="search"),
    sort: str = Query("newest", pattern="^(newest|oldest|upvotes)$", alias="sort"),
    startDate: Optional[str] = Query(None, alias="startDate"),
    endDate: Optional[str] = Query(None, alias="endDate"),
    searchAuthors: Optional[str] = Query(None, alias="searchAuthors"),
    current_user: Optional[UserSchema] = Depends(get_current_user_optional)
):
    try:
        start_date_obj = None
        end_date_obj = None
        try:
            if startDate:
                start_date_obj = parse_date(startDate).replace(hour=0, minute=0, second=0, microsecond=0)
            if endDate:
                end_date_obj = parse_date(endDate).replace(hour=23, minute=59, second=59, microsecond=999999)
        except ParserError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Please use YYYY-MM-DD or similar.")

        skip = (page - 1) * limit
        papers_cursor = None
        total_count = 0
        current_user_id_str = str(current_user.id) if current_user else None
        papers_collection = get_papers_collection_sync()

        search_term_cleaned = search.strip() if search else None
        search_authors_cleaned = searchAuthors.strip() if searchAuthors else None

        is_search_active = bool(search_term_cleaned or start_date_obj or end_date_obj or search_authors_cleaned)

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

            # Add mustNot to filter out non-implementable papers by status
            if config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB:
                search_operator["compound"].setdefault("mustNot", []).append({
                    "text": { # Assuming 'status' field is indexed as text or compatible
                        "query": config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB,
                        "path": "status" # Actual DB field name for status
                    }
                })

            if not search_operator["compound"].get("must") and \
               not search_operator["compound"].get("should") and \
               not search_operator["compound"].get("filter") and \
               not search_operator["compound"].get("mustNot"):
                 is_search_active = False 
            elif not must_clauses and not should_clauses:
                 search_operator["compound"].pop("must", None)
                 search_operator["compound"].pop("should", None)
                 # Check if only filter or mustNot clauses are present
                 if not filter_clauses and not search_operator["compound"].get("mustNot"):
                    is_search_active = False

            if is_search_active:
                search_pipeline_stages = [{"$search": search_operator}]
                if search_term_cleaned:
                    search_pipeline_stages.extend([
                        {"$addFields": {"score": {"$meta": "searchScore"}, "highlights": {"$meta": "searchHighlights"}}},
                        {"$match": {"score": {"$gt": score_threshold}}}
                    ])
                    sort_stage = {"$sort": {"score": DESCENDING, "publicationDate": DESCENDING}} # Use publicationDate
                else: 
                    sort_stage = {"$sort": {"publicationDate": DESCENDING}} # Use publicationDate
                search_pipeline_stages.append(sort_stage)
                search_pipeline_stages.append({"$limit": overall_limit})

                facet_pipeline = search_pipeline_stages + [
                    {"$facet": {
                        "paginatedResults": [{"$skip": skip}, {"$limit": limit}],
                        "totalCount": [{"$count": 'count'}]
                    }}
                ]
                try:
                    results = list(papers_collection.aggregate(facet_pipeline, allowDiskUse=True))
                    if results and results[0]:
                        total_count = results[0]['totalCount'][0]['count'] if results[0]['totalCount'] else 0
                        papers_cursor = results[0]['paginatedResults']
                    else:
                        papers_cursor = []
                        total_count = 0
                except OperationFailure as op_error_detail:
                     logger.exception("Search operation failed in get_papers")
                     raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Search operation failed: {str(op_error_detail)}")
                except Exception as agg_error:
                    logger.exception("Failed to execute search query in get_papers")
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to execute search query: {str(agg_error)}")

        if not is_search_active:
            base_filter = {
                "status": {"$ne": config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB} # Use status and DB value
            }
            logger.debug(f"Using base_filter: {base_filter}")
            logger.debug(f"Value of config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB: {config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB}")

            # === Temporary Debugging: Count all documents ===
            try:
                count_all_docs = papers_collection.count_documents({})
                logger.debug(f"Total documents in 'papers' collection (empty filter): {count_all_docs}")
            except Exception as e:
                logger.error(f"Error counting all documents: {e}", exc_info=True)
            # === End Temporary Debugging ===

            if sort == 'oldest':
                sort_criteria = [("publicationDate", ASCENDING)] # Use publicationDate
            elif sort == 'upvotes':
                sort_criteria = [("upvoteCount", DESCENDING), ("publicationDate", DESCENDING)] # Use upvoteCount and publicationDate
            else: # Default is 'newest'
                sort_criteria = [("publicationDate", DESCENDING)] # Use publicationDate
            try:
                total_count = papers_collection.count_documents(base_filter)
                logger.debug(f"Total papers found with base_filter: {total_count}")
                if total_count > 0:
                     papers_cursor = papers_collection.find(base_filter).sort(sort_criteria).skip(skip).limit(limit)
                else:
                     papers_cursor = []
            except Exception as db_error:
                 logger.exception("Failed to retrieve paper data in get_papers")
                 raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to retrieve paper data: {str(db_error)}")

        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
        transformed_papers = [
            transform_paper_sync(paper, current_user_id_str, detail_level="summary") 
            for paper in papers_cursor
        ]
        papers_list = [transformed for transformed in transformed_papers if transformed is not None]

        return PaginatedPaperResponse(papers=papers_list, total_count=total_count, page=page, page_size=limit, has_more=(page < total_pages))

    except HTTPException:
        raise
    except Exception as general_error:
        logger.exception("An internal server error occurred in get_papers")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal server error occurred: {str(general_error)}")

@router.get("/{paper_id}", response_model=PaperResponse)
@limiter.limit("100/minute")
async def get_paper_by_id(
    request: Request,
    paper_id: str,
    current_user: Optional[UserSchema] = Depends(get_current_user_optional)
):
    try:
        try: 
            obj_id = ObjectId(paper_id)
        except InvalidId: 
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper ID format")

        papers_collection = get_papers_collection_sync()
        paper_doc = papers_collection.find_one({"_id": obj_id})
        if paper_doc:
            current_user_id_str = str(current_user.id) if current_user else None
            transformed_paper = transform_paper_sync(paper_doc, current_user_id_str, detail_level="full")
            if not transformed_paper:
                logger.error(f"Failed to transform paper_doc for paper_id: {paper_id}, even though document was found.")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process paper data.")
            return transformed_paper
        else: 
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")
    except HTTPException:
        raise
    except Exception as general_error:
        logger.exception("An internal server error occurred in get_paper_by_id")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal server error occurred: {str(general_error)}")

