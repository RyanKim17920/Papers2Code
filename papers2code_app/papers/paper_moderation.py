from flask import jsonify, request, session, current_app
from . import papers_bp # Import the blueprint instance
from ..extensions import limiter
from ..models import transform_paper, get_papers_collection, get_removed_papers_collection, get_user_actions_collection
from ..utils import login_required, owner_required
from ..config import Config

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
import traceback

@papers_bp.route('/<string:paper_id>/flag_implementability', methods=['POST'])
@limiter.limit("30 per minute")
@login_required

def flag_paper_implementability(paper_id):
    try:
        user_id_str = session['user'].get('id')
        if not user_id_str:
            return jsonify({"error": "User ID not found in session"}), 401

        try:
            user_obj_id = ObjectId(user_id_str)
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            return jsonify({"error": "Invalid paper or user ID format"}), 400

        data = request.get_json()
        action = data.get('action') # 'confirm', 'dispute', 'retract'

        if action not in ['confirm', 'dispute', 'retract']:
            return jsonify({"error": "Invalid action type."}), 400

        papers_collection = get_papers_collection()
        user_actions_collection = get_user_actions_collection()
        paper = papers_collection.find_one({"_id": paper_obj_id})
        if not paper:
            return jsonify({"error": "Paper not found"}), 404

        # Prevent voting if owner already confirmed non-implementable
        if paper.get("nonImplementableStatus") == Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB and paper.get("nonImplementableConfirmedBy") == "owner":
             return jsonify({"error": "Implementability status already confirmed by owner."}), 400

        # Find current user's existing implementability vote action
        current_action_doc = user_actions_collection.find_one({
            "userId": user_obj_id,
            "paperId": paper_obj_id,
            "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
        })
        current_action_type = current_action_doc.get("actionType") if current_action_doc else None

        update = {"$set": {}}
        increment = {}
        new_status = paper.get("nonImplementableStatus", Config.STATUS_IMPLEMENTABLE)
        needs_status_check = False
        action_to_perform = None # 'insert', 'update', 'delete'
        new_action_type = None

        if action == 'retract':
            if not current_action_doc:
                return jsonify({"error": "No existing vote to retract."}), 400

            action_to_perform = 'delete'
            # Current logic for retracting based on stored actionType is correct.
            # nonImplementableVotes corresponds to 'confirm_non_implementable' (now "Not Implementable" vote)
            # disputeImplementableVotes corresponds to 'dispute_non_implementable' (now "Is Implementable" vote)
            if current_action_type == 'confirm_non_implementable': # User retracts "Not Implementable" vote
                increment["nonImplementableVotes"] = -1
            elif current_action_type == 'dispute_non_implementable': # User retracts "Is Implementable" vote
                increment["disputeImplementableVotes"] = -1
            needs_status_check = True
            print(f"User {user_id_str} retracting {current_action_type} vote for paper {paper_id}")

        elif action == 'confirm': # User clicks Thumbs Up, meaning "Is Implementable"
            new_action_type = 'dispute_non_implementable' # Store as this type for "Is Implementable"
            if current_action_type == new_action_type:
                return jsonify({"error": "You have already voted this paper as 'Is Implementable'."}), 400

            if current_action_doc: # Switching vote from "Not Implementable" to "Is Implementable"
                action_to_perform = 'update'
                increment["disputeImplementableVotes"] = 1 # Add to "Is Implementable" votes
                increment["nonImplementableVotes"] = -1   # Remove from "Not Implementable" votes
                print(f"User {user_id_str} switching vote to 'Is Implementable' (Thumbs Up) for paper {paper_id}")
            else: # New "Is Implementable" vote
                action_to_perform = 'insert'
                increment["disputeImplementableVotes"] = 1
                print(f"User {user_id_str} voting 'Is Implementable' (Thumbs Up) for paper {paper_id}")
            
            # Voting "Is Implementable" contributes to potentially reverting a "flagged" status.
            # It does not by itself flag the paper.
            needs_status_check = True

        elif action == 'dispute': # User clicks Thumbs Down, meaning "Not Implementable"
            new_action_type = 'confirm_non_implementable' # Store as this type for "Not Implementable"
            if current_action_type == new_action_type:
                return jsonify({"error": "You have already voted this paper as 'Not Implementable'."}), 400

            if current_action_doc: # Switching vote from "Is Implementable" to "Not Implementable"
                action_to_perform = 'update'
                increment["nonImplementableVotes"] = 1     # Add to "Not Implementable" votes
                increment["disputeImplementableVotes"] = -1 # Remove from "Is Implementable" votes
                print(f"User {user_id_str} switching vote to 'Not Implementable' (Thumbs Down) for paper {paper_id}")
            else: # New "Not Implementable" vote
                 action_to_perform = 'insert'
                 increment["nonImplementableVotes"] = 1
                 print(f"User {user_id_str} voting 'Not Implementable' (Thumbs Down) for paper {paper_id}")

            # If paper is currently implementable, the first "Not Implementable" vote flags it.
            if paper.get("nonImplementableStatus", Config.STATUS_IMPLEMENTABLE) == Config.STATUS_IMPLEMENTABLE:
                update["$set"]["nonImplementableStatus"] = Config.STATUS_FLAGGED_NON_IMPLEMENTABLE
                if not paper.get("nonImplementableFlaggedBy"): # Record first flagger
                     update["$set"]["nonImplementableFlaggedBy"] = user_obj_id
                new_status = Config.STATUS_FLAGGED_NON_IMPLEMENTABLE
                print(f"Paper {paper_id} status changed to flagged_non_implementable due to 'Not Implementable' vote")
            needs_status_check = True

        # --- Perform Action on user_actions collection ---
        action_update_successful = False
        if action_to_perform == 'delete':
            delete_result = user_actions_collection.delete_one({"_id": current_action_doc["_id"]})
            action_update_successful = delete_result.deleted_count == 1
        elif action_to_perform == 'update':
            update_result = user_actions_collection.update_one(
                {"_id": current_action_doc["_id"]},
                {"$set": {"actionType": new_action_type, "createdAt": datetime.now(timezone.utc)}}
            )
            action_update_successful = update_result.modified_count == 1
        elif action_to_perform == 'insert':
            try:
                insert_result = user_actions_collection.insert_one({
                    "userId": user_obj_id, "paperId": paper_obj_id,
                    "actionType": new_action_type, "createdAt": datetime.now(timezone.utc)
                })
                action_update_successful = insert_result.inserted_id is not None
            except DuplicateKeyError:
                 print(f"Warning: Duplicate action insert detected for {new_action_type}, user {user_id_str}, paper {paper_id}.")
                 action_update_successful = True # Allow paper update to proceed

        if not action_update_successful and action_to_perform:
             print(f"Error: Failed to perform '{action_to_perform}' on user_actions for paper {paper_id}, user {user_id_str}")
             current_paper = papers_collection.find_one({"_id": paper_obj_id})
             return jsonify(transform_paper(current_paper, user_id_str)) if current_paper else jsonify({"error": "Failed to update action and refetch paper."}), 500

        # --- Apply increments and status updates to paper ---
        if increment:
            update["$inc"] = increment
        if not update.get("$set"): # Avoid empty $set if only $inc is present
             update.pop("$set", None)

        if update:
            updated_paper_doc = papers_collection.find_one_and_update(
                {"_id": paper_obj_id}, update, return_document=ReturnDocument.AFTER
            )
            if not updated_paper_doc:
                 print(f"Error: Failed to apply update to paper {paper_id} after action.")
                 current_paper = papers_collection.find_one({"_id": paper_obj_id})
                 return jsonify(transform_paper(current_paper, user_id_str)) if current_paper else jsonify({"error": "Failed to update paper after action and refetch."}), 500
            paper = updated_paper_doc # Use the updated doc for threshold check
            new_status = paper.get("nonImplementableStatus")
        else:
             # If no paper update needed yet (e.g., retracting only vote), refetch paper
             paper = papers_collection.find_one({"_id": paper_obj_id})
             if not paper:
                 return jsonify({"error": "Failed to refetch paper after action."}), 500
             new_status = paper.get("nonImplementableStatus")


        # --- Check Thresholds ---
        final_status_update = {}
        # Get current vote counts from the paper document, which includes the latest increments
        votes_not_implementable = paper.get("nonImplementableVotes", 0)
        votes_is_implementable = paper.get("disputeImplementableVotes", 0)

        # Only proceed with threshold checks if the status is currently flagged or still implementable (to catch first flag)
        if needs_status_check and paper.get("nonImplementableConfirmedBy") != "owner": # Don't override owner's direct confirmation with community vote
            if new_status == Config.STATUS_FLAGGED_NON_IMPLEMENTABLE or new_status == Config.STATUS_IMPLEMENTABLE:
                non_impl_threshold = current_app.config.get('NON_IMPLEMENTABLE_CONFIRM_THRESHOLD', 3)
                impl_threshold = current_app.config.get('IMPLEMENTABLE_CONFIRM_THRESHOLD', 3) # Get new threshold
                print(f"Checking thresholds for paper {paper_id}: Votes Not Implementable={votes_not_implementable}, Votes Is Implementable={votes_is_implementable}, NonImplThreshold={non_impl_threshold}, ImplThreshold={impl_threshold}")

                # Condition to confirm non-implementability by community
                if votes_not_implementable >= votes_is_implementable + non_impl_threshold:
                    final_status_update["$set"] = {
                        "is_implementable": False,
                        "nonImplementableStatus": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB,
                        "status": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE,
                        "nonImplementableConfirmedBy": "community"
                    }
                    print(f"Paper {paper_id} confirmed non-implementable by community vote threshold.")
                # Condition to confirm implementability by community
                elif votes_is_implementable >= votes_not_implementable + impl_threshold:
                    final_status_update["$set"] = {
                        "is_implementable": True,
                        "nonImplementableStatus": Config.STATUS_CONFIRMED_IMPLEMENTABLE_DB, # New DB status
                        "status": Config.STATUS_CONFIRMED_IMPLEMENTABLE, # New display status
                        "nonImplementableConfirmedBy": "community"
                    }
                    final_status_update.setdefault("$unset", {}).update({
                        "nonImplementableVotes": "", 
                        "disputeImplementableVotes": "",
                        "nonImplementableFlaggedBy": ""
                    })
                    # Delete related voting actions as status is now community confirmed implementable
                    user_actions_collection.delete_many({
                        "paperId": paper_obj_id,
                        "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
                    })
                    print(f"Paper {paper_id} confirmed implementable by community vote threshold. Votes reset.")
                # Condition to revert back to implementable from flagged_non_implementable
                elif new_status == Config.STATUS_FLAGGED_NON_IMPLEMENTABLE and votes_is_implementable >= votes_not_implementable:
                    final_status_update["$set"] = {
                        "is_implementable": True,
                        "nonImplementableStatus": Config.STATUS_IMPLEMENTABLE,
                        "status": Config.STATUS_NOT_STARTED
                    }
                    final_status_update.setdefault("$unset", {}).update({
                        "nonImplementableVotes": "", "disputeImplementableVotes": "",
                        "nonImplementableFlaggedBy": "", "nonImplementableConfirmedBy": ""
                    })
                    user_actions_collection.delete_many({
                        "paperId": paper_obj_id,
                        "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
                    })
                    print(f"Paper {paper_id} reverted to implementable from flagged status by vote. Votes reset.")
        
        # Apply final status update if threshold met
        if final_status_update:
            if not final_status_update.get("$set"):
                final_status_update.pop("$set", None)
            if not final_status_update.get("$unset"):
                final_status_update.pop("$unset", None)
            if final_status_update: # Check if still needed
                updated_paper = papers_collection.find_one_and_update(
                    {"_id": paper_obj_id}, final_status_update, return_document=ReturnDocument.AFTER
                )
            else: 
                updated_paper = paper 
        else:
            updated_paper = paper
        
        if updated_paper:
            return jsonify(transform_paper(updated_paper, user_id_str))
        else:
            final_paper_doc = papers_collection.find_one({"_id": paper_obj_id})
            return jsonify(transform_paper(final_paper_doc, user_id_str)) if final_paper_doc else jsonify({"error": "Failed to retrieve final paper status."}), 500

    except Exception as e:
        print(f"Error flagging/voting implementability for paper {paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during implementability voting"}), 500


