import logging
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId

from ..database import (
    get_implementation_progress_collection_async, 
    get_papers_collection_async,
    get_users_collection_async
)
from ..cache import paper_cache
from ..schemas.implementation_progress import (
    ImplementationProgress,
    ProgressUpdateRequest,
    ProgressUpdateEvent,
    UpdateEventType,
    ProgressStatus,
)
from .exceptions import NotFoundException, UserNotContributorException, InvalidRequestException
# Import PaperActionService and action types
from .paper_action_service import PaperActionService, ACTION_PROJECT_STARTED, ACTION_PROJECT_JOINED
from ..schemas.db_models import PyObjectId
from ..email_templates import get_author_outreach_email_template

logger = logging.getLogger(__name__)

class ImplementationProgressService:
    def __init__(self):
        self.paper_action_service = PaperActionService()

    async def get_progress_by_id(self, progress_id: str) -> Optional[ImplementationProgress]: 
        collection = await get_implementation_progress_collection_async() 
        try:
            progress_obj_id = ObjectId(progress_id)
        except Exception:
            logger.warning(f"Invalid ObjectId format for progress_id: {progress_id}")
            return None
        progress_data = await collection.find_one({"_id": progress_obj_id})
        if progress_data:
            return ImplementationProgress(**progress_data) 
        return None

    async def get_progress_by_paper_id(self, paper_id: str) -> Optional[ImplementationProgress]: 
        collection = await get_implementation_progress_collection_async() 
        try:
            paper_obj_id = ObjectId(paper_id)
        except Exception:
            logger.warning(f"Invalid paper_id format: {paper_id}")
            return None
        
        # Try to find by ObjectId first, then by string (for backward compatibility)
        progress_data = await collection.find_one({"_id": paper_obj_id})
        if not progress_data:
            progress_data = await collection.find_one({"_id": paper_id})
        
        if progress_data:
            return ImplementationProgress(**progress_data) 
        return None

    async def join_or_create_progress(self, paper_id: str, user_id: str) -> ImplementationProgress: 
        papers_collection = await get_papers_collection_async()
        try:
            paper_obj_id = PyObjectId(paper_id)
            user_obj_id = PyObjectId(user_id)
        except Exception as e:
            logger.error(f"Invalid ObjectId format for paper_id or user_id: {e}")
            raise InvalidRequestException("Invalid paper or user ID format.")

        paper = await papers_collection.find_one({"_id": paper_obj_id})
        if not paper:
            raise NotFoundException(f"Paper with ID {paper_id} not found.")

        users_collection = await get_users_collection_async()
        user = await users_collection.find_one({"_id": user_obj_id})
        if not user:
            raise NotFoundException(f"User with ID {user_id} not found.")

        progress_collection = await get_implementation_progress_collection_async() 
        existing_progress_data = await progress_collection.find_one({"_id": paper_obj_id})
        if not existing_progress_data:
            # Try as string if ObjectId didn't work (backward compatibility)
            existing_progress_data = await progress_collection.find_one({"_id": paper_id})

        current_time = datetime.now(timezone.utc)

        if existing_progress_data:
            existing_progress = ImplementationProgress(**existing_progress_data) 
            if user_obj_id not in existing_progress.contributors:
                # Create a contributor joined event
                join_event = ProgressUpdateEvent(
                    event_type=UpdateEventType.CONTRIBUTOR_JOINED,
                    timestamp=current_time,
                    user_id=user_obj_id,
                    details={}
                )
                
                # Use the actual _id from the found document
                await progress_collection.update_one(
                    {"_id": existing_progress_data["_id"]}, 
                    {
                        "$addToSet": {"contributors": user_obj_id},
                        "$push": {"updates": join_event.model_dump(by_alias=True)},
                        "$set": {
                            "latestUpdate": current_time,
                            "updatedAt": current_time
                        }
                    }
                )
                # Log ACTION_PROJECT_JOINED
                try:
                    await self.paper_action_service.record_paper_related_action(
                        paper_id=paper_id,
                        user_id=user_id,
                        action_type=ACTION_PROJECT_JOINED,
                        details={"progress_id": str(existing_progress_data["_id"])}
                    )
                except Exception as e_log:
                    logger.error(f"Failed to log ACTION_PROJECT_JOINED for user {user_id}, paper {paper_id}, progress {existing_progress_data['_id']}: {e_log}")
            # Re-fetch to get the potentially updated document
            updated_progress_data = await progress_collection.find_one({"_id": existing_progress_data["_id"]})
            if not updated_progress_data:
                 raise NotFoundException(f"Failed to retrieve progress {existing_progress_data['_id']} after update attempt.")
            return ImplementationProgress(**updated_progress_data) 
        else:
            # Use the .new() classmethod from ImplementationProgress schema
            new_progress = ImplementationProgress.new(paper_id=paper_obj_id, user_id=user_obj_id) 
            
            # Convert to dict but ensure _id remains as ObjectId
            progress_to_insert = new_progress.model_dump(by_alias=True)
            # Explicitly set _id as ObjectId (not string)
            progress_to_insert["_id"] = paper_obj_id
            
            try:
                result = await progress_collection.insert_one(progress_to_insert)

                # Update the paper's status to 'Started'
                await papers_collection.update_one(
                    {"_id": paper_obj_id},
                    {"$set": {"status": "Started"}}
                )
                
                # Update paper status in cache instead of clearing all
                await paper_cache.update_paper_in_cache(paper_id, "Started")

                created_progress_data = await progress_collection.find_one({"_id": result.inserted_id})
                if not created_progress_data:
                    raise NotFoundException("Failed to retrieve newly created progress.")
                
                # Log ACTION_PROJECT_STARTED
                try:
                    await self.paper_action_service.record_paper_related_action(
                        paper_id=paper_id,
                        user_id=user_id,
                        action_type=ACTION_PROJECT_STARTED,
                        details={"progress_id": str(result.inserted_id)}
                    )
                except Exception as e_log:
                    logger.error(f"Failed to log ACTION_PROJECT_STARTED for user {user_id}, paper {paper_id}, progress {str(result.inserted_id)}: {e_log}")

                return ImplementationProgress(**created_progress_data)
            except Exception as e:
                # Handle duplicate key error due to unique constraint on _id
                if "duplicate key" in str(e).lower() or "11000" in str(e):
                    logger.info(f"Duplicate _id detected for paper {paper_id}, fetching existing progress")
                    # Try to fetch the existing progress that was created concurrently
                    # Try both ObjectId and string versions since we might have mixed data
                    existing_progress_data = await progress_collection.find_one({"_id": paper_obj_id})
                    if not existing_progress_data:
                        # Try as string if ObjectId didn't work
                        existing_progress_data = await progress_collection.find_one({"_id": paper_id})
                    
                    if existing_progress_data:
                        existing_progress = ImplementationProgress(**existing_progress_data)
                        # Add user as contributor if not already there
                        if user_obj_id not in existing_progress.contributors:
                            # Create a contributor joined event
                            join_event = ProgressUpdateEvent(
                                event_type=UpdateEventType.CONTRIBUTOR_JOINED,
                                timestamp=current_time,
                                user_id=user_obj_id,
                                details={}
                            )
                            # Use the actual _id from the found document
                            await progress_collection.update_one(
                                {"_id": existing_progress_data["_id"]}, 
                                {
                                    "$addToSet": {"contributors": user_obj_id},
                                    "$push": {"updates": join_event.model_dump(by_alias=True)},
                                    "$set": {
                                        "latestUpdate": current_time,
                                        "updatedAt": current_time
                                    }
                                }
                            )
                        # Return the updated progress
                        updated_progress_data = await progress_collection.find_one({"_id": existing_progress_data["_id"]})
                        if updated_progress_data:
                            return ImplementationProgress(**updated_progress_data)
                raise e

    async def send_author_outreach_email(self, paper_id: str, user_id: str):
        """Fetches paper details and generates the author outreach email template."""
        papers_collection = await get_papers_collection_async()
        paper = await papers_collection.find_one({"_id": ObjectId(paper_id)})
        if not paper:
            raise NotFoundException(f"Paper with ID {paper_id} not found for email outreach.")

        paper_title = paper.get("title", "")
        # Assuming a base URL for paper details page
        paper_link = f"https://papers2code.com/paper/{paper_id}" # Replace with your actual domain

        email_content = get_author_outreach_email_template(paper_title, paper_link)
        
        # Create email sent event in the progress
        progress_collection = await get_implementation_progress_collection_async()
        current_time = datetime.now(timezone.utc)
        
        try:
            paper_obj_id = PyObjectId(paper_id)
            user_obj_id = PyObjectId(user_id)
        except Exception:
            raise InvalidRequestException("Invalid paper or user ID format.")
        
        email_event = ProgressUpdateEvent(
            event_type=UpdateEventType.EMAIL_SENT,
            timestamp=current_time,
            user_id=user_obj_id,
            details={}
        )
        
        # Also create a status changed event to EMAIL_SENT
        status_event = ProgressUpdateEvent(
            event_type=UpdateEventType.STATUS_CHANGED,
            timestamp=current_time,
            user_id=user_obj_id,
            details={
                "previousStatus": ProgressStatus.STARTED.value,
                "newStatus": ProgressStatus.EMAIL_SENT.value
            }
        )
        
        # Update progress with email sent event and status change
        await progress_collection.update_one(
            {"_id": paper_obj_id},
            {
                "$push": {
                    "updates": {
                        "$each": [
                            email_event.model_dump(by_alias=True),
                            status_event.model_dump(by_alias=True)
                        ]
                    }
                },
                "$set": {
                    "status": ProgressStatus.EMAIL_SENT.value,
                    "latestUpdate": current_time,
                    "updatedAt": current_time
                }
            }
        )
        
        # Update paper status
        await papers_collection.update_one(
            {"_id": paper_obj_id},
            {"$set": {"status": "Waiting for Author Response"}}
        )
        
        # Update paper status in cache instead of clearing all
        await paper_cache.update_paper_in_cache(paper_id, "Waiting for Author Response")
        
        # In a real application, you would integrate with an email sending service here.
        # For now, we'll just log the content.
        return {"message": "Email content generated and logged (email not actually sent).", "subject": email_content['subject'], "body": email_content['body']}

    async def update_progress_by_paper_id(self, paper_id: str, user_id: str, progress_update: ProgressUpdateRequest) -> ImplementationProgress:
        """Update status or GitHub repo ID for a progress by paper ID."""
        logger.info(f"update_progress_by_paper_id called with paper_id: {paper_id}, user_id: {user_id}")
        
        progress_collection = await get_implementation_progress_collection_async() 
        papers_collection = await get_papers_collection_async()
        try:
            paper_obj_id = PyObjectId(paper_id)
            user_obj_id = PyObjectId(user_id)
            logger.info(f"Converted to ObjectId - paper_obj_id: {paper_obj_id}, user_obj_id: {user_obj_id}")
        except Exception:
            raise InvalidRequestException("Invalid paper or user ID format.")
            
        # Search by _id directly (since _id is the paper_id)
        # Try ObjectId first, then string for backward compatibility
        logger.info(f"Searching for progress with _id: {paper_obj_id}")
        progress_data = await progress_collection.find_one({"_id": paper_obj_id})
        if not progress_data:
            logger.info(f"Not found as ObjectId, trying as string: {paper_id}")
            progress_data = await progress_collection.find_one({"_id": paper_id})
        logger.info(f"Found progress_data: {progress_data}")
        
        if not progress_data:
            raise NotFoundException(f"Implementation progress for paper ID {paper_id} not found.")

        progress = ImplementationProgress(**progress_data) 
        if user_obj_id not in progress.contributors:
            raise UserNotContributorException("User is not a contributor to this progress.")

        update_data = progress_update.model_dump(exclude_unset=True)
        if not update_data:
            raise InvalidRequestException("No update data provided.")
        
        current_time = datetime.now(timezone.utc)
        update_fields = {
            "latestUpdate": current_time,
            "updatedAt": current_time
        }
        events_to_add = []
        
        # Handle status changes
        if 'status' in update_data:
            new_status = update_data['status']
            if new_status != progress.status:
                # Validation: Check if GitHub repo is required for certain statuses
                github_required_statuses = [
                    ProgressStatus.OFFICIAL_CODE_POSTED,
                    ProgressStatus.REFACTORING_STARTED,
                    ProgressStatus.REFACTORING_FINISHED,
                    ProgressStatus.CODE_NEEDED
                ]
                
                if new_status in github_required_statuses and not progress.github_repo_id:
                    raise InvalidRequestException(
                        f"GitHub repository must be linked before updating status to '{new_status.value}'. "
                        "Please add the GitHub repository first."
                    )
                
                # Create status changed event
                status_event = ProgressUpdateEvent(
                    event_type=UpdateEventType.STATUS_CHANGED,
                    timestamp=current_time,
                    user_id=user_obj_id,
                    details={
                        "previousStatus": progress.status.value if progress.status else None,
                        "newStatus": new_status.value
                    }
                )
                events_to_add.append(status_event.model_dump(by_alias=True))
                update_fields["status"] = new_status.value
                
                # Add validation events if transitioning to validation states
                if new_status == ProgressStatus.VALIDATION_IN_PROGRESS:
                    validation_event = ProgressUpdateEvent(
                        event_type=UpdateEventType.VALIDATION_STARTED,
                        timestamp=current_time,
                        user_id=user_obj_id,
                        details={}
                    )
                    events_to_add.append(validation_event.model_dump(by_alias=True))
                elif new_status == ProgressStatus.VALIDATION_COMPLETED:
                    validation_event = ProgressUpdateEvent(
                        event_type=UpdateEventType.VALIDATION_COMPLETED,
                        timestamp=current_time,
                        user_id=user_obj_id,
                        details={}
                    )
                    events_to_add.append(validation_event.model_dump(by_alias=True))
                
                # Update paper status based on progress status changes
                paper_status_update = None
                if new_status == ProgressStatus.EMAIL_SENT:
                    paper_status_update = "Waiting for Author Response"
                elif new_status == ProgressStatus.OFFICIAL_CODE_POSTED:
                    paper_status_update = "Official Code Posted"
                elif new_status == ProgressStatus.CODE_NEEDS_REFACTORING:
                    paper_status_update = "Code Needs Refactoring"
                elif new_status == ProgressStatus.REFACTORING_STARTED:
                    paper_status_update = "Refactoring in Progress"
                elif new_status == ProgressStatus.REFACTORING_FINISHED:
                    paper_status_update = "Ready for Validation"
                elif new_status == ProgressStatus.VALIDATION_IN_PROGRESS:
                    paper_status_update = "Validation in Progress"
                elif new_status == ProgressStatus.VALIDATION_COMPLETED:
                    paper_status_update = "Validated"
                elif new_status == ProgressStatus.NO_CODE_FROM_AUTHOR:
                    paper_status_update = "Community Implementation Needed"
                elif new_status == ProgressStatus.GITHUB_CREATED:
                    paper_status_update = "Repository Created"
                elif new_status == ProgressStatus.CODE_NEEDED:
                    paper_status_update = "Work in Progress"
                elif new_status == ProgressStatus.REFUSED_TO_UPLOAD:
                    paper_status_update = "Community Implementation Needed"
                elif new_status == ProgressStatus.NO_RESPONSE:
                    paper_status_update = "Started"
                
                if paper_status_update:
                    await papers_collection.update_one(
                        {"_id": paper_obj_id},
                        {"$set": {"status": paper_status_update}}
                    )
                    # Update paper status in cache instead of clearing all
                    await paper_cache.update_paper_in_cache(paper_id, paper_status_update)
        
        # Handle GitHub repo changes
        if 'github_repo_id' in update_data:
            new_repo = update_data['github_repo_id']
            old_repo = progress.github_repo_id
            
            if new_repo != old_repo:
                event_type = UpdateEventType.GITHUB_REPO_UPDATED if old_repo else UpdateEventType.GITHUB_REPO_LINKED
                repo_event = ProgressUpdateEvent(
                    event_type=event_type,
                    timestamp=current_time,
                    user_id=user_obj_id,
                    details={
                        "githubRepoId": new_repo,
                        "previousRepoId": old_repo
                    }
                )
                events_to_add.append(repo_event.model_dump(by_alias=True))
                update_fields["githubRepoId"] = new_repo

        # Update the progress using the actual _id from the found document
        actual_id = progress_data["_id"]
        update_operations = {"$set": update_fields}
        if events_to_add:
            update_operations["$push"] = {"updates": {"$each": events_to_add}}
        
        await progress_collection.update_one(
            {"_id": actual_id},
            update_operations
        )

        # Re-fetch the updated progress to return
        updated_progress_data = await progress_collection.find_one({"_id": actual_id})
        if not updated_progress_data:
            raise NotFoundException(f"Failed to retrieve progress for paper {paper_id} after update.")
        return ImplementationProgress(**updated_progress_data)
