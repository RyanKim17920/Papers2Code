from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request, BackgroundTasks
from typing import List, Optional, Dict
import asyncio # Add asyncio import

from ..schemas.papers import PaperResponse, PaginatedPaperResponse
from ..schemas.minimal import UserSchema as User  # Using UserSchema as User for type hinting
from ..services.paper_view_service import PaperViewService
from ..services.activity_tracking_service import ActivityTrackingService
from ..dependencies import get_paper_view_service, get_activity_tracking_service
from ..services.exceptions import DatabaseOperationException
from ..error_handlers import handle_service_errors
from ..auth import get_current_user_optional # Changed from get_current_user
from ..utils import transform_paper_async
from ..shared import config_settings
import logging
import time # Add time import for performance logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/papers",
    tags=["papers-view"],
)


@router.get("/", response_model=PaginatedPaperResponse)
async def list_papers(
    # Parameters without default values first
    request: Request,
    # Then parameters with default values
    page: int = Query(default=1, ge=1, description="Page number for pagination"), # ADDED: page parameter
    limit: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="newest", alias="sort", description="Sort papers by field. Allowed: newest, oldest, upvotes, publication_date, title"),
    sort_order: str = Query(default="desc", alias="sortOrder", description="Sort order: asc or desc"), # ADDED alias
    main_status: Optional[str] = Query(default=None, alias="mainStatus", description="Filter by main implementation status"), # ADDED alias
    impl_status: Optional[str] = Query(default=None, alias="implStatus", description="Filter by detailed implementability status"), # ADDED alias
    search_query: Optional[str] = Query(default=None, alias="searchQuery", min_length=3, description="Search query for title, abstract"), # ADDED alias
    tags: Optional[List[str]] = Query(default=None, description="Filter by tags (comma-separated or multiple query params)"), # Tags are often sent as multiple params, alias might not be strictly needed if FastAPI handles it.
    has_official_impl: Optional[bool] = Query(default=None, alias="hasOfficialImpl", description="Filter by presence of official implementation"), # ADDED alias
    venue: Optional[str] = Query(default=None, description="Filter by publication venue (e.g., CVPR, NeurIPS)"),
    author: Optional[str] = Query(default=None, alias="searchAuthors", description="Filter by author name (searches author list)"), # Corrected alias to searchAuthors
    start_date: Optional[str] = Query(default=None, alias="startDate", description="Filter by publication start date (ISO format YYYY-MM-DD)"), # ADDED alias
    end_date: Optional[str] = Query(default=None, alias="endDate", description="Filter by publication end date (ISO format YYYY-MM-DD)"),   # ADDED alias
    service: PaperViewService = Depends(get_paper_view_service),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    router_start_time = time.time() # Start timer for the entire endpoint
    skip = (page - 1) * limit # Calculate skip from page and limit
    logger.info(f"Router: list_papers called with: page={page}, limit={limit}, sort_by='{sort_by}', search_query='{search_query}', author='{author}'") # More concise initial log
    user_id_str = str(current_user.id) if current_user and current_user.id else None
    
    # Performance logging
    logger.info(f"list_papers called with: query='{search_query}', sort_by='{sort_by}', sort_order='{sort_order}', skip={skip}, limit={limit}'")

    current_user_id_str = str(current_user.id) if current_user else None
    
    start_time_service = time.time()
    papers_cursor, total_papers = await service.get_papers_list(
        skip=skip, limit=limit, sort_by=sort_by, sort_order=sort_order,
        user_id=user_id_str,
        main_status=main_status, impl_status=impl_status,
        search_query=search_query, tags=tags,
        has_official_impl=has_official_impl,
        venue=venue, author=author,
        start_date=start_date, end_date=end_date
    )
    end_time_service = time.time()
    logger.info(f"PERF: service.get_papers_list took {end_time_service - start_time_service:.4f} seconds.")

    start_time_transform = time.time()
    # transformed_papers = []
    # for paper_doc in papers_cursor:
    #     transformed_paper = await transform_paper_async(paper_doc, current_user_id_str) # CORRECTED: removed detail_level
    #     if transformed_paper:
    #         transformed_papers.append(transformed_paper)

    # Parallelize the transformation with configurable batching for better performance
    batch_size = config_settings.PAPER_TRANSFORM_BATCH_SIZE  # Configurable batch size
    transformed_papers = []
    
    for i in range(0, len(papers_cursor), batch_size):
        batch = papers_cursor[i:i + batch_size]
        transform_tasks = [
            transform_paper_async(paper_doc, current_user_id_str)
            for paper_doc in batch
        ]
        batch_results = await asyncio.gather(*transform_tasks)
        transformed_papers.extend([paper for paper in batch_results if paper is not None])
    
    end_time_transform = time.time()
    logger.info(f"PERF: Transforming {len(transformed_papers)} papers took {end_time_transform - start_time_transform:.4f} seconds.")

    #logger.info(f"Router: Successfully fetched {len(response_papers)} papers for listing. Total matching: {total_papers}")
    final_response = {
        "papers": transformed_papers,
        "total_count": total_papers,
        "page": page,
        "page_size": limit, # FastAPI will use alias 'pageSize' due to model_config
        "has_more": (skip + len(transformed_papers)) < total_papers
    }
    logger.info(f"Router: list_papers endpoint total execution time: {time.time() - router_start_time:.4f}s")
    return final_response

