from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from bson.errors import InvalidId
from ..dependencies import limiter, get_paper_moderation_service
import logging  # Ensure logging is imported

from ..schemas.papers import (
    PaperResponse, SetImplementabilityRequest
)
from ..schemas.minimal import UserSchema
from ..utils import transform_papers_batch
from ..auth import get_current_user, get_current_owner
from ..services.paper_moderation_service import PaperModerationService
from ..error_handlers import handle_service_errors

router = APIRouter(
    prefix="/papers",
    tags=["paper-moderation"],
)
logger = logging.getLogger(__name__)

@router.post("/{paper_id}/flag_implementability", response_model=PaperResponse)
@limiter.limit("30/minute")
@handle_service_errors
async def flag_paper_implementability(
    request: Request, # For limiter
    paper_id: str,
    action: str = Body(..., embed=True, pattern="^(confirm|dispute|retract)$"),
    current_user: UserSchema = Depends(get_current_user),
    service: PaperModerationService = Depends(get_paper_moderation_service)
):
    #logger.info(f"Router: Received request to flag implementability for paper_id: {paper_id}, action: {action}, user: {current_user.id}")
    
    user_id_str = str(current_user.id)

    if not user_id_str: # Should be caught by get_current_user if it raises, but good practice
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")

    try:
        updated_paper_doc = await service.flag_paper_implementability(
            paper_id=paper_id,
            user_id=user_id_str,
            action=action,
        )
        # Use batch transformation for consistency
        transformed_papers = await transform_papers_batch([updated_paper_doc], user_id_str, detail_level="full")
        return transformed_papers[0] if transformed_papers else updated_paper_doc

    except InvalidId:  # This might still be raised by ObjectId conversion if not caught in service for some reason
        logger.warning(f"Router: InvalidId encountered for paper {paper_id} or user {user_id_str}.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format.")
    except HTTPException: # Re-raise HTTPExceptions if they were raised directly
        raise
    except Exception as e: # Fallback for truly unexpected errors in the router layer
        logger.exception(f"Router: Unexpected error in flag_paper_implementability for paper {paper_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected internal server error occurred."
        )

@router.post("/{paper_id}/set_implementability", response_model=PaperResponse)
@limiter.limit("10/minute")
@handle_service_errors
async def set_paper_implementability(
    request: Request, # For limiter
    paper_id: str,
    payload: SetImplementabilityRequest,
    current_user: UserSchema = Depends(get_current_owner), # Ensures only owner can call
    service: PaperModerationService = Depends(get_paper_moderation_service)
):
    #logger.info(f"Router: Received request to set implementability for paper_id: {paper_id} by admin: {current_user.id} to '{payload.status_to_set}'")
    admin_user_id_str = str(current_user.id)

    if not admin_user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin user ID not found")

    try:
        updated_paper_doc = await service.set_paper_implementability(
            paper_id=paper_id,
            admin_user_id=admin_user_id_str,
            status_to_set_by_admin=payload.status_to_set,
        )
        # Use batch transformation for consistency
        transformed_papers = await transform_papers_batch([updated_paper_doc], admin_user_id_str, detail_level="full")
        return transformed_papers[0] if transformed_papers else updated_paper_doc

    except InvalidId:  # Should be caught by service, but as a fallback
        logger.warning(f"Router: InvalidId encountered for set_implementability paper {paper_id}.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper ID format.")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Router: Unexpected error in set_paper_implementability for paper {paper_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected internal server error occurred."
        )

@router.delete("/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
@handle_service_errors
async def delete_paper(
    request: Request, # For limiter
    paper_id: str,
    current_user: UserSchema = Depends(get_current_owner),
    service: PaperModerationService = Depends(get_paper_moderation_service)
):
    #logger.info(f"Router: Received request to delete paper_id: {paper_id} by admin: {current_user.id}")
    admin_user_id_str = str(current_user.id)

    if not admin_user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin user ID not found")

    try:
        success = await service.delete_paper(paper_id=paper_id, admin_user_id=admin_user_id_str)
        if success:
            return None
        logger.error(f"Router: delete_paper service call for {paper_id} returned False unexpectedly.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Deletion failed for an unknown reason.")

    except InvalidId:  # Should be caught by service
        logger.warning(f"Router: InvalidId encountered for delete_paper {paper_id}.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper ID format.")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Router: Unexpected error in delete_paper for {paper_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected internal server error occurred during paper deletion."
        )

