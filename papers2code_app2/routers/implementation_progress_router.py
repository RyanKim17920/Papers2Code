import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional

from ..schemas.implementation_progress import (
    ImplementationProgress, 
    ProgressUpdate,
    EmailStatus
)
from ..services.implementation_progress_service import ImplementationProgressService
from ..dependencies import get_implementation_progress_service
from ..error_handlers import handle_service_errors
from ..services.exceptions import NotFoundException
from ..auth import get_current_user 
from ..schemas.minimal import UserSchema as UserInDBMinimalSchema

logger = logging.getLogger(__name__) 

router = APIRouter(
    prefix="/implementation-progress", 
    tags=["Implementation Progress"], 
)


@router.post("/paper/{paper_id}/join", response_model=ImplementationProgress, status_code=status.HTTP_200_OK)
@handle_service_errors
async def join_or_create_implementation_progress(
    paper_id: str,
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    """Join or create implementation progress for a paper."""
    try:
        progress = await service.join_or_create_progress(paper_id, str(current_user.id))
        return progress
    except Exception as e:
        logger.error(f"Error in join_or_create_implementation_progress: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.get("/paper/{paper_id}", response_model=Optional[ImplementationProgress])
@handle_service_errors
async def get_implementation_progress_for_paper(
    paper_id: str,
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    """Get implementation progress for a specific paper."""
    try:
        progress = await service.get_progress_by_paper_id(paper_id)
        if not progress:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No implementation progress found for paper ID {paper_id}")
        return progress
    except Exception as e:
        logger.error(f"Error in get_implementation_progress_for_paper: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.get("/{progress_id}", response_model=ImplementationProgress)
@handle_service_errors
async def get_implementation_progress_by_id(
    progress_id: str,
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    """Get implementation progress by ID."""
    try:
        progress = await service.get_progress_by_id(progress_id)
        if not progress:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Implementation progress with ID {progress_id} not found.")
        return progress
    except Exception as e:
        logger.error(f"Error in get_implementation_progress_by_id: {e}", exc_info=True)
        if isinstance(e, NotFoundException):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.put("/paper/{paper_id}", response_model=ImplementationProgress)
@handle_service_errors
async def update_implementation_progress_by_paper_id(
    paper_id: str,
    update_data: ProgressUpdate,
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    """Update implementation progress (email status and/or GitHub repo) by paper ID."""
    try:
        progress = await service.update_progress_by_paper_id(paper_id, str(current_user.id), update_data)
        return progress
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error in update_implementation_progress_by_paper_id: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")
