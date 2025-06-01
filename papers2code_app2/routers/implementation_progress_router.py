# papers2code_app2/routers/implementation_progress_router.py
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List, Optional
from pydantic import BaseModel

from ..schemas_implementation_progress import ( 
    ImplementationProgress, 
    ComponentUpdate,
    Component, 
    ProgressStatus 
)
from ..services.implementation_progress_service import ImplementationProgressService
from ..services.exceptions import NotFoundException, AlreadyExistsException, UserNotContributorException, InvalidRequestException
from ..auth import get_current_user 
from ..schemas_minimal import UserSchema as UserInDBMinimalSchema

logger = logging.getLogger(__name__) 

router = APIRouter(
    prefix="/implementation-progress", 
    tags=["Implementation Progress"], 
)

# Dependency to get the service
def get_implementation_progress_service() -> ImplementationProgressService:
    return ImplementationProgressService()

@router.post("/paper/{paper_id}/join", response_model=ImplementationProgress, status_code=status.HTTP_200_OK) 
async def join_or_create_implementation_progress(
    paper_id: str,
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    try:
        progress = await service.join_or_create_progress(paper_id, str(current_user.id))
        return progress
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except InvalidRequestException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in join_or_create_implementation_progress: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.get("/paper/{paper_id}", response_model=Optional[ImplementationProgress]) 
async def get_implementation_progress_for_paper(
    paper_id: str,
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    try:
        progress = await service.get_progress_by_paper_id(paper_id)
        # Return 404 if progress is None, which is a valid response for Optional[ImplementationProgress]
        # The client will receive null if not found, which is fine. Or we can explicitly raise 404.
        # For consistency with other GET by ID, let's raise 404 if not found.
        if not progress:
            # This was commented out, but it's good practice to return 404 if the specific resource (progress for this paper) isn't found.
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No implementation progress found for paper ID {paper_id}")
        return progress
    except InvalidRequestException as e: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in get_implementation_progress_for_paper: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.get("/{progress_id}", response_model=ImplementationProgress) 
async def get_implementation_progress_by_id_route( 
    progress_id: str,
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    try:
        progress = await service.get_progress_by_id(progress_id)
        if not progress:
            # This was previously raising NotFoundException from the service, which is good.
            # Here, we ensure it translates to HTTP 404.
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Implementation progress with ID {progress_id} not found.")
        return progress
    # Removed redundant NotFoundException catch, as the service raises it and it would be caught by the generic Exception handler or a specific one if needed.
    except InvalidRequestException as e: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in get_implementation_progress_by_id_route: {e}", exc_info=True)
        # If the service raised NotFoundException, it will be caught here if not handled before.
        if isinstance(e, NotFoundException):
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.post("/{progress_id}/sections/{section_id}/components", response_model=ImplementationProgress, status_code=status.HTTP_201_CREATED) 
async def add_component_to_progress_section(
    progress_id: str,
    section_id: str, 
    component_data: Component, 
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    try:
        progress = await service.add_component_to_progress(progress_id, str(current_user.id), component_data, section_id)
        return progress
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except UserNotContributorException as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except InvalidRequestException as e: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in add_component_to_progress_section: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.put("/{progress_id}/sections/{section_id}/components/{component_id}", response_model=ImplementationProgress) 
async def update_component_in_progress_section(
    progress_id: str,
    section_id: str, 
    component_id: str,
    component_data: ComponentUpdate, 
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    try:
        progress = await service.update_component_in_progress(progress_id, section_id, component_id, str(current_user.id), component_data)
        return progress
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except UserNotContributorException as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except InvalidRequestException as e: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in update_component_in_progress_section: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.delete("/{progress_id}/sections/{section_id}/components/{component_id}", response_model=ImplementationProgress) 
async def remove_component_from_progress_section(
    progress_id: str,
    section_id: str, 
    component_id: str,
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    try:
        progress = await service.remove_component_from_progress(progress_id, section_id, component_id, str(current_user.id))
        return progress
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except UserNotContributorException as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except InvalidRequestException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error in remove_component_from_progress_section: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

class ProgressStatusUpdatePayload(BaseModel):
    new_status: ProgressStatus

@router.put("/{progress_id}/status", response_model=ImplementationProgress) 
async def update_progress_status_endpoint(
    progress_id: str,
    payload: ProgressStatusUpdatePayload,
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    try:
        progress = await service.update_progress_status(progress_id, str(current_user.id), payload.new_status)
        return progress
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except UserNotContributorException as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except InvalidRequestException as e: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValueError as e: 
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Error in update_progress_status_endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")
