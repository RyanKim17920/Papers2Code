\
# papers2code_app2/services/implementation_progress_service.py
import logging
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from ..database import (
    get_implementation_progresss_collection_async,
    get_papers_collection_async,
    get_users_collection_async
)
from ..schemas_implementation_progresss import (
    Progress as ProgressSchema, # MODIFIED
    Component as ComponentSchema,
    ComponentUpdate as ComponentUpdateSchema, # MODIFIED
    ProgressStatus, # MODIFIED
    ComponentCategory, # MODIFIED
    ComponentStatus # MODIFIED
)
from .exceptions import NotFoundException, AlreadyExistsException, UserNotContributorException, InvalidRequestException

logger = logging.getLogger(__name__)

class ImplementationProgressService:
    async def get_progress_by_id(self, progress_id: str) -> Optional[ProgressSchema]: # MODIFIED
        collection = await get_implementation_progresss_collection_async()
        try:
            progress_obj_id = ObjectId(progress_id)
        except Exception:
            logger.warning(f"Invalid ObjectId format for progress_id: {progress_id}")
            return None
        progress_data = await collection.find_one({"_id": progress_obj_id})
        if progress_data:
            return ProgressSchema(**progress_data) # MODIFIED
        return None

    async def get_progress_by_paper_id(self, paper_id: str) -> Optional[ProgressSchema]: # MODIFIED
        collection = await get_implementation_progresss_collection_async()
        try:
            paper_obj_id = ObjectId(paper_id)
        except Exception:
            logger.warning(f"Invalid paper_id format: {paper_id}")
            return None
        progress_data = await collection.find_one({"paper_id": paper_obj_id})
        if progress_data:
            return ProgressSchema(**progress_data) # MODIFIED
        return None

    async def join_or_create_progress(self, paper_id: str, user_id: str) -> ProgressSchema: # MODIFIED
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

        progresss_collection = await get_implementation_progresss_collection_async()
        existing_progress_data = await progresss_collection.find_one({"paper_id": paper_obj_id})

        current_time = datetime.now(timezone.utc)

        if existing_progress_data:
            existing_progress = ProgressSchema(**existing_progress_data) # MODIFIED
            if user_obj_id not in existing_progress.contributors:
                await progresss_collection.update_one(
                    {"_id": existing_progress.id}, # Use .id from _MongoModel
                    {"$addToSet": {"contributors": user_obj_id}, "$set": {"updated_at": current_time}}
                )
            updated_progress_data = await progresss_collection.find_one({"_id": existing_progress.id}) # Use .id
            if not updated_progress_data:
                 raise NotFoundException(f"Failed to retrieve progress {existing_progress.id} after update attempt.") # Use .id
            return ProgressSchema(**updated_progress_data) # MODIFIED
        else:
            new_progress = ProgressSchema.new(paper_id=paper_obj_id, user_id=user_obj_id) # MODIFIED
            progress_to_insert = new_progress.model_dump(by_alias=True)
            
            result = await progresss_collection.insert_one(progress_to_insert)
            created_progress_data = await progresss_collection.find_one({"_id": result.inserted_id})
            if not created_progress_data:
                raise NotFoundException("Failed to retrieve newly created progress.")
            return ProgressSchema(**created_progress_data) # MODIFIED

    async def add_component_to_progress(self, progress_id: str, user_id: str, component_data: ComponentSchema, section_id: str) -> ProgressSchema: # MODIFIED component_data type
        progresss_collection = await get_implementation_progresss_collection_async()
        try:
            progress_obj_id = ObjectId(progress_id)
            user_obj_id = ObjectId(user_id)
            section_obj_id = ObjectId(section_id)
        except Exception:
            raise InvalidRequestException("Invalid progress, user, or section ID format.")
            
        progress_data = await progresss_collection.find_one({"_id": progress_obj_id})
        if not progress_data:
            raise NotFoundException(f"Implementation progress with ID {progress_id} not found.")

        progress = ProgressSchema(**progress_data) # MODIFIED
        if user_obj_id not in progress.contributors:
            raise UserNotContributorException("User is not a contributor to this progress.")

        target_section_exists = any(s.id == section_obj_id for s in progress.implementation_roadmap.sections) # Use .id
        if not target_section_exists:
            raise NotFoundException(f"Section with ID {section_id} not found in progress {progress_id}.")

        # component_data is already a ComponentSchema instance, ensure it has an id or it's generated
        # If component_data is passed from router, it might not have 'id' if it's a create operation.
        # The Component schema itself has default_factory for _id, so it will be generated.
        new_component_dict = component_data.model_dump(by_alias=True)


        await progresss_collection.update_one(
            {"_id": progress_obj_id, "implementation_roadmap.sections._id": section_obj_id},
            {
                "$push": {"implementation_roadmap.sections.$.components": new_component_dict},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        updated_progress_data = await self.get_progress_by_id(progress_id)
        if not updated_progress_data: # This should ideally not happen if the update was successful
            raise NotFoundException(f"Failed to retrieve progress {progress_id} after adding component.")
        return updated_progress_data

    async def update_component_in_progress(self, progress_id: str, section_id: str, component_id: str, user_id: str, component_data: ComponentUpdateSchema) -> ProgressSchema: # MODIFIED component_data type and return type
        progresss_collection = await get_implementation_progresss_collection_async()
        try:
            progress_obj_id = ObjectId(progress_id)
            user_obj_id = ObjectId(user_id)
            section_obj_id = ObjectId(section_id)
            component_obj_id = ObjectId(component_id)
        except Exception:
            raise InvalidRequestException("Invalid progress, user, section, or component ID format.")
            
        progress_data = await progresss_collection.find_one({
            "_id": progress_obj_id,
            "implementation_roadmap.sections._id": section_obj_id,
            "implementation_roadmap.sections.components._id": component_obj_id
        })
        if not progress_data:
            raise NotFoundException(f"Component with ID {component_id} in section {section_id} of progress {progress_id} not found.")

        progress = ProgressSchema(**progress_data) # MODIFIED
        if user_obj_id not in progress.contributors:
            raise UserNotContributorException("User is not a contributor to this progress.")

        update_fields = {}
        component_update_dict = component_data.model_dump(exclude_unset=True) 

        for key, value in component_update_dict.items():
            update_fields[f"implementation_roadmap.sections.$[sec].components.$[comp].{key}"] = value
        
        if not update_fields:
            raise InvalidRequestException("No update data provided for the component.")

        array_filters = [
            {"sec._id": section_obj_id},
            {"comp._id": component_obj_id}
        ]

        await progresss_collection.update_one(
            {"_id": progress_obj_id},
            {"$set": {**update_fields, "updated_at": datetime.now(timezone.utc)}},
            array_filters=array_filters
        )
        
        updated_progress_data = await self.get_progress_by_id(progress_id)
        if not updated_progress_data:
            raise NotFoundException(f"Failed to retrieve progress {progress_id} after updating component.")
        return updated_progress_data

    async def remove_component_from_progress(self, progress_id: str, section_id: str, component_id: str, user_id: str) -> ProgressSchema: # MODIFIED return type
        progresss_collection = await get_implementation_progresss_collection_async()
        try:
            progress_obj_id = ObjectId(progress_id)
            user_obj_id = ObjectId(user_id)
            section_obj_id = ObjectId(section_id)
            component_obj_id = ObjectId(component_id)
        except Exception:
            raise InvalidRequestException("Invalid progress, user, section, or component ID format.")

        progress_data = await progresss_collection.find_one({"_id": progress_obj_id})
        if not progress_data:
            raise NotFoundException(f"Implementation progress with ID {progress_id} not found.")

        progress = ProgressSchema(**progress_data) # MODIFIED
        if user_obj_id not in progress.contributors:
            raise UserNotContributorException("User is not a contributor to this progress.")

        component_exists_in_section = False
        for sec in progress.implementation_roadmap.sections:
            if sec.id == section_obj_id: # Use .id
                if any(comp.id == component_obj_id for comp in sec.components): # Use .id
                    component_exists_in_section = True
                    break
        
        if not component_exists_in_section:
            raise NotFoundException(f"Component with ID {component_id} not found in section {section_id}.")

        await progresss_collection.update_one(
            {"_id": progress_obj_id, "implementation_roadmap.sections._id": section_obj_id},
            {
                "$pull": {"implementation_roadmap.sections.$.components": {"_id": component_obj_id}},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        updated_progress_data = await self.get_progress_by_id(progress_id)
        if not updated_progress_data:
            raise NotFoundException(f"Failed to retrieve progress {progress_id} after removing component.")
        return updated_progress_data

    async def update_progress_status(self, progress_id: str, user_id: str, new_status: ProgressStatus) -> ProgressSchema: # MODIFIED new_status type and return type
        progresss_collection = await get_implementation_progresss_collection_async()
        try:
            progress_obj_id = ObjectId(progress_id)
            user_obj_id = ObjectId(user_id)
        except Exception:
            raise InvalidRequestException("Invalid progress or user ID format.")
            
        progress_data = await progresss_collection.find_one({"_id": progress_obj_id})
        if not progress_data:
            raise NotFoundException(f"Implementation progress with ID {progress_id} not found.")
        
        progress = ProgressSchema(**progress_data) # MODIFIED
        if user_obj_id not in progress.contributors:
            raise UserNotContributorException("User is not a contributor to this progress.")

        await progresss_collection.update_one(
            {"_id": progress_obj_id},
            {"$set": {"status": new_status.value, "updated_at": datetime.now(timezone.utc)}}
        )
        updated_progress_data = await self.get_progress_by_id(progress_id)
        if not updated_progress_data:
            raise NotFoundException(f"Failed to retrieve progress {progress_id} after updating status.")
        return updated_progress_data
