from fastapi import APIRouter, Depends, HTTPException, status, Request, Body, Response
from bson.errors import InvalidId
import logging
from ..dependencies import limiter, get_paper_action_service

from ..schemas.papers import PaperResponse, PaperActionsSummaryResponse
from ..schemas.minimal import UserSchema
from ..utils import transform_paper_async
from ..auth import get_current_user
from ..services.paper_action_service import PaperActionService, ACTION_PROJECT_STARTED, ACTION_PROJECT_JOINED # Added action types
from ..error_handlers import handle_service_errors

router = APIRouter(
    prefix="/papers",
    tags=["paper-actions"],
)
logger = logging.getLogger(__name__)

@router.post("/{paper_id}/vote", response_model=PaperResponse)
@limiter.limit("60/minute")
@handle_service_errors
async def vote_on_paper(
    request: Request,  # For limiter
    paper_id: str,
    vote_type: str = Body(..., embed=True, pattern="^(up|none)$"),
    current_user: UserSchema = Depends(get_current_user),
    service: PaperActionService = Depends(get_paper_action_service)
):
    # Raw request body can be logged for debugging if needed
    # raw_body = await request.body()
    # logger.info(f"Vote request for paper_id: {paper_id}. Raw request body: {raw_body.decode()}")
    #logger.info(f"Vote request for paper_id: {paper_id}. Parsed vote_type: {vote_type}. User ID: {current_user.id}")

    try:
        user_id_str = str(current_user.id)
        if not user_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")

        updated_paper_doc = await service.record_vote(
            paper_id=paper_id,
            user_id=user_id_str,
            vote_type=vote_type
        )

        if not updated_paper_doc:
            logger.error(
                f"Paper {paper_id} not found after voting operation, service returned None unexpectedly."
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found after voting operation")

        return await transform_paper_async(updated_paper_doc, user_id_str, detail_level="full")

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
@handle_service_errors
async def record_generic_paper_action(
    request: Request, # For limiter
    paper_id: str,
    action_type: str,
    current_user: UserSchema = Depends(get_current_user),
    details: dict = Body(None), # Optional details for the action
    service: PaperActionService = Depends(get_paper_action_service)
):
    logger.info(f"Action request for paper_id: {paper_id}. Action type: {action_type}. User ID: {current_user.id}")

    user_id_str = str(current_user.id)

    # Validate action_type if necessary, or let the service handle it
    # For example, ensure it's one of the predefined generic types if you have a specific list
    if action_type not in [ACTION_PROJECT_STARTED, ACTION_PROJECT_JOINED]: # Add other valid generic actions here
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid action type: {action_type}")

    try:
        await service.record_paper_related_action(
            paper_id=paper_id,
            user_id=user_id_str,
            action_type=action_type,
            details=details
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper or user ID format")
    except HTTPException:
        raise # Re-raise if it's already an HTTPException
    except Exception:
        logger.exception(
            f"An internal server error occurred during action recording for paper {paper_id}, action {action_type}."
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while recording the action."
        )

@router.get("/{paper_id}/actions", response_model=PaperActionsSummaryResponse)
@limiter.limit("100/minute")  # Keep limiter if needed
@handle_service_errors
async def get_paper_actions(
    request: Request,  # For limiter
    paper_id: str,
    service: PaperActionService = Depends(get_paper_action_service)
):
    #logger.info(f"Router: Received request to get actions for paper_id: {paper_id}")
    try:
        actions_summary = await service.get_paper_actions(paper_id)
        return actions_summary
    except Exception as e:  # General exception handler
        logger.exception(f"Router: Error getting actions for paper_id {paper_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve paper actions.")

