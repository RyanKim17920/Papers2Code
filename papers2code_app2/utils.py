\
import logging
from typing import Optional, Any, Dict, List
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING

# Assuming database.py is in the same directory
from .database import get_user_actions_collection_sync 
# Assuming shared.py is in the same directory and contains IMPL_STATUS_VOTING
from .shared import (
    IMPL_STATUS_VOTING,
    IMPL_STATUS_COMMUNITY_IMPLEMENTABLE,
    IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_IMPLEMENTABLE,
    IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE
)

logger = logging.getLogger(__name__)

# --- Helper functions for transform_paper_sync ---
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

# Helper function to get user-specific paper data
def _get_user_specific_paper_data(user_actions_collection: Any, paper_obj_id: ObjectId, current_user_id_str: Optional[str]) -> Dict[str, Any]:
    user_data = {
        "current_user_vote": None,
        "current_user_implementability_vote": None,
    }
    if not current_user_id_str:
        return user_data

    try:
        user_obj_id = ObjectId(current_user_id_str)

        # Fetch current_user_vote (upvote status)
        if user_actions_collection.count_documents({"userId": user_obj_id, "paperId": paper_obj_id, "actionType": "upvote"}) > 0:
            user_data["current_user_vote"] = "up"

        # Fetch user-specific implementability vote
        implementability_action_types_map = {
            "Implementable": "up",
            "Community Implementable": "up",
            "Community Not Implementable": "down",
            "Not Implementable": "down",
        }
        user_implementability_action = user_actions_collection.find_one(
            {"userId": user_obj_id, "paperId": paper_obj_id, "actionType": {"$in": list(implementability_action_types_map.keys())}},
            sort=[("timestamp", DESCENDING)]
        )
        if user_implementability_action:
            action_type = user_implementability_action.get("actionType")
            user_data["current_user_implementability_vote"] = implementability_action_types_map.get(action_type)

    except InvalidId:
        logger.warning(f"Invalid ObjectId for current_user_id_str: {current_user_id_str} when fetching user-specific paper data. Skipping.")
    except Exception as e:
        logger.error(f"Error fetching user-specific data for paper {paper_obj_id} and user {current_user_id_str}: {e}", exc_info=True)
    return user_data

# Helper function to get aggregate vote counts
def _get_aggregate_vote_counts(user_actions_collection: Any, paper_obj_id: ObjectId) -> Dict[str, int]:
    counts = {
        "not_implementable_votes": 0,
        "implementable_votes": 0,
    }
    try:
        # Ensure these action types exactly match what's stored or used in voting logic
        not_implementable_action_types = ["Community Not Implementable", "Not Implementable"] # Corrected potential typo and simplified
        counts["not_implementable_votes"] = user_actions_collection.count_documents(
            {"paperId": paper_obj_id, "actionType": {"$in": not_implementable_action_types}}
        )

        implementable_action_types = ["Implementable", "Community Implementable"] # More comprehensive
        counts["implementable_votes"] = user_actions_collection.count_documents(
            {"paperId": paper_obj_id, "actionType": {"$in": implementable_action_types}}
        )
    except Exception as e:
        logger.error(f"Error fetching aggregate vote counts for paper {paper_obj_id}: {e}", exc_info=True)
    return counts

# --- Main Transformation Function ---
def transform_paper_sync(
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

    transformed_data = {
        "id": paper_id,
        "title": paper_doc.get("title"),
        "authors": _transform_authors(paper_doc.get("authors", [])),
        "publication_date": paper_doc.get("publicationDate"),
        "upvote_count": paper_doc.get("upvoteCount", 0),
        "status": paper_doc.get("status", "Not Started"),
    }

    if detail_level == "full":
        # Ensure correct mapping for implementability_status if it exists
        raw_implementability_status = paper_doc.get("implementability_status")
        current_implementability_status = IMPL_STATUS_VOTING # Default to "Voting"
        if raw_implementability_status:
            if raw_implementability_status.lower() == "voting": # Check for lowercase "voting"
                current_implementability_status = IMPL_STATUS_VOTING # Map to correct "Voting"
            elif raw_implementability_status in [
                IMPL_STATUS_COMMUNITY_IMPLEMENTABLE, 
                IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, 
                IMPL_STATUS_ADMIN_IMPLEMENTABLE, 
                IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE
            ]:
                current_implementability_status = raw_implementability_status
            # else: logger.warning(f"Unknown implementability_status '{raw_implementability_status}' for paper {paper_id}, defaulting to Voting.")

        transformed_data.update({
            "pwc_url": _transform_url(paper_doc.get("pwcUrl")),
            "arxiv_id": paper_doc.get("arxivId"),
            "abstract": paper_doc.get("abstract"),
            "url_abs": _transform_url(paper_doc.get("urlAbs")),
            "url_pdf": _transform_url(paper_doc.get("urlPdf")),
            "venue": paper_doc.get("venue"),
            "tags": paper_doc.get("tasks", []), 
            "implementability_status": current_implementability_status, # Use the mapped/defaulted status
        })

    try:
        user_actions_collection = get_user_actions_collection_sync() # Fetches the live collection

        user_specific_data = _get_user_specific_paper_data(user_actions_collection, paper_obj_id, current_user_id_str)
        transformed_data.update(user_specific_data)

        if detail_level == "full":
            aggregate_votes = _get_aggregate_vote_counts(user_actions_collection, paper_obj_id)
            transformed_data.update(aggregate_votes)
                
    except Exception as e:
        logger.error(f"Error during data transformation for paper {paper_id}: {e}", exc_info=True)
        return None 
        
    return transformed_data
