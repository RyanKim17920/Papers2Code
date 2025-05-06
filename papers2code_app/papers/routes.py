from flask import jsonify, request, session, current_app
from . import papers_bp # Import the blueprint instance
from ..extensions import limiter, mongo, csrf # Import extensions
from ..models import transform_paper, get_papers_collection, get_users_collection, get_removed_papers_collection, get_user_actions_collection
from ..utils import login_required, owner_required # Import decorators
from ..config import Config # Import config for constants

from pymongo import ReturnDocument, DESCENDING, ASCENDING
from pymongo.errors import OperationFailure, DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from dateutil.parser import parse as parse_date
from dateutil.parser._parser import ParserError
import traceback
import shlex # Keep shlex if used in search

# --- API Endpoints ---

@papers_bp.route('', methods=['GET'])
@limiter.limit("100 per minute")
def get_papers():
    try:
        # --- Parameter Parsing ---
        limit_str = request.args.get('limit', '12')
        page_str = request.args.get('page', '1')
        search_term = request.args.get('search', '').strip()
        sort_param = request.args.get('sort', 'newest').lower()
        start_date_str = request.args.get('startDate', None)
        end_date_str = request.args.get('endDate', None)
        search_authors = request.args.get('searchAuthors', '').strip()

        # --- Validation ---
        try:
            limit = int(limit_str)
            if limit <= 0: limit = 12
        except ValueError:
            return jsonify({"error": "Invalid limit parameter"}), 400

        try:
            page = int(page_str)
            if page < 1: page = 1
        except ValueError:
            return jsonify({"error": "Invalid page parameter"}), 400

        # --- Parse Dates ---
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = parse_date(start_date_str).replace(hour=0, minute=0, second=0, microsecond=0)
            if end_date_str:
                end_date = parse_date(end_date_str).replace(hour=23, minute=59, second=59, microsecond=999999)
        except ParserError:
            return jsonify({"error": "Invalid date format. Please use YYYY-MM-DD or similar."}), 400

        skip = (page - 1) * limit
        papers_cursor = None
        total_count = 0
        current_user_id = session.get('user', {}).get('id')
        papers_collection = get_papers_collection()

        # --- Determine if Search or Advanced Filter is Active ---
        is_search_active = bool(search_term or start_date or end_date or search_authors)

        # --- Atlas Search Path ---
        if is_search_active:
            print(f"Executing Search/Filter with: Term='{search_term}', Start='{start_date}', End='{end_date}', Authors='{search_authors}'")

            # --- Atlas Search Pipeline ---
            atlas_search_index_name = "default" # Or get from config if needed
            score_threshold = 3 # Or get from config if needed
            overall_limit = 2400 # Or get from config if needed

            # --- Build Search Clauses ---
            must_clauses = []
            should_clauses = []
            filter_clauses = []

            # 1. Main Search Term (Title/Abstract)
            if search_term:
                try:
                    terms = shlex.split(search_term)
                    print(f"Split terms for main search: {terms}")
                except ValueError:
                    terms = search_term.split()
                    print(f"Warning: shlex split failed for main search, using simple split: {terms}")

                must_clauses.extend([
                    {
                        "text": {
                            "query": t,
                            "path": ["title", "abstract"],
                            "fuzzy": {"maxEdits": 1, "prefixLength": 1}
                        }
                    } for t in terms
                ])
                should_clauses.append({
                    "text": {
                        "query": search_term,
                        "path": "title",
                        "score": {"boost": {"value": 3}} # Boost value from config?
                    }
                })

            # 2. Date Range Filter
            date_range_query = {}
            if start_date: date_range_query["gte"] = start_date
            if end_date: date_range_query["lte"] = end_date
            if date_range_query:
                filter_clauses.append({"range": {"path": "publication_date", **date_range_query}})

            # 3. Author Filter
            if search_authors:
                 filter_clauses.append({"text": {"query": search_authors, "path": "authors"}})

            # --- Construct the $search stage ---
            search_operator = {"index": atlas_search_index_name, "compound": {}}
            if must_clauses: search_operator["compound"]["must"] = must_clauses
            if should_clauses: search_operator["compound"]["should"] = should_clauses
            if filter_clauses: search_operator["compound"]["filter"] = filter_clauses

            # Handle case where only filters are provided
            if not must_clauses and not should_clauses and not filter_clauses:
                 is_search_active = False # Fallback to non-search if criteria somehow empty
            elif not must_clauses and not should_clauses:
                 search_operator["compound"].pop("must", None)
                 search_operator["compound"].pop("should", None)
                 # If only filters, ensure compound isn't empty
                 if not filter_clauses: is_search_active = False # Fallback

            # --- Build Full Pipeline (Only if search is active) ---
            if is_search_active:
                print(f"Executing Atlas Search with sort: '{sort_param}'")
                search_pipeline_stages = [{"$search": search_operator}]
                if search_term: # Only add score/highlight if text search was performed
                    search_pipeline_stages.extend([
                        {"$addFields": {"score": {"$meta": "searchScore"}, "highlights": {"$meta": "searchHighlights"}}},
                        {"$match": {"score": {"$gt": score_threshold}}}
                    ])
                    # Atlas search results are typically sorted by score relevance
                    sort_stage = {"$sort": {"score": DESCENDING, "publication_date": DESCENDING}}
                else: # Sort by date if only filters were used
                    sort_stage = {"$sort": {"publication_date": DESCENDING}}
                search_pipeline_stages.append(sort_stage)
                search_pipeline_stages.append({"$limit": overall_limit})

                facet_pipeline = search_pipeline_stages + [
                    {"$facet": {
                        "paginatedResults": [{"$skip": skip}, {"$limit": limit}],
                        "totalCount": [{"$count": 'count'}]
                    }}
                ]

                # --- Execute Aggregation ---
                try:
                    print("Executing Atlas Search $facet pipeline...")
                    results = list(papers_collection.aggregate(facet_pipeline, allowDiskUse=True))
                    if results and results[0]:
                        total_count = results[0]['totalCount'][0]['count'] if results[0]['totalCount'] else 0
                        papers_cursor = results[0]['paginatedResults']
                        print(f"Atlas Search returned {len(papers_cursor)} papers for page {page}, total found: {total_count}")
                    else:
                        print("Atlas Search returned no results.")
                        papers_cursor = []
                        total_count = 0
                except OperationFailure as op_error:
                     print(f"Atlas Search OperationFailure: {op_error.details}")
                     traceback.print_exc()
                     return jsonify({"error": "Search operation failed"}), 500
                except Exception as agg_error:
                    print(f"Error during Atlas Search aggregation: {agg_error}")
                    traceback.print_exc()
                    return jsonify({"error": "Failed to execute search query"}), 500
            # --- End Atlas Search Path ---

        # --- Non-search / Default Path ---
        if not is_search_active:
            print(f"Executing standard FIND with sort: '{sort_param}' and default non-implementable filter.")
            # Default filter: Exclude papers confirmed non-implementable
            base_filter = {
                "nonImplementableStatus": {"$ne": Config.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB}
            }

            if sort_param == 'oldest':
                sort_criteria = [("publication_date", ASCENDING)]
            elif sort_param == 'upvotes':
                sort_criteria = [("upvoteCount", DESCENDING), ("publication_date", DESCENDING)]
            else: # Default to newest
                sort_criteria = [("publication_date", DESCENDING)]

            try:
                # Apply the base_filter to count and find
                total_count = papers_collection.count_documents(base_filter)
                print(f"Total documents (default view count): {total_count}")
                if total_count > 0:
                     papers_cursor = papers_collection.find(base_filter).sort(sort_criteria).skip(skip).limit(limit)
                else:
                     papers_cursor = []
            except Exception as find_error:
                 print(f"Error during non-search find/count: {find_error}")
                 traceback.print_exc()
                 return jsonify({"error": "Failed to retrieve paper data"}), 500
            # --- End Non-search logic ---

        # --- Process Results & Return ---
        total_count = int(total_count)
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
        papers_list = [transform_paper(paper, current_user_id) for paper in papers_cursor] if papers_cursor else []

        return jsonify({"papers": papers_list, "totalPages": total_pages})

    except Exception as e:
        print(f"General Error in GET /api/papers: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred"}), 500