@router.get("/{paper_id}", response_model=PaperResponse)
@handle_service_errors
async def get_paper(
    # Parameters without default values first
    request: Request,
    background_tasks: BackgroundTasks,
    # Then parameters with default values (Path also acts as a default here for DI)
    paper_id: str = Path(..., description="The ID of the paper to retrieve"),
    service: PaperViewService = Depends(get_paper_view_service),
    activity_service: ActivityTrackingService = Depends(get_activity_tracking_service),
    current_user: Optional[User] = Depends(get_current_user_optional)  
):
    #logger.info(f"Router: Getting paper with ID: {paper_id}")
    user_id_str = str(current_user.id) if current_user and current_user.id else None # Corrected to check current_user.id

    try:
        paper_doc = await service.get_paper_by_id(paper_id, user_id_str)
        paper_response = await transform_paper_async(paper_doc, user_id_str)
        
        # Track paper view using background task for better performance
        background_tasks.add_task(
            activity_service.track_paper_view,
            user_id=user_id_str,
            paper_id=paper_id,
            metadata={"came_from": "paper_detail"}
        )
        
    except Exception as e:
        logger.error(f"Router: Unexpected error getting paper (ID: {paper_id}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching the paper.")
    
    #logger.info(f"Router: Successfully fetched paper ID: {paper_id}")
    return paper_response

@router.get("/by_arxiv_ids/", response_model=List[PaperResponse])
@handle_service_errors
async def get_papers_by_arxiv_ids_route(
    # Parameters without default values first (none here)
    # Then parameters with default values
    arxiv_ids: List[str] = Query(..., description="List of arXiv IDs to fetch papers for."),
    service: PaperViewService = Depends(get_paper_view_service),
    current_user: Optional[User] = Depends(get_current_user_optional)  
):
    #logger.info(f"Router: Getting papers by arXiv IDs: {arxiv_ids}")
    if not arxiv_ids:
        return []
    user_id_str = str(current_user.id) if current_user else None
    try:
        papers_db = await service.get_papers_by_arxiv_ids(arxiv_ids)
    except DatabaseOperationException as e:
        logger.error(f"Router: Database error fetching by arXiv IDs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Router: Unexpected error fetching by arXiv IDs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")

    response_papers = []
    for paper_db in papers_db:
        try:
            paper_response = await transform_paper_async(paper_db, user_id_str)
            response_papers.append(paper_response)
        except Exception as e:
            logger.error(f"Router: Error transforming paper {paper_db.get('_id')} for arXiv ID list: {e}", exc_info=True)
    
    #logger.info(f"Router: Successfully fetched {len(response_papers)} papers by arXiv IDs.")
    return response_papers

@router.get("/meta/distinct_tags/", response_model=List[str])
@handle_service_errors
async def get_distinct_tags_route(
    service: PaperViewService = Depends(get_paper_view_service)
):
    #logger.info("Router: Getting distinct tags.")
    try:
        tags = await service.get_distinct_tags()
    except DatabaseOperationException as e:
        logger.error(f"Router: Database error fetching distinct tags: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Router: Unexpected error fetching distinct tags: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
    logger.info(f"Router: Successfully fetched {len(tags)} distinct tags.")
    return tags

@router.get("/meta/distinct_venues/", response_model=List[str])
@handle_service_errors
async def get_distinct_venues_route(
    service: PaperViewService = Depends(get_paper_view_service)
):
    #logger.info("Router: Getting distinct venues.")
    try:
        venues = await service.get_distinct_venues()
    except DatabaseOperationException as e:
        logger.error(f"Router: Database error fetching distinct venues: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Router: Unexpected error fetching distinct venues: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
    #logger.info(f"Router: Successfully fetched {len(venues)} distinct venues.")
    return venues

@router.get("/meta/distinct_authors/", response_model=List[str])
@handle_service_errors
async def get_distinct_authors_route(
    service: PaperViewService = Depends(get_paper_view_service)
):
    #logger.info("Router: Getting distinct authors.")
    try:
        authors = await service.get_distinct_authors()
    except DatabaseOperationException as e:
        logger.error(f"Router: Database error fetching distinct authors: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Router: Unexpected error fetching distinct authors: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
    #logger.info(f"Router: Successfully fetched {len(authors)} distinct authors.")
    return authors

@router.get("/meta/status_counts/", response_model=Dict[str, int])
@handle_service_errors
async def get_paper_status_counts_route(
    service: PaperViewService = Depends(get_paper_view_service)
):
    #logger.info("Router: Getting paper status counts.")
    try:
        counts = await service.get_paper_count_by_status()
    except DatabaseOperationException as e:
        logger.error(f"Router: Database error fetching status counts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Router: Unexpected error fetching status counts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
    #logger.info(f"Router: Successfully fetched paper status counts: {counts}")
    return counts

# Placeholder for adding a new paper - this would typically be in a different service/router (e.g., admin or submission)
# For now, just showing how it might look if it were here and async.
# @router.post("/", response_model=PaperResponse, status_code=201)
# async def create_paper_route(
#     paper_data: PaperCreate,
#     service: PaperViewService = Depends(get_paper_view_service),
#     current_user: User = Depends(get_current_user) # Assuming creation requires auth
# ):
#     logger.info(f"Router: Attempting to create paper by user {current_user.username}")
#     user_id_str = str(current_user.id)
#     try:
#         # This method doesn't exist in PaperViewService, would be in e.g. PaperSubmissionService
#         # new_paper_db = await service.create_new_paper(paper_data, user_id_str)
#         # paper_response = await transform_paper_async(new_paper_db, user_id_str)
#         # return paper_response
#         raise NotImplementedError("Paper creation endpoint is not fully implemented in this router.")
#     except DatabaseOperationException as e:
#         raise HTTPException(status_code=500, detail=str(e))
#     except ServiceException as e:
#         raise HTTPException(status_code=400, detail=str(e)) # e.g. validation error in service
#     except Exception as e:
#         logger.error(f"Router: Unexpected error creating paper: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail="An unexpected error occurred.")