@papers_bp.route('/<string:paper_id>/set_implementability', methods=['POST'])
@limiter.limit("30 per minute")
@login_required
@owner_required

def set_paper_implementability(paper_id):
    try:
        user_id_str = session['user'].get('id') # For logging/audit if needed
        try:
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            return jsonify({"error": "Invalid paper ID format"}), 400

        data = request.get_json()
        status_to_set = data.get('statusToSet') # e.g., 'confirmed_implementable', 'confirmed_non_implementable', 'voting'

        valid_statuses = [
            Config.STATUS_CONFIRMED_IMPLEMENTABLE_DB, 
            Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB, 
            'voting' # Special keyword to reset to community voting
        ]
        if status_to_set not in valid_statuses:
            return jsonify({"error": f"Invalid value for statusToSet. Must be one of: {valid_statuses}"}), 400

        papers_collection = get_papers_collection()
        user_actions_collection = get_user_actions_collection()
        update = { "$set": {}, "$unset": {} }

        if status_to_set == Config.STATUS_CONFIRMED_IMPLEMENTABLE_DB:
            update["$set"] = {
                "is_implementable": True,
                "nonImplementableStatus": Config.STATUS_CONFIRMED_IMPLEMENTABLE_DB,
                "status": Config.STATUS_CONFIRMED_IMPLEMENTABLE, # Display status
                "nonImplementableConfirmedBy": "owner"
            }
            update["$unset"] = {
                "nonImplementableVotes": "", "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": ""
            }
            print(f"Owner setting paper {paper_id} to CONFIRMED_IMPLEMENTABLE.")
        elif status_to_set == Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB:
            update["$set"] = {
                "is_implementable": False,
                "nonImplementableStatus": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB,
                "status": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE, # Display status
                "nonImplementableConfirmedBy": "owner"
            }
            update["$unset"] = {
                "nonImplementableVotes": "", "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": ""
            }
            print(f"Owner setting paper {paper_id} to CONFIRMED_NON-IMPLEMENTABLE.")
        elif status_to_set == 'voting': # Owner resets to allow community voting
            update["$set"] = {
                "is_implementable": True, 
                "nonImplementableStatus": Config.STATUS_IMPLEMENTABLE, 
                "status": Config.STATUS_NOT_STARTED 
            }
            update["$unset"] = {
                "nonImplementableVotes": "", "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": "", "nonImplementableConfirmedBy": ""
            }
            print(f"Owner resetting paper {paper_id} to community voting.")

        # Delete relevant community voting actions if owner is confirming a status or resetting
        delete_result = user_actions_collection.delete_many({
            "paperId": paper_obj_id,
            "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
        })
        print(f"Owner action for paper {paper_id}: Deleted {delete_result.deleted_count} community voting actions.")

        if not update.get("$set"):
            del update["$set"]
        if not update.get("$unset"):
            del update["$unset"]

        updated_paper = papers_collection.find_one_and_update(
            {"_id": paper_obj_id}, update, return_document=ReturnDocument.AFTER
        )

        if updated_paper:
            print(f"Owner set implementability for paper {paper_id} to {status_to_set}")
            return jsonify(transform_paper(updated_paper, session.get('user', {}).get('id')))
        else:
            if papers_collection.count_documents({"_id": paper_obj_id}) == 0:
                 return jsonify({"error": "Paper not found"}), 404
            else:
                 print(f"Error: Failed to update paper {paper_id} after owner action for status {status_to_set}.")
                 return jsonify({"error": "Failed to update paper implementability status by owner"}), 500

    except Exception as e:
        print(f"Error setting implementability for paper {paper_id} by owner: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during owner action"}), 500


