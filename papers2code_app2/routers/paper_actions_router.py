from fastapi import APIRouter, Depends, HTTPException, status, Request, Body, Response # Added Response
from bson.errors import InvalidId
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..schemas_papers import PaperResponse, PaperActionsSummaryResponse
from ..schemas_minimal import UserSchema
from ..utils import transform_paper_async
from ..auth import get_current_user
from ..services.paper_action_service import PaperActionService, ACTION_PROJECT_STARTED, ACTION_PROJECT_JOINED # Added action types
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
    # Raw request body can be logged for debugging if needed
    # raw_body = await request.body()
    # logger.info(f"Vote request for paper_id: {paper_id}. Raw request body: {raw_body.decode()}")
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

@router.post("/{paper_id}/actions/{action_type}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")
async def record_generic_paper_action(
    request: Request, # For limiter
    paper_id: str,
    action_type: str,
    current_user: UserSchema = Depends(get_current_user),
    details: dict = Body(None) # Optional details for the action
):
    logger.info(f"Action request for paper_id: {paper_id}. Action type: {action_type}. User ID: {current_user.id}")

    paper_action_service = PaperActionService()
    user_id_str = str(current_user.id)

    # Validate action_type if necessary, or let the service handle it
    # For example, ensure it's one of the predefined generic types if you have a specific list
    if action_type not in [ACTION_PROJECT_STARTED, ACTION_PROJECT_JOINED]: # Add other valid generic actions here
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid action type: {action_type}")

    try:
        await paper_action_service.record_paper_related_action(
            paper_id=paper_id,
            user_id=user_id_str,
            action_type=action_type,
            details=details
        )
        # No content to return, so FastAPI will handle the 204 response
        return Response(status_code=status.HTTP_204_NO_CONTENT) 

    except PaperNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except InvalidActionException as e:
        logger.error(f"InvalidActionException for paper {paper_id}, user {user_id_str}, action {action_type}: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper or user ID format")
    except HTTPException:
        raise # Re-raise if it's already an HTTPException
    except Exception as e:
        logger.exception(f"An internal server error occurred during action recording for paper {paper_id}, action {action_type}.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while recording the action."
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

