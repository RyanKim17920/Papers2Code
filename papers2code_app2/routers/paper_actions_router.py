from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..schemas_papers import PaperResponse, PaperActionsSummaryResponse, PaperActionUserDetail
from ..schemas_minimal import UserSchema, UserMinimal
from ..shared import (
    get_papers_collection_sync,
    get_user_actions_collection_sync,
    get_users_collection_sync,
    transform_paper_sync
)
from ..auth import get_current_user

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
    try:
        user_id_str = str(current_user.id)
        if not user_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")

        try:
            user_obj_id = ObjectId(user_id_str)
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper or user ID format")

        papers_collection = get_papers_collection_sync()
        user_actions_collection = get_user_actions_collection_sync()

        paper = papers_collection.find_one({"_id": paper_obj_id})
        if not paper:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")

        action_type = 'upvote'
        existing_action = user_actions_collection.find_one({
            "userId": user_obj_id,
            "paperId": paper_obj_id,
            "actionType": action_type
        })
        updated_paper_doc = None
        if vote_type == 'up':
            if not existing_action:
                try:
                    insert_result = user_actions_collection.insert_one({
                        "userId": user_obj_id,
                        "paperId": paper_obj_id,
                        "actionType": action_type,
                        "createdAt": datetime.now(timezone.utc)
                    })
                    if insert_result.inserted_id:
                        updated_paper_doc = papers_collection.find_one_and_update(
                            {"_id": paper_obj_id},
                            {"$inc": {"upvoteCount": 1}},
                            return_document=ReturnDocument.AFTER
                        )
                    else:
                        updated_paper_doc = paper
                except DuplicateKeyError:
                    logger.warning(f"Duplicate key error on upvoting paper {paper_id} by user {user_id_str}. Action likely exists.")
                    updated_paper_doc = paper
            else:
                updated_paper_doc = paper

        elif vote_type == 'none':
            if existing_action:
                delete_result = user_actions_collection.delete_one({"_id": existing_action["_id"]})
                if delete_result.deleted_count == 1:
                    updated_paper_doc = papers_collection.find_one_and_update(
                        {"_id": paper_obj_id},
                        {"$inc": {"upvoteCount": -1}},
                        return_document=ReturnDocument.AFTER
                    )
                    if updated_paper_doc and updated_paper_doc.get("upvoteCount", 0) < 0:
                        papers_collection.update_one({"_id": paper_obj_id}, {"$set": {"upvoteCount": 0}})
                        if updated_paper_doc:
                            updated_paper_doc["upvoteCount"] = 0
                else:
                    updated_paper_doc = paper
            else:
                updated_paper_doc = paper

        if not updated_paper_doc:
            updated_paper_doc = papers_collection.find_one({"_id": paper_obj_id})
            if not updated_paper_doc:
                logger.error(f"Paper {paper_id} not found after voting operation.")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found after voting operation")

        return transform_paper_sync(updated_paper_doc, user_id_str, detail_level="full")

    except HTTPException:
        raise
    except Exception:
        logger.exception("An internal server error occurred during voting.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred during voting."
        )

@router.get("/{paper_id}/actions", response_model=PaperActionsSummaryResponse)
@limiter.limit("100/minute")
async def get_paper_actions(
    request: Request,  # For limiter
    paper_id: str
):
    try:
        try:
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid paper ID format")

        papers_collection = get_papers_collection_sync()
        if papers_collection.count_documents({"_id": paper_obj_id}) == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")

        user_actions_collection = get_user_actions_collection_sync()
        users_collection = get_users_collection_sync()

        actions_cursor = user_actions_collection.find(
            {"paperId": paper_obj_id}
        )

        actions = list(actions_cursor)

        if not actions:
            return PaperActionsSummaryResponse(paper_id=paper_id, upvotes=[], saves=[], implementability_flags=[])

        user_ids = list(set(action['userId'] for action in actions if 'userId' in action))

        user_details_list = list(users_collection.find(
            {"_id": {"$in": user_ids}},
            {"_id": 1, "username": 1, "avatarUrl": 1, "githubUsername": 1}
        ))

        user_map = {str(user['_id']): UserMinimal(
            id=str(user['_id']),
            username=user.get('username', 'Unknown'),
            avatar_url=user.get('avatarUrl'),
        ) for user in user_details_list}

        upvotes_details = []
        saves_details = []
        implementability_flags_details = []

        for action in actions:
            user_id_obj = action.get('userId')
            if not user_id_obj:
                continue
            user_info = user_map.get(str(user_id_obj))
            if not user_info:
                continue

            action_type = action.get('actionType')
            created_at = action.get('createdAt', datetime.now(timezone.utc))

            action_detail = PaperActionUserDetail(
                user_id=str(user_info.id),
                username=user_info.username,
                avatar_url=user_info.avatar_url,
                action_type=action_type,
                created_at=created_at
            )

            if action_type == 'upvote':
                upvotes_details.append(action_detail)
            elif action_type == 'dispute_non_implementable':
                implementability_flags_details.append(action_detail)
            elif action_type == 'confirm_non_implementable':
                implementability_flags_details.append(action_detail)

        return PaperActionsSummaryResponse(
            paper_id=paper_id,
            upvotes=upvotes_details,
            saves=saves_details,
            implementability_flags=implementability_flags_details
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("An internal server error occurred while fetching paper actions.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while fetching paper actions."
        )

