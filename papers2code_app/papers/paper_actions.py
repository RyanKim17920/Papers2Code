from flask import jsonify, request, session
from . import papers_bp # Import the blueprint instance
from ..extensions import limiter, mongo, csrf
from ..models import transform_paper, get_papers_collection, get_user_actions_collection, get_users_collection
from ..utils import login_required
from ..config import Config

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
import traceback


@papers_bp.route('/<string:paper_id>/vote', methods=['POST'])
@limiter.limit("60 per minute")
@login_required
 # CSRF handled globally or per-blueprint if needed
def vote_on_paper(paper_id):
    try:
        user_id_str = session['user'].get('id')
        if not user_id_str:
            return jsonify({"error": "User ID not found in session"}), 401

        try:
            user_obj_id = ObjectId(user_id_str)
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            return jsonify({"error": "Invalid paper or user ID format"}), 400

        papers_collection = get_papers_collection()
        user_actions_collection = get_user_actions_collection()

        paper_exists = papers_collection.count_documents({"_id": paper_obj_id}) > 0
        if not paper_exists:
            return jsonify({"error": "Paper not found"}), 404

        data = request.get_json()
        vote_type = data.get('voteType')

        if vote_type not in ['up', 'none']:
            return jsonify({"error": "Invalid vote type. Must be 'up' or 'none'."}), 400

        action_type = 'upvote'
        existing_action = user_actions_collection.find_one({
            "userId": user_obj_id,
            "paperId": paper_obj_id,
            "actionType": action_type
        })

        updated_paper = None
        update_result = None

        if vote_type == 'up':
            if not existing_action:
                try:
                    # Insert action first
                    insert_result = user_actions_collection.insert_one({
                        "userId": user_obj_id,
                        "paperId": paper_obj_id,
                        "actionType": action_type,
                        "createdAt": datetime.now(timezone.utc)
                    })
                    if insert_result.inserted_id:
                        # Then increment paper count
                        updated_paper = papers_collection.find_one_and_update(
                            {"_id": paper_obj_id},
                            {"$inc": {"upvoteCount": 1}},
                            return_document=ReturnDocument.AFTER
                        )
                        print(f"User {user_id_str} upvoted paper {paper_id}")
                    else:
                        print(f"Error: Failed to insert upvote action for user {user_id_str}, paper {paper_id}")
                        updated_paper = papers_collection.find_one({"_id": paper_obj_id}) # Fetch current state
                except DuplicateKeyError:
                     print(f"Warning: Duplicate upvote action detected for user {user_id_str}, paper {paper_id} (concurrent request?).")
                     updated_paper = papers_collection.find_one({"_id": paper_obj_id}) # Fetch current state
            else:
                # Already voted, do nothing, return current paper state
                updated_paper = papers_collection.find_one({"_id": paper_obj_id})
                print(f"User {user_id_str} tried to upvote paper {paper_id} again.")

        elif vote_type == 'none':
            if existing_action:
                # Delete action first
                delete_result = user_actions_collection.delete_one({"_id": existing_action["_id"]})
                if delete_result.deleted_count == 1:
                    # Then decrement paper count
                    updated_paper = papers_collection.find_one_and_update(
                        {"_id": paper_obj_id},
                        {"$inc": {"upvoteCount": -1}},
                        return_document=ReturnDocument.AFTER
                    )
                    # Ensure count doesn't go below zero (optional safety)
                    if updated_paper and updated_paper.get("upvoteCount", 0) < 0:
                        papers_collection.update_one({"_id": paper_obj_id}, {"$set": {"upvoteCount": 0}})
                        updated_paper["upvoteCount"] = 0 # Update local copy too
                        print(f"Corrected negative upvote count for paper {paper_id}")
                    print(f"User {user_id_str} removed upvote from paper {paper_id}")
                else:
                    print(f"Error: Failed to delete upvote action for user {user_id_str}, paper {paper_id}")
                    updated_paper = papers_collection.find_one({"_id": paper_obj_id}) # Fetch current state
            else:
                # No vote to remove, do nothing, return current paper state
                updated_paper = papers_collection.find_one({"_id": paper_obj_id})
                print(f"User {user_id_str} tried to remove non-existent upvote from paper {paper_id}.")

        if updated_paper:
            return jsonify(transform_paper(updated_paper, user_id_str))
        else:
            # Fallback if paper update failed somehow
            current_paper = papers_collection.find_one({"_id": paper_obj_id})
            if current_paper:
                 return jsonify(transform_paper(current_paper, user_id_str))
            else:
                 return jsonify({"error": "Failed to update paper vote status and couldn't refetch paper."}), 500

    except Exception as e:
        print(f"Error voting on paper {paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during voting"}), 500


@papers_bp.route('/<string:paper_id>/actions', methods=['GET'])
@limiter.limit("100 per minute")
def get_paper_actions(paper_id):
    try:
        try:
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            return jsonify({"error": "Invalid paper ID format"}), 400

        papers_collection = get_papers_collection()
        if papers_collection.count_documents({"_id": paper_obj_id}) == 0:
            return jsonify({"error": "Paper not found"}), 404

        user_actions_collection = get_user_actions_collection()
        users_collection = get_users_collection()

        actions = list(user_actions_collection.find(
            {"paperId": paper_obj_id},
            {"_id": 0, "userId": 1, "actionType": 1} # Project only needed fields
        ))

        if not actions:
            return jsonify({"upvotes": [], "votedNotImplementable": [], "votedIsImplementable": []}), 200

        # Get unique user IDs involved
        user_ids = list(set(action['userId'] for action in actions if 'userId' in action))

        # Fetch user details in one go
        user_details_list = list(users_collection.find(
            {"_id": {"$in": user_ids}},
            {"_id": 1, "username": 1, "avatarUrl": 1}
        ))
        user_map = {str(user['_id']): {
                        "id": str(user['_id']), 
                        "username": user.get('username', 'Unknown'),
                        "avatarUrl": user.get('avatarUrl')
                    } for user in user_details_list}

        # Categorize actions
        result = {"upvotes": [], "votedIsImplementable": [], "votedNotImplementable": []} # Swapped keys for clarity
        print(actions)
        for action in actions:
            user_id_str = str(action.get('userId'))
            user_info = user_map.get(user_id_str)
            if not user_info:
                continue # Skip if user details couldn't be found

            action_type = action.get('actionType')
            if action_type == 'upvote':
                result["upvotes"].append(user_info)
            elif action_type == 'Community Implementable': # User voted "Is Implementable" (Thumbs Up)
                result["votedIsImplementable"].append(user_info)
            elif action_type == 'Community Not Implementable': # User voted "Not Implementable" (Thumbs Down)
                result["votedNotImplementable"].append(user_info)

        return jsonify(result), 200

    except Exception as e:
        print(f"Error getting actions for paper {paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred while fetching actions"}), 500
