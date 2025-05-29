from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging # Ensure logging is imported
import traceback

from ..schemas_papers import (
    PaperResponse, SetImplementabilityRequest
)
from ..schemas_minimal import UserSchema
from ..shared import (
    config_settings,
    # Import the constants
    IMPL_STATUS_VOTING,
    IMPL_STATUS_COMMUNITY_IMPLEMENTABLE,
    IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE,
    MAIN_STATUS_NOT_IMPLEMENTABLE, # Import new constant
    MAIN_STATUS_NOT_STARTED # Import new constant
)
from ..database import (
    get_papers_collection_sync,
    get_user_actions_collection_sync,
    get_removed_papers_collection_sync
)
from ..utils import transform_paper_async
from ..auth import get_current_user, get_current_owner
from ..services.paper_moderation_service import PaperModerationService
from ..services.exceptions import PaperNotFoundException, UserActionException, InvalidActionException, ServiceException

router = APIRouter(
    prefix="/papers",
    tags=["paper-moderation"],
)

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)

@router.post("/{paper_id}/flag_implementability", response_model=PaperResponse)
@limiter.limit("30/minute")
async def flag_paper_implementability(
    request: Request, # For limiter
    paper_id: str,
    action: str = Body(..., embed=True, pattern="^(confirm|dispute|retract)$"),
    current_user: UserSchema = Depends(get_current_user)
):
    logger.info(f"Router: Received request to flag implementability for paper_id: {paper_id}, action: {action}, user: {current_user.id}")
    
    moderation_service = PaperModerationService()
    user_id_str = str(current_user.id)

    if not user_id_str: # Should be caught by get_current_user if it raises, but good practice
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")

    try:
        updated_paper_doc = await moderation_service.flag_paper_implementability(
            paper_id=paper_id,
            user_id=user_id_str,
            action=action
        )
        # Await the async transformation
        return await transform_paper_async(updated_paper_doc, user_id_str, detail_level="full")

    except PaperNotFoundException as e:
        logger.warning(f"Router: PaperNotFoundException for paper {paper_id}: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except UserActionException as e: # Covers cases like "already voted", "no vote to retract", "admin lock"
        logger.warning(f"Router: UserActionException for paper {paper_id}, user {user_id_str}, action {action}: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) # 400 or 409 depending on specific case
    except InvalidActionException as e: # e.g. invalid 'action' string
        logger.warning(f"Router: InvalidActionException for paper {paper_id}, action {action}: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ServiceException as e: # Catch-all for other service-layer issues
        logger.error(f"Router: ServiceException during flag_implementability for paper {paper_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An internal server error occurred.")
    except InvalidId: # This might still be raised by ObjectId conversion if not caught in service for some reason
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
async def set_paper_implementability(
    request: Request, # For limiter
    paper_id: str,
    payload: SetImplementabilityRequest,
    current_user: UserSchema = Depends(get_current_owner) # Ensures only owner can call
):
    logger.info(f"Router: Received request to set implementability for paper_id: {paper_id} by admin: {current_user.id} to '{payload.status_to_set}'")
    moderation_service = PaperModerationService()
    admin_user_id_str = str(current_user.id)

    if not admin_user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin user ID not found")

    try:
        updated_paper_doc = await moderation_service.set_paper_implementability(
            paper_id=paper_id,
            admin_user_id=admin_user_id_str,
            status_to_set_by_admin=payload.status_to_set
        )
        # Await the async transformation
        return await transform_paper_async(updated_paper_doc, admin_user_id_str, detail_level="full")

    except PaperNotFoundException as e:
        logger.warning(f"Router: PaperNotFoundException for set_implementability paper {paper_id}: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except InvalidActionException as e:
        logger.warning(f"Router: InvalidActionException for set_implementability paper {paper_id}: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ServiceException as e:
        logger.error(f"Router: ServiceException during set_implementability for paper {paper_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An internal server error occurred.")
    except InvalidId: # Should be caught by service, but as a fallback
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
async def delete_paper(
    request: Request, # For limiter
    paper_id: str,
    current_user: UserSchema = Depends(get_current_owner)
):
    logger.info(f"Router: Received request to delete paper_id: {paper_id} by admin: {current_user.id}")
    moderation_service = PaperModerationService()
    admin_user_id_str = str(current_user.id)

    if not admin_user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin user ID not found")

    try:
        success = await moderation_service.delete_paper(paper_id=paper_id, admin_user_id=admin_user_id_str)
        if success: # Service returns True on success
            return None # FastAPI will return 204 No Content based on status_code in decorator
        else:
            # This case should ideally be covered by exceptions from the service
            logger.error(f"Router: delete_paper service call for {paper_id} returned False unexpectedly.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Deletion failed for an unknown reason.")

    except PaperNotFoundException as e:
        logger.warning(f"Router: PaperNotFoundException for delete_paper {paper_id}: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ServiceException as e:
        logger.error(f"Router: ServiceException during delete_paper for {paper_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An internal server error occurred during deletion.")
    except InvalidId: # Should be caught by service
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

