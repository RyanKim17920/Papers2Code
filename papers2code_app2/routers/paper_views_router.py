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
    config_settings,
    MAIN_STATUS_NOT_IMPLEMENTABLE # Import the constant
)
from ..database import get_papers_collection_sync
from ..utils import transform_paper_sync
from ..auth import get_current_user_optional
from ..services.paper_view_service import PaperViewService # Added
from ..services.exceptions import (
    PaperNotFoundException as ServicePaperNotFoundException, 
    ServiceException as GeneralServiceException # Added
)

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
    logger.info(f"Router: GET /papers request with params - page: {page}, limit: {limit}, search: '{search}', sort: '{sort}', etc.")
    paper_view_service = PaperViewService()
    current_user_id_str = str(current_user.id) if current_user else None

    try:
        # Date parsing is now handled by the service, but initial validation for format can remain or be moved.
        # For now, let service handle parsing and its specific exceptions.
        # try:
        #     if startDate:
        #         parse_date(startDate) # Quick validation of format before passing to service
        #     if endDate:
        #         parse_date(endDate)
        # except ParserError:
        #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Please use YYYY-MM-DD or similar.")

        papers_list_docs, total_count = paper_view_service.get_papers_paginated(
            limit=limit,
            page=page,
            search=search,
            sort=sort,
            start_date_str=startDate, # Pass original string names
            end_date_str=endDate,
            search_authors=searchAuthors
        )

        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
        
        transformed_papers = [
            transform_paper_sync(paper, current_user_id_str, detail_level="summary") 
            for paper in papers_list_docs
        ]
        # Filter out None results from transformation, though ideally transform_paper_sync should always return a valid dict or raise
        papers_list_transformed = [transformed for transformed in transformed_papers if transformed is not None]
        
        logger.info(f"Router: Returning {len(papers_list_transformed)} papers for page {page}, total_count: {total_count}")
        return PaginatedPaperResponse(
            papers=papers_list_transformed, 
            total_count=total_count, 
            page=page, 
            page_size=limit, 
            has_more=(page < total_pages)
        )

    except GeneralServiceException as e:
        # Check if the message indicates an invalid date format to return 400
        if "Invalid date format" in e.message:
            logger.warning(f"Router: ServiceException (likely invalid date) in get_papers: {e.message}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
        else:
            logger.error(f"Router: GeneralServiceException in get_papers: {e.message}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while fetching papers: {e.message}")
    except HTTPException: # Re-raise HTTPExceptions (e.g., from Depends or early validation)
        raise
    except Exception as general_error: # Catch-all for any other unexpected errors in the router layer
        logger.exception("Router: An unexpected internal server error occurred in get_papers")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected internal server error occurred: {str(general_error)}")

@router.get("/{paper_id}", response_model=PaperResponse)
@limiter.limit("100/minute")
async def get_paper_by_id(
    request: Request,
    paper_id: str,
    current_user: Optional[UserSchema] = Depends(get_current_user_optional)
):
    logger.info(f"Router: GET request for paper_id: {paper_id}")
    paper_view_service = PaperViewService()
    try:
        paper_doc = paper_view_service.get_paper_by_id(paper_id)
        
        current_user_id_str = str(current_user.id) if current_user else None
        transformed_paper = transform_paper_sync(paper_doc, current_user_id_str, detail_level="full")
        
        if not transformed_paper:
            logger.error(f"Router: Failed to transform paper_doc for paper_id: {paper_id}, even though service returned a document.")
            # This case should ideally not happen if paper_doc is valid and transform_paper_sync is robust.
            # It implies an issue in transformation logic for a valid paper.
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process paper data after retrieval.")
        
        logger.info(f"Router: Successfully processed and returning paper_id: {paper_id}")
        return transformed_paper

    except ServicePaperNotFoundException as e: # Catch specific service exception
        logger.warning(f"Router: PaperNotFoundException for paper_id {paper_id}: {e.message}") # Access e.message
        # Determine status code based on the nature of PaperNotFoundException if it varies
        # Check the actual message content from the exception definition
        if "Invalid paper ID format" in e.message: # Match the message from PaperNotFoundException for invalid format
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except HTTPException: # Re-raise HTTPExceptions if they were raised by FastAPI/Starlette (e.g. validation errors)
        raise
    except Exception as general_error: # Catch any other unexpected errors
        logger.exception(f"Router: An internal server error occurred in get_paper_by_id for paper_id: {paper_id}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal server error occurred: {str(general_error)}")