@papers_bp.route('/<string:paper_id>', methods=['DELETE'])
@limiter.limit("30 per minute")
@login_required
@owner_required

def remove_paper(paper_id):
    try:
        try:
            obj_id = ObjectId(paper_id)
        except InvalidId:
            return jsonify({"error": "Invalid paper ID format"}), 400

        papers_collection = get_papers_collection()
        removed_papers_collection = get_removed_papers_collection()
        user_actions_collection = get_user_actions_collection()

        paper_to_remove = papers_collection.find_one({"_id": obj_id})
        if not paper_to_remove:
            return jsonify({"error": "Paper not found"}), 404

        # --- Move to removed collection ---
        removed_doc = paper_to_remove.copy()
        removed_doc["original_id"] = removed_doc.pop("_id")
        removed_doc["removedAt"] = datetime.now(timezone.utc)
        removed_doc["removedBy"] = {"userId": session['user'].get('id'), "username": session['user'].get('username')}
        if "pwc_url" in removed_doc:
            removed_doc["original_pwc_url"] = removed_doc["pwc_url"] # Keep original PWC URL if exists

        insert_result = removed_papers_collection.insert_one(removed_doc)
        print(f"Paper {paper_id} moved to removed_papers collection with new ID {insert_result.inserted_id}")

        # --- Clean up related data ---
        action_delete_result = user_actions_collection.delete_many({"paperId": obj_id})
        print(f"Removed {action_delete_result.deleted_count} actions from user_actions for deleted paper {paper_id}")

        # --- Delete from main collection ---
        delete_result = papers_collection.delete_one({"_id": obj_id})
        if delete_result.deleted_count == 1:
            print(f"Paper {paper_id} successfully deleted from main collection.")
            return jsonify({"message": "Paper removed successfully"}), 200
        else:
            print(f"Warning: Paper {paper_id} deletion failed (count={delete_result.deleted_count}) after moving to removed_papers.")
            # Consider if manual cleanup is needed or if this state is acceptable
            return jsonify({"error": "Paper removed but encountered issue during final deletion"}), 207 # Multi-Status

    except Exception as e:
        print(f"Error removing paper {paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during paper removal"}), 500
