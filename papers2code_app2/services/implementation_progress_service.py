import logging
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId

from ..database import (
    get_implementation_progress_collection_async, 
    get_papers_collection_async,
    get_users_collection_async
)
from ..schemas.implementation_progress import (
    ImplementationProgress,
    Component, 
    ComponentUpdate, 
    ProgressStatus,
    # ComponentCategory, # Not directly used in this service, can be removed if not needed by ProgressStatus or ComponentStatus
    # ComponentStatus # Not directly used in this service, can be removed if not needed by ProgressStatus
)
from .exceptions import NotFoundException, UserNotContributorException, InvalidRequestException
# Import PaperActionService and action types
from .paper_action_service import PaperActionService, ACTION_PROJECT_STARTED, ACTION_PROJECT_JOINED

logger = logging.getLogger(__name__)

class ImplementationProgressService:
    def __init__(self): # Added init
        self.paper_action_service = PaperActionService() # Instantiate PaperActionService

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
        progress_data = await collection.find_one({"paperId": paper_obj_id})
        if progress_data:
            return ImplementationProgress(**progress_data) 
        return None

    async def join_or_create_progress(self, paper_id: str, user_id: str) -> ImplementationProgress: 
        papers_collection = await get_papers_collection_async()
        try:
            paper_obj_id = ObjectId(paper_id)
            user_obj_id = ObjectId(user_id)
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
        existing_progress_data = await progress_collection.find_one({"paperId": paper_obj_id})

        current_time = datetime.now(timezone.utc)

        if existing_progress_data:
            existing_progress = ImplementationProgress(**existing_progress_data) 
            if user_obj_id not in existing_progress.contributors:
                await progress_collection.update_one(
                    {"_id": existing_progress.id}, 
                    {"$addToSet": {"contributors": user_obj_id}, "$set": {"updated_at": current_time}}
                )
                # Log ACTION_PROJECT_JOINED
                try:
                    await self.paper_action_service.record_paper_related_action(
                        paper_id=paper_id,
                        user_id=user_id, # user_id is already a string here
                        action_type=ACTION_PROJECT_JOINED,
                        details={"progress_id": str(existing_progress.id)}
                    )
                except Exception as e_log:
                    logger.error(f"Failed to log ACTION_PROJECT_JOINED for user {user_id}, paper {paper_id}, progress {existing_progress.id}: {e_log}")
            # Re-fetch to get the potentially updated document
            updated_progress_data = await progress_collection.find_one({"_id": existing_progress.id})
            if not updated_progress_data:
                 raise NotFoundException(f"Failed to retrieve progress {existing_progress.id} after update attempt.")
            return ImplementationProgress(**updated_progress_data) 
        else:
            # Use the .new() classmethod from ImplementationProgress schema
            new_progress = ImplementationProgress.new(paper_id=paper_obj_id, user_id=user_obj_id) 
            
            progress_to_insert = new_progress.model_dump(by_alias=True) # by_alias=True to handle _id -> id
            
            try:
                result = await progress_collection.insert_one(progress_to_insert)
                created_progress_data = await progress_collection.find_one({"_id": result.inserted_id})
                if not created_progress_data:
                    raise NotFoundException("Failed to retrieve newly created progress.")
                
                # Log ACTION_PROJECT_STARTED
                try:
                    await self.paper_action_service.record_paper_related_action(
                        paper_id=paper_id,
                        user_id=user_id, # user_id is already a string here
                        action_type=ACTION_PROJECT_STARTED,
                        details={"progress_id": str(result.inserted_id)}
                    )
                except Exception as e_log:
                    logger.error(f"Failed to log ACTION_PROJECT_STARTED for user {user_id}, paper {paper_id}, progress {str(result.inserted_id)}: {e_log}")

                return ImplementationProgress(**created_progress_data) 
            except Exception as e:
                # Handle duplicate key error due to unique constraint on paperId
                if "duplicate key" in str(e).lower() or "11000" in str(e):
                    logger.info(f"Duplicate paperId detected for paper {paper_id}, fetching existing progress")
                    # Try to fetch the existing progress that was created concurrently
                    existing_progress_data = await progress_collection.find_one({"paperId": paper_obj_id})
                    if existing_progress_data:
                        existing_progress = ImplementationProgress(**existing_progress_data)
                        # Add user as contributor if not already there
                        if user_obj_id not in existing_progress.contributors:
                            await progress_collection.update_one(
                                {"_id": existing_progress.id}, 
                                {"$addToSet": {"contributors": user_obj_id}, "$set": {"updatedAt": current_time}}
                            )
                        # Return the updated progress
                        updated_progress_data = await progress_collection.find_one({"_id": existing_progress.id})
                        if updated_progress_data:
                            return ImplementationProgress(**updated_progress_data)
                raise e 

    async def add_component_to_progress(self, progress_id: str, user_id: str, component_data: Component, section_id: str) -> ImplementationProgress: 
        progress_collection = await get_implementation_progress_collection_async() 
        try:
            progress_obj_id = ObjectId(progress_id)
            user_obj_id = ObjectId(user_id)
            section_obj_id = ObjectId(section_id)
        except Exception:
            raise InvalidRequestException("Invalid progress, user, or section ID format.")
            
        progress_data = await progress_collection.find_one({"_id": progress_obj_id})
        if not progress_data:
            raise NotFoundException(f"Implementation progress with ID {progress_id} not found.")

        progress = ImplementationProgress(**progress_data) 
        if user_obj_id not in progress.contributors:
            raise UserNotContributorException("User is not a contributor to this progress.")

        target_section_exists = any(s.id == section_obj_id for s in progress.implementation_roadmap.sections)
        if not target_section_exists:
            raise NotFoundException(f"Section with ID {section_id} not found in progress {progress_id}.")

        new_component_dict = component_data.model_dump(by_alias=True)

        await progress_collection.update_one(
            {"_id": progress_obj_id, "implementation_roadmap.sections._id": section_obj_id},
            {
                "$push": {"implementation_roadmap.sections.$.components": new_component_dict},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        updated_progress_data = await self.get_progress_by_id(progress_id)
        if not updated_progress_data:
            raise NotFoundException(f"Failed to retrieve progress {progress_id} after adding component.")
        return updated_progress_data

    async def update_component_in_progress(self, progress_id: str, section_id: str, component_id: str, user_id: str, component_data: ComponentUpdate) -> ImplementationProgress: 
        progress_collection = await get_implementation_progress_collection_async() 
        try:
            progress_obj_id = ObjectId(progress_id)
            user_obj_id = ObjectId(user_id)
            section_obj_id = ObjectId(section_id)
            component_obj_id = ObjectId(component_id)
        except Exception:
            raise InvalidRequestException("Invalid progress, user, section, or component ID format.")
            
        # Check if the component exists within the specified section of the progress document
        # This also implicitly checks if the progress and section exist.
        progress_data = await progress_collection.find_one({
            "_id": progress_obj_id,
            "implementation_roadmap.sections._id": section_obj_id,
            "implementation_roadmap.sections.components._id": component_obj_id
        })
        if not progress_data:
            # More specific error message would be helpful here, but this is okay for now.
            raise NotFoundException(f"Component with ID {component_id} in section {section_id} of progress {progress_id} not found, or progress/section itself not found.")

        # Deserialize to validate user contributor status
        progress = ImplementationProgress(**progress_data) 
        if user_obj_id not in progress.contributors:
            raise UserNotContributorException("User is not a contributor to this progress.")

        update_fields = {}
        # exclude_unset=True is important to only update fields that are actually provided
        component_update_dict = component_data.model_dump(exclude_unset=True, by_alias=False) # Use by_alias=False if keys in ComponentUpdate match DB fields

        for key, value in component_update_dict.items():
            # Ensure we are using the correct field names as they are in the database schema
            # If ComponentUpdate uses aliases, ensure they are resolved here or use by_alias=True in model_dump and adjust keys
            update_fields[f"implementation_roadmap.sections.$[sec].components.$[comp].{key}"] = value
        
        if not update_fields:
            raise InvalidRequestException("No update data provided for the component.")

        # Add updated_at to the $set operation
        update_fields["updated_at"] = datetime.now(timezone.utc)

        array_filters = [
            {"sec._id": section_obj_id},
            {"comp._id": component_obj_id}
        ]

        result = await progress_collection.update_one(
            {"_id": progress_obj_id}, # Filter for the main document
            {"$set": update_fields},
            array_filters=array_filters
        )
        
        if result.matched_count == 0:
            # This could happen if the component was deleted between the find_one and update_one calls
            raise NotFoundException(f"Component or section not found during update for progress {progress_id}.")
        if result.modified_count == 0 and component_update_dict: # Check if actual data was sent for update
             # This means the data sent was the same as existing, or some other issue.
             # For simplicity, we'll re-fetch and return. If no actual change, client sees no change.
             pass


        updated_progress_data = await self.get_progress_by_id(progress_id)
        if not updated_progress_data:
            # This should ideally not happen if the update was successful and matched
            raise NotFoundException(f"Failed to retrieve progress {progress_id} after updating component.")
        return updated_progress_data

    async def remove_component_from_progress(self, progress_id: str, section_id: str, component_id: str, user_id: str) -> ImplementationProgress: 
        progress_collection = await get_implementation_progress_collection_async() 
        try:
            progress_obj_id = ObjectId(progress_id)
            user_obj_id = ObjectId(user_id)
            section_obj_id = ObjectId(section_id)
            component_obj_id = ObjectId(component_id)
        except Exception:
            raise InvalidRequestException("Invalid progress, user, section, or component ID format.")

        # First, fetch the progress to check for contributor status and existence of component
        progress_data = await progress_collection.find_one({"_id": progress_obj_id})
        if not progress_data:
            raise NotFoundException(f"Implementation progress with ID {progress_id} not found.")

        progress = ImplementationProgress(**progress_data) 
        if user_obj_id not in progress.contributors:
            raise UserNotContributorException("User is not a contributor to this progress.")

        # Verify the component exists in the specified section before attempting to pull
        component_exists_in_section = False
        for sec in progress.implementation_roadmap.sections:
            if sec.id == section_obj_id:
                if any(comp.id == component_obj_id for comp in sec.components):
                    component_exists_in_section = True
                    break
        
        if not component_exists_in_section:
            raise NotFoundException(f"Component with ID {component_id} not found in section {section_id}.")

        # Perform the update to pull the component
        result = await progress_collection.update_one(
            {"_id": progress_obj_id, "implementation_roadmap.sections._id": section_obj_id},
            {
                "$pull": {"implementation_roadmap.sections.$.components": {"_id": component_obj_id}},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )

        if result.matched_count == 0: # Should not happen if initial checks passed, but good for safety
            raise NotFoundException(f"Progress or section not found during component removal for progress {progress_id}.")
        # Not checking modified_count here as pulling a non-existent sub-document might not modify, but matched_count is key.

        updated_progress_data = await self.get_progress_by_id(progress_id)
        if not updated_progress_data:
            raise NotFoundException(f"Failed to retrieve progress {progress_id} after removing component.")
        return updated_progress_data

    async def update_progress_status(self, progress_id: str, user_id: str, new_status: ProgressStatus) -> ImplementationProgress: 
        progress_collection = await get_implementation_progress_collection_async() 
        try:
            progress_obj_id = ObjectId(progress_id)
            user_obj_id = ObjectId(user_id)
        except Exception:
            raise InvalidRequestException("Invalid progress or user ID format.")
            
        progress_data = await progress_collection.find_one({"_id": progress_obj_id})
        if not progress_data:
            raise NotFoundException(f"Implementation progress with ID {progress_id} not found.")
        
        progress = ImplementationProgress(**progress_data) 
        if user_obj_id not in progress.contributors:
            raise UserNotContributorException("User is not a contributor to this progress.")

        await progress_collection.update_one(
            {"_id": progress_obj_id},
            {"$set": {"status": new_status.value, "updated_at": datetime.now(timezone.utc)}}
        )
        updated_progress_data = await self.get_progress_by_id(progress_id)
        if not updated_progress_data:
            raise NotFoundException(f"Failed to retrieve progress {progress_id} after updating status.")
        return updated_progress_data
