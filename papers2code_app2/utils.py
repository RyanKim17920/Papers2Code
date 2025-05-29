\
import logging
from typing import Optional, Any, Dict, List
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING

# Assuming database.py is in the same directory
from .database import get_user_actions_collection_async # Changed from sync
# Assuming shared.py is in the same directory and contains IMPL_STATUS_VOTING
from .shared import (
    IMPL_STATUS_VOTING,
    IMPL_STATUS_COMMUNITY_IMPLEMENTABLE,
    IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE
)

logger = logging.getLogger(__name__)

# --- Helper functions for transform_paper_async (previously _sync) ---
# Helper function to transform author data
def _transform_authors(authors_data: Any) -> List[str]:
    if authors_data and isinstance(authors_data, list):
        if all(isinstance(author, dict) for author in authors_data):
            return [author.get("name") for author in authors_data if author.get("name")]
        elif all(isinstance(author, str) for author in authors_data):
            return authors_data
    return []

# Helper function to transform URL strings
def _transform_url(url_value: Any) -> Optional[str]:
    if url_value and isinstance(url_value, str) and url_value.strip():
        return str(url_value)
    return None

# Async helper function to get user-specific paper data
async def _get_user_specific_paper_data_async(paper_obj_id: ObjectId, current_user_id_str: Optional[str]) -> Dict[str, Any]:
    user_data = {
        "current_user_vote": None,
        "current_user_implementability_vote": None,
    }
    if not current_user_id_str:
        return user_data

    user_actions_collection = await get_user_actions_collection_async()

    try:
        user_obj_id = ObjectId(current_user_id_str)

        # Fetch current_user_vote (upvote status)
        if await user_actions_collection.count_documents({"userId": user_obj_id, "paperId": paper_obj_id, "actionType": "upvote"}) > 0:
            user_data["current_user_vote"] = "up"

        # Fetch user-specific implementability vote
        implementability_action_types_map = {
            "Implementable": "up",
            "Community Implementable": "up",
            "Community Not Implementable": "down",
            "Not Implementable": "down",
        }
        user_implementability_action = await user_actions_collection.find_one(
            {"userId": user_obj_id, "paperId": paper_obj_id, "actionType": {"$in": list(implementability_action_types_map.keys())}},
            sort=[("timestamp", DESCENDING)] # type: ignore
        )
        if user_implementability_action:
            action_type = user_implementability_action.get("actionType")
            user_data["current_user_implementability_vote"] = implementability_action_types_map.get(action_type)

    except InvalidId:
        logger.warning(f"Invalid ObjectId for current_user_id_str: {current_user_id_str} when fetching user-specific paper data. Skipping.")
    except Exception as e:
        logger.error(f"Error fetching user-specific data for paper {paper_obj_id} and user {current_user_id_str}: {e}", exc_info=True)
    return user_data

# Async helper function to get aggregate vote counts
async def _get_aggregate_vote_counts_async(paper_obj_id: ObjectId) -> Dict[str, int]:
    counts = {
        "not_implementable_votes": 0,
        "implementable_votes": 0,
    }
    user_actions_collection = await get_user_actions_collection_async()
    try:
        not_implementable_action_types = ["Community Not Implementable", "Not Implementable"]
        counts["not_implementable_votes"] = await user_actions_collection.count_documents(
            {"paperId": paper_obj_id, "actionType": {"$in": not_implementable_action_types}}
        )

        implementable_action_types = ["Implementable", "Community Implementable"]
        counts["implementable_votes"] = await user_actions_collection.count_documents(
            {"paperId": paper_obj_id, "actionType": {"$in": implementable_action_types}}
        )
    except Exception as e:
        logger.error(f"Error fetching aggregate vote counts for paper {paper_obj_id}: {e}", exc_info=True)
    return counts

# --- Main Asynchronous Transformation Function ---
async def transform_paper_async(
    paper_doc: Dict[str, Any],
    current_user_id_str: Optional[str] = None,
    detail_level: str = "full"
) -> Optional[Dict[str, Any]]:
    if not paper_doc:
        return None

    paper_id = str(paper_doc["_id"]) if "_id" in paper_doc else None
    if not paper_id:
        logger.warning("Paper document missing _id field.")
        return None
    
    paper_obj_id_val = paper_doc.get("_id")
    if not isinstance(paper_obj_id_val, ObjectId):
        try:
            paper_obj_id = ObjectId(paper_obj_id_val)
        except InvalidId:
            logger.error(f"Invalid ObjectId format for paper_doc._id: {paper_obj_id_val}")
            return None
    else:
        paper_obj_id = paper_obj_id_val

    # Synchronous parts of transformation remain the same
    transformed_data = {
        "id": paper_id,
        "title": paper_doc.get("title"),
        "authors": _transform_authors(paper_doc.get("authors", [])),
        "publicationDate": paper_doc.get("publication_date"), # MODIFIED: Was "publicationDate"
        "upvoteCount": paper_doc.get("upvote_count", 0),       # MODIFIED: Was "upvoteCount"
        "status": paper_doc.get("status", "Not Started"),
    }

    if detail_level == "full":
        raw_implementability_status = paper_doc.get("implementability_status") # Assuming DB field is "implementability_status"
        current_implementability_status = IMPL_STATUS_VOTING
        if raw_implementability_status:
            if raw_implementability_status.lower() == "voting": # Ensure case-insensitive check for "voting"
                current_implementability_status = IMPL_STATUS_VOTING
            elif raw_implementability_status in [
                IMPL_STATUS_COMMUNITY_IMPLEMENTABLE, 
                IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, 
                IMPL_STATUS_ADMIN_IMPLEMENTABLE, 
                IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE
            ]:
                current_implementability_status = raw_implementability_status
            # else: keep default IMPL_STATUS_VOTING if value is unrecognized

        transformed_data.update({
            "pwcUrl": _transform_url(paper_doc.get("pwc_url")),          # MODIFIED: Was "pwcUrl"
            "arxivId": paper_doc.get("arxiv_id"),                        # MODIFIED: Was "arxivId"
            "abstract": paper_doc.get("abstract"),
            "urlAbs": _transform_url(paper_doc.get("url_abs")),            # MODIFIED: Was "urlAbs"
            "urlPdf": _transform_url(paper_doc.get("url_pdf")),            # MODIFIED: Was "urlPdf"
            "venue": paper_doc.get("venue"), # Assumes DB field is "venue"
            "tags": paper_doc.get("tasks", []), # Assumes DB field is "tasks", Pydantic field "tags" has alias "tasks"
            "implementability_status": current_implementability_status,
        })

    try:
        # Asynchronous calls to helper functions
        user_specific_data = await _get_user_specific_paper_data_async(paper_obj_id, current_user_id_str)
        transformed_data.update(user_specific_data)

        if detail_level == "full":
            aggregate_votes = await _get_aggregate_vote_counts_async(paper_obj_id)
            transformed_data.update(aggregate_votes)
                
    except Exception as e:
        logger.error(f"Error during async data transformation for paper {paper_id}: {e}", exc_info=True)
        return None 
        
    return transformed_data

# Keep the synchronous version if it's still used elsewhere, or remove if fully replaced.
# For now, let's assume it might be needed by other parts not yet converted.
# If not, it can be deleted.
# def transform_paper_sync(...): remains here if needed
