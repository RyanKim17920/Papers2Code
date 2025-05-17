from fastapi import APIRouter, Depends, HTTPException, status, Request, Query # Added Query
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson.errors import InvalidId
from datetime import datetime
from typing import List, Optional # Restored List, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address 

from ..schemas import (
    PaperResponse, User, VoteRequest, UserActionInfo, PyObjectId
)
from ..shared import (
    get_papers_collection_sync,
    get_user_actions_collection_sync,
    get_users_collection_sync, 
    transform_paper_sync
)
from ..auth import get_current_user_placeholder

router = APIRouter(
    prefix="/papers",
    tags=["paper-actions"],
)

limiter = Limiter(key_func=get_remote_address)

# Original Flask: @limiter.limit("100 per minute")
@router.post("/{paper_id}/vote", response_model=PaperResponse)
@limiter.limit("100/minute")
async def vote_on_paper(
    request: Request, # For rate limiting
    paper_id: str,
    vote_request: VoteRequest,
    current_user: User = Depends(get_current_user_placeholder)
):
    user_id_str = current_user.id
    try:
        user_obj_id = PyObjectId(user_id_str)
        paper_obj_id = PyObjectId(paper_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper or user ID format")

    papers_collection = get_papers_collection_sync()
    user_actions_collection = get_user_actions_collection_sync()

    action_type = "upvote" if vote_request.vote_type == "upvote" else "downvote"
    vote_change = 1 if action_type == "upvote" else -1

    # Check if paper exists
    paper = await papers_collection.find_one({"_id": paper_obj_id})
    if not paper:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")

    # Check for existing vote by this user on this paper
    existing_action = await user_actions_collection.find_one({
        "userId": user_obj_id,
        "paperId": paper_obj_id,
        "actionType": {"$in": ["upvote", "downvote"]}
    })

    paper_update_ops = {"$inc": {}}
    user_action_op = None # 'insert', 'update', 'delete'
    new_action_document = None
    action_to_delete_id = None

    if existing_action:
        if existing_action["actionType"] == action_type: # User is retracting their vote
            paper_update_ops["$inc"]["vote_score"] = -vote_change
            user_action_op = 'delete'
            action_to_delete_id = existing_action["_id"]
        else: # User is changing their vote (e.g., from downvote to upvote)
            paper_update_ops["$inc"]["vote_score"] = 2 * vote_change # Nullify previous, apply new
            user_action_op = 'update'
            # Update existing action to the new type
            # new_action_document will be used for $set in update_one for user_actions
            new_action_document = {"actionType": action_type, "createdAt": datetime.utcnow()}
    else: # New vote
        paper_update_ops["$inc"]["vote_score"] = vote_change
        user_action_op = 'insert'
        new_action_document = {
            "userId": user_obj_id,
            "paperId": paper_obj_id,
            "actionType": action_type,
            "createdAt": datetime.utcnow()
        }
    
    # Perform user action operation
    action_successful = False
    try:
        if user_action_op == 'insert':
            result = await user_actions_collection.insert_one(new_action_document)
            action_successful = result.inserted_id is not None
        elif user_action_op == 'update':
            result = await user_actions_collection.update_one(
                {"_id": existing_action["_id"]},
                {"$set": new_action_document}
            )
            action_successful = result.modified_count == 1
        elif user_action_op == 'delete':
            result = await user_actions_collection.delete_one({"_id": action_to_delete_id})
            action_successful = result.deleted_count == 1
        else: # Should not happen
            action_successful = True # No action needed
    except DuplicateKeyError: # Safeguard, should be caught by find_one logic
        print(f"DuplicateKeyError for user {user_id_str} paper {paper_id} action {action_type}. Concurrent action likely.")
        action_successful = False
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Concurrent vote detected. Please try again.")

    if not action_successful:
        current_paper_state = await papers_collection.find_one({"_id": paper_obj_id})
        if not current_paper_state: # Should not happen if paper existed initially
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process vote and refetch paper.")
        return transform_paper_sync(current_paper_state, user_id_str)

    # Update paper's vote_score
    updated_paper_doc = await papers_collection.find_one_and_update(
        {"_id": paper_obj_id},
        paper_update_ops,
        return_document=ReturnDocument.AFTER
    )

    if not updated_paper_doc:
        check_paper_exists = await papers_collection.find_one({"_id": paper_obj_id})
        if not check_paper_exists:
            if user_action_op == 'insert' and result.inserted_id:
                await user_actions_collection.delete_one({"_id": result.inserted_id})
            elif user_action_op == 'update' and existing_action:
                pass
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found during vote update, possibly deleted.")
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update paper vote score after successful action logging.")

    return transform_paper_sync(updated_paper_doc, user_id_str)

# Original Flask: @limiter.limit("60 per minute")
@router.get("/{paper_id}/actions", response_model=List[UserActionInfo])
@limiter.limit("60/minute")
async def get_paper_actions(
    request: Request, # For rate limiting
    paper_id: str,
    action_type: Optional[str] = Query(None, description="Filter by action type (e.g., 'upvote', 'downvote', 'confirm_non_implementable')"),
    limit: int = Query(10, ge=1, le=100),
    page: int = Query(1, ge=1)
):
    try:
        paper_obj_id = PyObjectId(paper_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper ID format")

    user_actions_collection = get_user_actions_collection_sync()
    users_collection = get_users_collection_sync()

    query = {"paperId": paper_obj_id}
    if action_type:
        query["actionType"] = action_type

    skip = (page - 1) * limit
    actions_cursor = user_actions_collection.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    actions = await actions_cursor.to_list(length=limit)

    user_action_infos = []
    for action in actions:
        user_id = action.get("userId")
        user_info = None
        if user_id:
            try:
                user_obj_id_for_lookup = PyObjectId(str(user_id))
                user_data = await users_collection.find_one({"_id": user_obj_id_for_lookup}, {"username": 1, "avatarUrl": 1, "_id": 1})
                if user_data:
                    user_info = User(
                        id=str(user_data["_id"]),
                        username=user_data.get("username", "Unknown User"),
                        avatarUrl=user_data.get("avatarUrl")
                    )
                else:
                     user_info = User(id=str(user_id), username="User not found", avatarUrl=None)
            except (InvalidId, ValueError):
                user_info = User(id=str(user_id), username="Invalid user ID format", avatarUrl=None)
        else:
            user_info = User(id="anonymous", username="Anonymous", avatarUrl=None)

        user_action_infos.append(UserActionInfo(
            user=user_info,
            actionType=action.get("actionType"),
            createdAt=action.get("createdAt")
        ))
    
    return user_action_infos

