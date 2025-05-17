from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from typing import Optional
from pymongo.errors import OperationFailure
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..schemas import PaperResponse, PapersResponse, User, PyObjectId
from ..shared import (
    get_papers_collection_sync,
    transform_paper_sync,
    config_settings
)
from ..auth import get_current_user_optional_placeholder

router = APIRouter(
    prefix="/papers",
    tags=["paper-views"],
)

limiter = Limiter(key_func=get_remote_address)

# Original Flask: @limiter.limit("60 per minute")
@router.get("/", response_model=PapersResponse)
@limiter.limit("60/minute")
async def get_papers(
    request: Request,  # For rate limiting
    s: Optional[str] = Query(None, description='Search query for Atlas Search. Supports field-specific searches like \'title:"Deep Learning" AND authors:"Yann LeCun"\' or general text search.'),
    page: int = Query(1, ge=1, description="Page number for pagination."),
    limit: int = Query(10, ge=1, le=100, description="Number of items per page."),
    sort_by: Optional[str] = Query("publication_date", description="Field to sort by. Default is 'publication_date'. Other options: 'title', 'citations', 'score' (if search query 's' is provided)."),
    sort_order: Optional[str] = Query("desc", description="Sort order: 'asc' or 'desc'. Default is 'desc'."),
    current_user: Optional[User] = Depends(get_current_user_optional_placeholder)
):
    user_id_str = current_user.id if current_user else None
    papers_collection = get_papers_collection_sync()
    skip = (page - 1) * limit

    query_filter = {}
    search_pipeline = []

    # Default sort order
    sort_field = sort_by if sort_by else "publication_date"
    sort_direction = -1 if sort_order == "desc" else 1

    if s:  # Atlas Search path
        search_stage = {
            "$search": {
                "index": config_settings.ATLAS_SEARCH_INDEX_NAME,
            }
        }

        if any(op in s for op in [":", "AND", "OR", "NOT", "(", ")"]):
            search_stage["$search"]["text"] = {
                "query": s,
                "path": {"wildcard": "*"}
            }
        else:
            search_stage["$search"]["text"] = {
                "query": s,
                "path": {"wildcard": "*"}
            }

        search_pipeline.append(search_stage)

        if sort_field == "score":
            search_pipeline.append({
                "$addFields": {
                    "score": {"$meta": "searchScore"}
                }
            })

        sort_stage = {"$sort": {sort_field: sort_direction}}
        search_pipeline.append(sort_stage)

        search_pipeline.extend([
            {"$skip": skip},
            {"$limit": limit}
        ])

        count_pipeline_stages = []
        count_pipeline_stages.append(search_stage)
        count_pipeline_stages.append({"$count": "total_count"})

        try:
            cursor = papers_collection.aggregate(search_pipeline)
            papers_list = await cursor.to_list(length=limit)

            count_cursor = papers_collection.aggregate(count_pipeline_stages)
            count_result = await count_cursor.to_list(length=1)
            total_papers = count_result[0]["total_count"] if count_result and "total_count" in count_result[0] else 0

        except OperationFailure as e:
            print(f"Atlas Search OperationFailure: {e.details}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Search query failed: {e.details.get('errmsg', 'Unknown search error')}")
        except Exception as e:
            print(f"Error during Atlas Search aggregation: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error processing search results.")

    else:  # No search query 's', use regular find with filters
        cursor = papers_collection.find(query_filter).sort(sort_field, sort_direction).skip(skip).limit(limit)
        papers_list = await cursor.to_list(length=limit)
        total_papers = await papers_collection.count_documents(query_filter)

    transformed_papers = [transform_paper_sync(paper, user_id_str) for paper in papers_list]

    return PapersResponse(
        papers=transformed_papers,
        total_papers=total_papers,
        page=page,
        limit=limit,
        sort_by=sort_field,
        sort_order=sort_order
    )

# Original Flask: @limiter.limit("60 per minute")
@router.get("/{paper_id}", response_model=PaperResponse)
@limiter.limit("60/minute")
async def get_paper_by_id(
    request: Request,  # For rate limiting
    paper_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional_placeholder)
):
    user_id_str = current_user.id if current_user else None
    try:
        obj_id = PyObjectId(paper_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper ID format")

    papers_collection = get_papers_collection_sync()
    paper = await papers_collection.find_one({"_id": obj_id})

    if paper:
        return transform_paper_sync(paper, user_id_str)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Paper with id {paper_id} not found")

