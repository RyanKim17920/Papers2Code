from flask import jsonify, request, session, current_app
from . import papers_bp # Import the blueprint instance
from ..extensions import limiter, mongo, csrf
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
        if not user_id_str: return jsonify({"error": "User ID not found in session"}), 401

        try:
            user_obj_id = ObjectId(user_id_str)
            paper_obj_id = ObjectId(paper_id)
        except InvalidId: return jsonify({"error": "Invalid paper or user ID format"}), 400

        data = request.get_json()
        action = data.get('action') # 'confirm', 'dispute', 'retract'

        if action not in ['confirm', 'dispute', 'retract']:
            return jsonify({"error": "Invalid action type."}), 400

        papers_collection = get_papers_collection()
        user_actions_collection = get_user_actions_collection()
        paper = papers_collection.find_one({"_id": paper_obj_id})
        if not paper: return jsonify({"error": "Paper not found"}), 404

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
            if current_action_type == 'confirm_non_implementable':
                increment["nonImplementableVotes"] = -1
            elif current_action_type == 'dispute_non_implementable':
                increment["disputeImplementableVotes"] = -1
            needs_status_check = True
            print(f"User {user_id_str} retracting {current_action_type} vote for paper {paper_id}")

        elif action == 'confirm': # Thumbs Up (Confirm Non-Implementable)
            new_action_type = 'confirm_non_implementable'
            if current_action_type == new_action_type:
                return jsonify({"error": "You have already voted thumbs up (confirm non-implementability)."}), 400

            if current_action_doc: # Switching vote from dispute to confirm
                action_to_perform = 'update'
                increment["nonImplementableVotes"] = 1
                increment["disputeImplementableVotes"] = -1
                print(f"User {user_id_str} switching vote to confirm (up) for paper {paper_id}")
            else: # New confirm vote
                action_to_perform = 'insert'
                increment["nonImplementableVotes"] = 1
                print(f"User {user_id_str} voting confirm (up) for paper {paper_id}")

            # If paper is currently implementable, flag it
            if paper.get("nonImplementableStatus", Config.STATUS_IMPLEMENTABLE) == Config.STATUS_IMPLEMENTABLE:
                update["$set"]["nonImplementableStatus"] = Config.STATUS_FLAGGED_NON_IMPLEMENTABLE
                if not paper.get("nonImplementableFlaggedBy"): # Record first flagger
                     update["$set"]["nonImplementableFlaggedBy"] = user_obj_id
                new_status = Config.STATUS_FLAGGED_NON_IMPLEMENTABLE
                print(f"Paper {paper_id} status changed to flagged_non_implementable")
            needs_status_check = True

        elif action == 'dispute': # Thumbs Down (Dispute Non-Implementability)
            new_action_type = 'dispute_non_implementable'
            if current_action_type == new_action_type:
                return jsonify({"error": "You have already voted thumbs down (dispute non-implementability)."}), 400

            # Can only dispute if it's currently flagged
            if paper.get("nonImplementableStatus") != Config.STATUS_FLAGGED_NON_IMPLEMENTABLE:
                 return jsonify({"error": "Paper is not currently flagged as non-implementable."}), 400

            if current_action_doc: # Switching vote from confirm to dispute
                action_to_perform = 'update'
                increment["nonImplementableVotes"] = -1
                increment["disputeImplementableVotes"] = 1
                print(f"User {user_id_str} switching vote to dispute (down) for paper {paper_id}")
            else: # New dispute vote
                 action_to_perform = 'insert'
                 increment["disputeImplementableVotes"] = 1
                 print(f"User {user_id_str} voting dispute (down) for paper {paper_id}")
            needs_status_check = True

        # --- Perform Action on user_actions collection ---
        action_update_successful = False
        if action_to_perform == 'delete':
            delete_result = user_actions_collection.delete_one({"_id": current_action_doc["_id"]})
            action_update_successful = delete_result.deleted_count == 1
        elif action_to_perform == 'update':
            update_result = user_actions_collection.update_one(
                {"_id": current_action_doc["_id"]},
                {"$set": {"actionType": new_action_type, "createdAt": datetime.utcnow()}}
            )
            action_update_successful = update_result.modified_count == 1
        elif action_to_perform == 'insert':
            try:
                insert_result = user_actions_collection.insert_one({
                    "userId": user_obj_id, "paperId": paper_obj_id,
                    "actionType": new_action_type, "createdAt": datetime.utcnow()
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
             if not paper: return jsonify({"error": "Failed to refetch paper after action."}), 500
             new_status = paper.get("nonImplementableStatus")


        # --- Check Thresholds ---
        final_status_update = {}
        if needs_status_check and new_status == Config.STATUS_FLAGGED_NON_IMPLEMENTABLE:
            confirm_votes = paper.get("nonImplementableVotes", 0)
            dispute_votes = paper.get("disputeImplementableVotes", 0)
            threshold = current_app.config.get('NON_IMPLEMENTABLE_CONFIRM_THRESHOLD', 3)
            print(f"Checking thresholds for paper {paper_id}: Confirm(Up)={confirm_votes}, Dispute(Down)={dispute_votes}, Threshold={threshold}")

            # Condition to confirm non-implementability by community
            if confirm_votes >= dispute_votes + threshold:
                final_status_update["$set"] = {
                    "is_implementable": False,
                    "nonImplementableStatus": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB,
                    "status": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE, # Display status
                    "nonImplementableConfirmedBy": "community"
                }
                print(f"Paper {paper_id} confirmed non-implementable by community vote threshold.")

            # Condition to revert back to implementable
            elif dispute_votes >= confirm_votes:
                 final_status_update["$set"] = {
                     "is_implementable": True,
                     "nonImplementableStatus": Config.STATUS_IMPLEMENTABLE,
                     "status": Config.STATUS_NOT_STARTED # Reset display status
                 }
                 final_status_update["$unset"] = {
                     "nonImplementableVotes": "", "disputeImplementableVotes": "",
                     "nonImplementableFlaggedBy": "", "nonImplementableConfirmedBy": ""
                 }
                 # Delete related actions
                 delete_result = user_actions_collection.delete_many({
                     "paperId": paper_obj_id,
                     "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
                 })
                 print(f"Paper {paper_id} reverted to implementable by vote threshold. Deleted {delete_result.deleted_count} status actions.")

        # Apply final status update if threshold met
        if final_status_update:
             if not final_status_update.get("$set"): final_status_update.pop("$set", None)
             if not final_status_update.get("$unset"): final_status_update.pop("$unset", None)
             if final_status_update: # Check if still needed
                 updated_paper = papers_collection.find_one_and_update(
                     {"_id": paper_obj_id}, final_status_update, return_document=ReturnDocument.AFTER
                 )
             else: # If update became empty (e.g., only unset)
                 updated_paper = paper # Use previous state
        else:
             updated_paper = paper # Use the paper state after initial increments/status change

        if updated_paper:
            return jsonify(transform_paper(updated_paper, user_id_str))
        else:
            # Fallback fetch if final update failed
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
        set_implementable = data.get('isImplementable')

        if not isinstance(set_implementable, bool):
            return jsonify({"error": "Invalid value for isImplementable. Must be true or false."}), 400

        papers_collection = get_papers_collection()
        user_actions_collection = get_user_actions_collection()

        update = { "$set": {}, "$unset": {} }

        if set_implementable: # Owner sets to Implementable
            update["$set"] = {
                "is_implementable": True,
                "nonImplementableStatus": Config.STATUS_IMPLEMENTABLE,
                "status": Config.STATUS_NOT_STARTED
            }
            update["$unset"] = {
                "nonImplementableVotes": "", "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": "", "nonImplementableConfirmedBy": ""
            }
            print(f"Owner setting paper {paper_id} to IMPLEMENTABLE.")
        else: # Owner sets to Non-Implementable
            update["$set"] = {
                "is_implementable": False,
                "nonImplementableStatus": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB,
                "status": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE, # Display status
                "nonImplementableConfirmedBy": "owner"
            }
            update["$unset"] = { # Clear community votes/flags
                "nonImplementableVotes": "", "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": ""
            }
            print(f"Owner setting paper {paper_id} to NON-IMPLEMENTABLE.")

        if not update["$set"]: del update["$set"]
        if not update["$unset"]: del update["$unset"]

        # Delete relevant community actions regardless of owner action
        delete_result = user_actions_collection.delete_many({
            "paperId": paper_obj_id,
            "actionType": {"$in": ["confirm_non_implementable", "dispute_non_implementable"]}
        })
        print(f"Owner action: Deleted {delete_result.deleted_count} status actions for paper {paper_id}.")

        updated_paper = papers_collection.find_one_and_update(
            {"_id": paper_obj_id}, update, return_document=ReturnDocument.AFTER
        )

        if updated_paper:
            print(f"Owner set implementability for paper {paper_id} to {set_implementable}")
            # Pass owner's user ID to transform_paper if needed, otherwise session user ID
            return jsonify(transform_paper(updated_paper, session.get('user', {}).get('id')))
        else:
            if papers_collection.count_documents({"_id": paper_obj_id}) == 0:
                 return jsonify({"error": "Paper not found"}), 404
            else:
                 print(f"Error: Failed to update paper {paper_id} after owner action.")
                 return jsonify({"error": "Failed to update paper implementability status"}), 500

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
        try: obj_id = ObjectId(paper_id)
        except InvalidId: return jsonify({"error": "Invalid paper ID format"}), 400

        papers_collection = get_papers_collection()
        removed_papers_collection = get_removed_papers_collection()
        user_actions_collection = get_user_actions_collection()

        paper_to_remove = papers_collection.find_one({"_id": obj_id})
        if not paper_to_remove: return jsonify({"error": "Paper not found"}), 404

        # --- Move to removed collection ---
        removed_doc = paper_to_remove.copy()
        removed_doc["original_id"] = removed_doc.pop("_id")
        removed_doc["removedAt"] = datetime.utcnow()
        removed_doc["removedBy"] = {"userId": session['user'].get('id'), "username": session['user'].get('username')}
        if "pwc_url" in removed_doc: removed_doc["original_pwc_url"] = removed_doc["pwc_url"] # Keep original PWC URL if exists

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
