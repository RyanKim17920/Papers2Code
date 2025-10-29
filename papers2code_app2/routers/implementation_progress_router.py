import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import Optional
from pydantic import BaseModel

from ..schemas.implementation_progress import (
    ImplementationProgress, 
    ProgressUpdateRequest,
    ProgressStatus
)
from ..services.implementation_progress_service import ImplementationProgressService
from ..services.github_repo_service import GitHubRepoService
from ..dependencies import get_implementation_progress_service
from ..error_handlers import handle_service_errors
from ..services.exceptions import NotFoundException
from ..auth import get_current_user 
from ..schemas.minimal import UserSchema as UserInDBMinimalSchema
from ..database import get_users_collection_async

logger = logging.getLogger(__name__) 

router = APIRouter(
    prefix="/implementation-progress", 
    tags=["Implementation Progress"], 
)


async def require_github_account(current_user: UserInDBMinimalSchema):
    """
    Check if the user has a linked GitHub account.
    Raises HTTPException if no GitHub account is linked.
    """
    if not current_user.githubId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="GitHub account required for implementation features. Please link your GitHub account to access this feature."
        )


@router.post("/paper/{paper_id}/join", response_model=ImplementationProgress, status_code=status.HTTP_200_OK)
@handle_service_errors
async def join_or_create_implementation_progress(
    paper_id: str,
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    """Join or create implementation progress for a paper. Requires GitHub account."""
    await require_github_account(current_user)
    
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
    update_data: ProgressUpdateRequest,
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    """Update implementation progress (status and/or GitHub repo) by paper ID. Requires GitHub account."""
    await require_github_account(current_user)
    
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

@router.post("/paper/{paper_id}/send-author-email", status_code=status.HTTP_200_OK)
@handle_service_errors
async def send_author_outreach_email_route(
    paper_id: str,
    current_user: UserInDBMinimalSchema = Depends(get_current_user), # Consider adding admin check here
    service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    """Trigger sending of author outreach email for a paper."""
    # In a real application, you'd want to ensure only authorized users (e.g., admins) can trigger this.
    # For now, we'll just check if a user is logged in.
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required to send emails.")
    
    try:
        result = await service.send_author_outreach_email(paper_id, str(current_user.id))
        return result
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error in send_author_outreach_email_route for paper {paper_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while sending the email.")


@router.post("/paper/{paper_id}/create-github-repo", status_code=status.HTTP_200_OK)
@handle_service_errors
async def create_github_repository_for_paper(
    paper_id: str,
    current_user: UserInDBMinimalSchema = Depends(get_current_user),
    progress_service: ImplementationProgressService = Depends(get_implementation_progress_service)
):
    """
    Automatically create a GitHub repository from template for the paper and link it to implementation progress.
    The repository will be named after the paper title and pre-filled with paper metadata.
    Requires GitHub account.
    """
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    
    await require_github_account(current_user)
    
    try:
        # Get user's GitHub access token from database
        users_collection = await get_users_collection_async()
        user_doc = await users_collection.find_one({"_id": current_user.id})
        
        if not user_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        
        github_token = user_doc.get("githubAccessToken")
        if not github_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GitHub access token not found. Please re-authenticate with GitHub."
            )
        
        # Get paper details from database to extract metadata
        from ..database import get_papers_collection_async
        papers_collection = await get_papers_collection_async()
        from bson import ObjectId
        paper = await papers_collection.find_one({"_id": ObjectId(paper_id)})
        
        if not paper:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found.")
        
        # Create the repository using the paper metadata
        github_service = GitHubRepoService()
        repo_data = await github_service.create_repository_from_paper(
            access_token=github_token,
            paper_data=paper,
            paper_id=paper_id
        )
        
        # Automatically link the repository to the implementation progress
        repo_full_name = repo_data["full_name"]
        updated_progress = await progress_service.update_progress_by_paper_id(
            paper_id=paper_id,
            user_id=str(current_user.id),
            progress_update=ProgressUpdateRequest(githubRepoId=repo_full_name)
        )
        
        return {
            "success": True,
            "repository": repo_data,
            "progress": updated_progress
        }
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating GitHub repository for paper {paper_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the repository."
        )