@papers_bp.route('/<string:paper_id>', methods=['GET'])
@limiter.limit("100 per minute")
def get_paper_by_id(paper_id):
    try:
        try: obj_id = ObjectId(paper_id)
        except InvalidId: return jsonify({"error": "Invalid paper ID format"}), 400

        papers_collection = get_papers_collection()
        paper_doc = papers_collection.find_one({"_id": obj_id})
        if paper_doc:
            current_user_id = session.get('user', {}).get('id')
            return jsonify(transform_paper(paper_doc, current_user_id))
        else: return jsonify({"error": "Paper not found"}), 404
    except Exception as e:
        print(f"Error in GET /api/papers/{paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred"}), 500

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
                        "createdAt": datetime.utcnow()
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
            return jsonify({"upvotes": [], "confirmations": [], "disputes": []}), 200

        # Get unique user IDs involved
        user_ids = list(set(action['userId'] for action in actions if 'userId' in action))

        # Fetch user details in one go
        user_details_list = list(users_collection.find(
            {"_id": {"$in": user_ids}},
            {"_id": 1, "username": 1, "avatar_url": 1} # Project needed user fields
        ))
        user_map = {str(user['_id']): {
                        "userId": str(user['_id']),
                        "username": user.get('username', 'Unknown'),
                        "avatarUrl": user.get('avatar_url') # Match frontend UserProfile field
                    } for user in user_details_list}

        # Categorize actions
        result = {"upvotes": [], "confirmations": [], "disputes": []}
        for action in actions:
            user_id_str = str(action.get('userId'))
            user_info = user_map.get(user_id_str)
            if not user_info:
                continue # Skip if user details couldn't be found

            action_type = action.get('actionType')
            if action_type == 'upvote':
                result["upvotes"].append(user_info)
            elif action_type == 'confirm_non_implementable':
                result["confirmations"].append(user_info)
            elif action_type == 'dispute_non_implementable':
                result["disputes"].append(user_info)

        return jsonify(result), 200

    except Exception as e:
        print(f"Error getting actions for paper {paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred while fetching actions"}), 500
