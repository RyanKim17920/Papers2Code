from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..schemas_papers import PaperResponse, PaperActionsSummaryResponse, PaperActionUserDetail
from ..schemas_minimal import UserSchema, UserMinimal
from ..shared import (
    IMPL_STATUS_COMMUNITY_IMPLEMENTABLE,
    IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE
)
from ..database import get_papers_collection_sync, get_user_actions_collection_sync, get_users_collection_sync # Keep for get_paper_actions for now
from ..utils import transform_paper_async
from ..auth import get_current_user
from ..services.paper_action_service import PaperActionService
from ..services.exceptions import PaperNotFoundException, AlreadyVotedException, VoteProcessingException, InvalidActionException # Added InvalidActionException

router = APIRouter(
    prefix="/papers",
    tags=["paper-actions"],
)

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)

@router.post("/{paper_id}/vote", response_model=PaperResponse)
@limiter.limit("60/minute")
async def vote_on_paper(
    request: Request,  # For limiter
    paper_id: str,
    vote_type: str = Body(..., embed=True, pattern="^(up|none)$"),
    current_user: UserSchema = Depends(get_current_user)
):
    # Log the raw request body first to see what's coming in before Pydantic validation
    raw_body = await request.body()
    #logger.info(f"Vote request for paper_id: {paper_id}. Raw request body: {raw_body.decode()}")
    #logger.info(f"Vote request for paper_id: {paper_id}. Parsed vote_type: {vote_type}. User ID: {current_user.id}")

    paper_action_service = PaperActionService() # Instantiate the service

    try:
        user_id_str = str(current_user.id)
        if not user_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")

        updated_paper_doc = await paper_action_service.record_vote(
            paper_id=paper_id,
            user_id=user_id_str,
            vote_type=vote_type
        )

        if not updated_paper_doc:
            # This case should ideally be handled by exceptions from the service
            logger.error(f"Paper {paper_id} not found after voting operation, service returned None unexpectedly.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found after voting operation")

        return await transform_paper_async(updated_paper_doc, user_id_str, detail_level="full")

    except PaperNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AlreadyVotedException as e:
        # For "already voted" when trying to upvote, or "not voted" when trying to remove,
        # the service currently returns the paper state without error.
        # If we want to return a specific HTTP status for these, we'd adjust the service or handle here.
        # For now, assuming the service handles it by returning current paper, which is then transformed.
        # This part of the code might not be hit if the service doesn't raise AlreadyVotedException for "no action needed" cases.
        # However, if it *does* raise for an actual issue (e.g. trying to vote 'up' when already voted 'up' and this is an error condition)
        logger.warning(f"AlreadyVotedException for paper {paper_id}, user {current_user.id}: {e}")
        # We might want to return a 200 with current paper state or a 409 Conflict.
        # For now, let's assume the service handles returning the paper, and we transform it.
        # If the service raised it as a true error, re-raise as HTTP 409.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except VoteProcessingException as e:
        logger.error(f"VoteProcessingException for paper {paper_id}, user {current_user.id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper or user ID format")
    except HTTPException:
        raise
    except Exception:
        logger.exception("An internal server error occurred during voting in the router.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred during voting."
        )

@router.get("/{paper_id}/actions", response_model=PaperActionsSummaryResponse)
@limiter.limit("100/minute") # Keep limiter if needed
async def get_paper_actions(
    request: Request,  # For limiter
    paper_id: str
):
    #logger.info(f"Router: Received request to get actions for paper_id: {paper_id}")
    paper_action_service = PaperActionService()

    try:
        actions_summary = await paper_action_service.get_paper_actions(paper_id)
        return actions_summary
    except PaperNotFoundException as e:
        logger.warning(f"Router: PaperNotFoundException for paper_id {paper_id}: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e: # General exception handler
        logger.exception(f"Router: Error getting actions for paper_id {paper_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve paper actions.")

