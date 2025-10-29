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
from .cache import paper_cache

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

# Async helper function to get user-specific paper data (OPTIMIZED)
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

        # OPTIMIZATION: Single query instead of multiple count queries
        from .schemas.user_activity import LoggedActionTypes
        
        # Get all user actions for this paper in one query
        user_actions = await user_actions_collection.find(
            {"userId": user_obj_id, "paperId": paper_obj_id},
            {"actionType": 1, "timestamp": 1}
        ).sort([("timestamp", DESCENDING)]).to_list(length=None)
        
        # Process actions
        has_upvote = False
        latest_implementability_action = None
        
        implementability_action_types_map = {
            LoggedActionTypes.ADMIN_IMPLEMENTABLE.value: "up",
            LoggedActionTypes.COMMUNITY_IMPLEMENTABLE.value: "up",
            LoggedActionTypes.COMMUNITY_NOT_IMPLEMENTABLE.value: "down",
            LoggedActionTypes.ADMIN_NOT_IMPLEMENTABLE.value: "down",
        }
        
        for action in user_actions:
            action_type = action.get("actionType")
            
            # Check for upvote
            if action_type == LoggedActionTypes.UPVOTE.value:
                has_upvote = True
            
            # Check for implementability vote (get the latest one)
            if action_type in implementability_action_types_map and latest_implementability_action is None:
                latest_implementability_action = action_type
        
        if has_upvote:
            user_data["current_user_vote"] = "up"
            
        if latest_implementability_action:
            user_data["current_user_implementability_vote"] = implementability_action_types_map[latest_implementability_action]

    except InvalidId:
        logger.warning(f"Invalid ObjectId for current_user_id_str: {current_user_id_str} when fetching user-specific paper data. Skipping.")
        pass
    except Exception as e:
        logger.error(f"Error fetching user-specific data for paper {paper_obj_id} and user {current_user_id_str}: {e}", exc_info=True)
    return user_data

# Async helper function to get aggregate vote counts (OPTIMIZED)
async def _get_aggregate_vote_counts_async(paper_obj_id: ObjectId) -> Dict[str, int]:
    from .schemas.user_activity import LoggedActionTypes
    counts = {
        "not_implementable_votes": 0,
        "implementable_votes": 0,
    }
    user_actions_collection = await get_user_actions_collection_async()
    try:
        # OPTIMIZATION: Single aggregation query instead of multiple count queries
        pipeline = [
            {"$match": {"paperId": paper_obj_id}},
            {"$group": {
                "_id": "$actionType",
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = await user_actions_collection.aggregate(pipeline)
        results = [doc async for doc in cursor]
        
        not_implementable_action_types = {
            LoggedActionTypes.COMMUNITY_NOT_IMPLEMENTABLE.value,
            LoggedActionTypes.ADMIN_NOT_IMPLEMENTABLE.value
        }
        
        implementable_action_types = {
            LoggedActionTypes.COMMUNITY_IMPLEMENTABLE.value,
            LoggedActionTypes.ADMIN_IMPLEMENTABLE.value
        }
        
        for result in results:
            action_type = result["_id"]
            count = result["count"]
            
            if action_type in not_implementable_action_types:
                counts["not_implementable_votes"] += count
            elif action_type in implementable_action_types:
                counts["implementable_votes"] += count
                
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
        "publication_date": paper_doc.get("publicationDate"), 
        "upvote_count": paper_doc.get("upvoteCount", 0),       
        "status": paper_doc.get("status", "Not Started"),
        "url_github": _transform_url(paper_doc.get("urlGithub")),  # Include in base for all detail levels
        "url_abs": _transform_url(paper_doc.get("urlAbs")),  # Include in base for paper list icons
        "url_pdf": _transform_url(paper_doc.get("urlPdf")),  # Include in base for paper list icons
        "has_code": paper_doc.get("hasCode", False),  # Include in base for all detail levels
    }

    # Preserve implementationProgress if it exists in the input paper_doc
    # This key is added in paper_view_service.py before calling this transform function
    if "implementationProgress" in paper_doc and paper_doc["implementationProgress"] is not None:
        transformed_data["implementationProgress"] = paper_doc["implementationProgress"]

    # Add fields for summary level (used in dashboard and profile)
    if detail_level in ["summary", "full"]:
        raw_implementability_status = paper_doc.get("implementabilityStatus")
        current_implementability_status = IMPL_STATUS_VOTING
        if raw_implementability_status:
            if raw_implementability_status.lower() == "voting":
                current_implementability_status = IMPL_STATUS_VOTING
            elif raw_implementability_status in [
                IMPL_STATUS_COMMUNITY_IMPLEMENTABLE, 
                IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE, 
                IMPL_STATUS_ADMIN_IMPLEMENTABLE, 
                IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE
            ]:
                current_implementability_status = raw_implementability_status
        
        # Truncate abstract for summary level to reduce payload size
        abstract = paper_doc.get("abstract", "")
        if detail_level == "summary" and abstract:
            abstract = abstract[:300] if len(abstract) > 300 else abstract
        
        transformed_data.update({
            "abstract": abstract,
            "venue": paper_doc.get("venue"),  # Also known as "proceeding"
            "tags": paper_doc.get("tasks", []),  # DB field is "tasks", Pydantic field "tags" has alias "tasks"
            "implementability_status": current_implementability_status,
        })
    
    # Add additional fields only for full detail level
    if detail_level == "full":
        transformed_data.update({
            "pwc_url": _transform_url(paper_doc.get("pwcUrl")),
            "arxiv_id": paper_doc.get("arxivId"),
        })

    try:
        # Asynchronous calls to helper functions
        # For summary level, we skip user-specific data to improve performance
        if detail_level != "summary":
            user_specific_data = await _get_user_specific_paper_data_async(paper_obj_id, current_user_id_str)
            transformed_data.update(user_specific_data)

        if detail_level == "full":
            aggregate_votes = await _get_aggregate_vote_counts_async(paper_obj_id)
            transformed_data.update(aggregate_votes)
                
    except Exception as e:
        logger.error(f"Error during async data transformation for paper {paper_id}: {e}", exc_info=True)
        return None 
        
        
    return transformed_data

# --- Batch Transformation Function (OPTIMIZED) ---
async def transform_papers_batch(
    paper_docs: List[Dict[str, Any]],
    current_user_id_str: Optional[str] = None,
    detail_level: str = "full"
) -> List[Optional[Dict[str, Any]]]:
    """
    Transform multiple papers at once with batched user-specific data lookup.
    This is much more efficient than calling transform_paper_async for each paper individually.
    """
    if not paper_docs:
        return []
    
    # Extract all paper IDs upfront
    paper_obj_ids = []
    paper_id_to_doc = {}
    
    for paper_doc in paper_docs:
        paper_id = str(paper_doc["_id"]) if "_id" in paper_doc else None
        if not paper_id:
            continue
            
        paper_obj_id_val = paper_doc.get("_id")
        if not isinstance(paper_obj_id_val, ObjectId):
            try:
                paper_obj_id = ObjectId(paper_obj_id_val)
            except InvalidId:
                logger.error(f"Invalid ObjectId format for paper_doc._id: {paper_obj_id_val}")
                continue
        else:
            paper_obj_id = paper_obj_id_val
        
        paper_obj_ids.append(paper_obj_id)
        paper_id_to_doc[str(paper_obj_id)] = paper_doc
    
    # OPTIMIZATION: Batch fetch user-specific data for all papers at once
    user_data_map = {}
    if current_user_id_str and detail_level != "summary":
        try:
            user_obj_id = ObjectId(current_user_id_str)
            user_actions_collection = await get_user_actions_collection_async()
            
            from .schemas.user_activity import LoggedActionTypes
            
            # Single query to get all user actions for all papers
            user_actions = await user_actions_collection.find(
                {
                    "userId": user_obj_id,
                    "paperId": {"$in": paper_obj_ids}
                },
                {"paperId": 1, "actionType": 1, "timestamp": 1}
            ).sort([("timestamp", DESCENDING)]).to_list(length=None)
            
            # Group actions by paper
            paper_actions = {}
            for action in user_actions:
                paper_id_str = str(action["paperId"])
                if paper_id_str not in paper_actions:
                    paper_actions[paper_id_str] = []
                paper_actions[paper_id_str].append(action)
            
            # Process actions for each paper
            implementability_action_types_map = {
                LoggedActionTypes.ADMIN_IMPLEMENTABLE.value: "up",
                LoggedActionTypes.COMMUNITY_IMPLEMENTABLE.value: "up",
                LoggedActionTypes.COMMUNITY_NOT_IMPLEMENTABLE.value: "down",
                LoggedActionTypes.ADMIN_NOT_IMPLEMENTABLE.value: "down",
            }
            
            for paper_id_str, actions in paper_actions.items():
                has_upvote = False
                latest_implementability_action = None
                
                for action in actions:
                    action_type = action.get("actionType")
                    
                    if action_type == LoggedActionTypes.UPVOTE.value:
                        has_upvote = True
                    
                    if action_type in implementability_action_types_map and latest_implementability_action is None:
                        latest_implementability_action = action_type
                
                user_data_map[paper_id_str] = {
                    "current_user_vote": "up" if has_upvote else None,
                    "current_user_implementability_vote": implementability_action_types_map.get(latest_implementability_action) if latest_implementability_action else None
                }
                
        except (InvalidId, Exception) as e:
            logger.error(f"Error batch fetching user-specific data: {e}", exc_info=True)
    
    # OPTIMIZATION: Batch fetch aggregate vote counts for all papers (if needed for detail level)
    vote_counts_map = {}
    if detail_level == "full":
        try:
            from .schemas.user_activity import LoggedActionTypes
            user_actions_collection = await get_user_actions_collection_async()
            
            pipeline = [
                {"$match": {"paperId": {"$in": paper_obj_ids}}},
                {"$group": {
                    "_id": {
                        "paperId": "$paperId",
                        "actionType": "$actionType"
                    },
                    "count": {"$sum": 1}
                }}
            ]
            
            cursor = await user_actions_collection.aggregate(pipeline)
            results = [doc async for doc in cursor]
            
            not_implementable_action_types = {
                LoggedActionTypes.COMMUNITY_NOT_IMPLEMENTABLE.value,
                LoggedActionTypes.ADMIN_NOT_IMPLEMENTABLE.value
            }
            
            implementable_action_types = {
                LoggedActionTypes.COMMUNITY_IMPLEMENTABLE.value,
                LoggedActionTypes.ADMIN_IMPLEMENTABLE.value
            }
            
            for result in results:
                paper_id_str = str(result["_id"]["paperId"])
                action_type = result["_id"]["actionType"]
                count = result["count"]
                
                if paper_id_str not in vote_counts_map:
                    vote_counts_map[paper_id_str] = {
                        "not_implementable_votes": 0,
                        "implementable_votes": 0,
                    }
                
                if action_type in not_implementable_action_types:
                    vote_counts_map[paper_id_str]["not_implementable_votes"] += count
                elif action_type in implementable_action_types:
                    vote_counts_map[paper_id_str]["implementable_votes"] += count
                    
        except Exception as e:
            logger.error(f"Error batch fetching aggregate vote counts: {e}", exc_info=True)
    
    # Transform all papers
    transformed_papers = []
    for paper_obj_id in paper_obj_ids:
        paper_id_str = str(paper_obj_id)
        paper_doc = paper_id_to_doc.get(paper_id_str)
        if not paper_doc:
            continue
        
        # Base transformation (synchronous part)
        transformed_data = {
            "id": paper_id_str,
            "title": paper_doc.get("title"),
            "authors": _transform_authors(paper_doc.get("authors", [])),
            "publication_date": paper_doc.get("publicationDate"),
            "upvote_count": paper_doc.get("upvoteCount", 0),
            "status": paper_doc.get("status", "Not Started"),
            "url_github": _transform_url(paper_doc.get("urlGithub")),
            "url_abs": _transform_url(paper_doc.get("urlAbs")),
            "url_pdf": _transform_url(paper_doc.get("urlPdf")),
            "has_code": paper_doc.get("hasCode", False),
        }
        
        # Preserve implementationProgress if it exists
        if "implementationProgress" in paper_doc and paper_doc["implementationProgress"] is not None:
            transformed_data["implementationProgress"] = paper_doc["implementationProgress"]
        
        # Add fields for summary level
        if detail_level in ["summary", "full"]:
            raw_implementability_status = paper_doc.get("implementabilityStatus")
            current_implementability_status = IMPL_STATUS_VOTING
            if raw_implementability_status:
                if raw_implementability_status.lower() == "voting":
                    current_implementability_status = IMPL_STATUS_VOTING
                elif raw_implementability_status in [
                    IMPL_STATUS_COMMUNITY_IMPLEMENTABLE,
                    IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE,
                    IMPL_STATUS_ADMIN_IMPLEMENTABLE,
                    IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE
                ]:
                    current_implementability_status = raw_implementability_status
            
            abstract = paper_doc.get("abstract", "")
            if detail_level == "summary" and abstract:
                abstract = abstract[:300] if len(abstract) > 300 else abstract
            
            transformed_data.update({
                "abstract": abstract,
                "venue": paper_doc.get("venue"),
                "tags": paper_doc.get("tasks", []),
                "implementability_status": current_implementability_status,
            })
        
        # Add additional fields only for full detail level
        if detail_level == "full":
            transformed_data.update({
                "pwc_url": _transform_url(paper_doc.get("pwcUrl")),
                "arxiv_id": paper_doc.get("arxivId"),
            })
        
        # Add user-specific data from batch lookup
        if detail_level != "summary":
            user_data = user_data_map.get(paper_id_str, {
                "current_user_vote": None,
                "current_user_implementability_vote": None,
            })
            transformed_data.update(user_data)
        
        # Add aggregate votes from batch lookup
        if detail_level == "full":
            vote_counts = vote_counts_map.get(paper_id_str, {
                "not_implementable_votes": 0,
                "implementable_votes": 0,
            })
            transformed_data.update(vote_counts)
        
        transformed_papers.append(transformed_data)
    
    return transformed_papers
