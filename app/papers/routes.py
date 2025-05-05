from flask import Blueprint, request, jsonify, session, current_app
from pymongo import DESCENDING, ASCENDING
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone
import traceback
from dateutil.parser import parse as parse_date
from dateutil.parser._parser import ParserError
import shlex

# Assuming db access functions are in app.db
from ..db import (
    get_papers_collection,
    get_user_actions_collection,
    get_removed_papers_collection,
    get_users_collection
)
# Import helpers and decorators
from ..utils.helpers import transform_paper, _update_paper_vote_counts
from ..utils.decorators import login_required, owner_required

papers_bp = Blueprint('papers', __name__)

# --- Routes ---

@papers_bp.route('/papers', methods=['GET'])
def get_papers():
    """Fetches a paginated list of papers, with filtering and sorting options."""
    papers_collection = get_papers_collection()
    if not papers_collection:
        return jsonify({"error": "Database connection not available"}), 503

    try:
        limit_str = request.args.get('limit', str(current_app.config.get('DEFAULT_PAGE_LIMIT', 12)))
        page_str = request.args.get('page', '1')
        sort_param = request.args.get('sort', 'newest').lower()
        start_date_str = request.args.get('startDate', None)
        end_date_str = request.args.get('endDate', None)

        try:
            limit = int(limit_str)
            if limit <= 0: limit = current_app.config.get('DEFAULT_PAGE_LIMIT', 12)
        except ValueError:
            return jsonify({"error": "Invalid limit parameter"}), 400

        try:
            page = int(page_str)
            if page < 1: page = 1
        except ValueError:
            return jsonify({"error": "Invalid page parameter"}), 400

        skip = (page - 1) * limit

        start_date = None
        end_date = None
        date_filter = {}
        try:
            if start_date_str:
                start_date = parse_date(start_date_str).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
                date_filter["$gte"] = start_date
            if end_date_str:
                end_date = parse_date(end_date_str).replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
                date_filter["$lte"] = end_date
        except ParserError:
            return jsonify({"error": "Invalid date format. Please use YYYY-MM-DD or similar."}), 400

        base_filter = {
            "nonImplementableStatus": {"$ne": current_app.config['STATUS_CONFIRMED_NON_IMPLEMENTABLE']}
        }
        if date_filter:
            base_filter["publication_date"] = date_filter

        if sort_param == 'oldest':
            sort_criteria = [("publication_date", ASCENDING)]
        elif sort_param == 'upvotes':
            sort_criteria = [("upvoteCount", DESCENDING), ("publication_date", DESCENDING)]
        else:
            sort_criteria = [("publication_date", DESCENDING)]

        total_papers = papers_collection.count_documents(base_filter)
        papers_cursor = papers_collection.find(base_filter).sort(sort_criteria).skip(skip).limit(limit)

        current_user_id = session.get('user', {}).get('id')
        papers_list = [transform_paper(paper, current_user_id) for paper in papers_cursor]
        papers_list = [p for p in papers_list if p is not None]

        total_pages = (total_papers + limit - 1) // limit if total_papers > 0 else 1

        return jsonify({
            "papers": papers_list,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
            "totalPapers": total_papers
        })

    except Exception as e:
        current_app.logger.error(f"Error in /papers endpoint: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred while fetching papers."}), 500


@papers_bp.route('/papers/search', methods=['GET'])
def search_papers():
    """Searches papers using MongoDB Atlas Search, including filters."""
    papers_collection = get_papers_collection()
    if not papers_collection:
        return jsonify({"error": "Database connection not available"}), 503

    try:
        search_term = request.args.get('search', '').strip()
        search_authors = request.args.get('searchAuthors', '').strip()
        start_date_str = request.args.get('startDate', None)
        end_date_str = request.args.get('endDate', None)
        limit_str = request.args.get('limit', str(current_app.config.get('DEFAULT_PAGE_LIMIT', 12)))
        page_str = request.args.get('page', '1')

        try:
            limit = int(limit_str)
            if limit <= 0: limit = current_app.config.get('DEFAULT_PAGE_LIMIT', 12)
        except ValueError:
            return jsonify({"error": "Invalid limit parameter"}), 400
        try:
            page = int(page_str)
            if page < 1: page = 1
        except ValueError:
            return jsonify({"error": "Invalid page parameter"}), 400
        skip = (page - 1) * limit

        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = parse_date(start_date_str).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            if end_date_str:
                end_date = parse_date(end_date_str).replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
        except ParserError:
            return jsonify({"error": "Invalid date format. Please use YYYY-MM-DD or similar."}), 400

        atlas_search_index_name = current_app.config.get('ATLAS_SEARCH_INDEX_NAME', 'default')
        score_threshold = current_app.config.get('ATLAS_SEARCH_SCORE_THRESHOLD', 3)
        overall_limit = current_app.config.get('ATLAS_SEARCH_OVERALL_LIMIT', 2400)

        must_clauses = []
        should_clauses = []
        filter_clauses = []

        if search_term:
            try:
                terms = shlex.split(search_term)
                current_app.logger.info(f"Split terms for main search: {terms}")
            except ValueError:
                terms = search_term.split()
                current_app.logger.warning(f"shlex split failed for main search, using simple split: {terms}")

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
                    "score": {"boost": {"value": 3}}
                }
            })

        date_range_query = {}
        if start_date: date_range_query["gte"] = start_date
        if end_date: date_range_query["lte"] = end_date
        if date_range_query:
            filter_clauses.append({"range": {"path": "publication_date", **date_range_query}})

        if search_authors:
            filter_clauses.append({"text": {"query": search_authors, "path": "authors"}})

        if not must_clauses and not should_clauses and not filter_clauses:
            return jsonify({"papers": [], "page": page, "limit": limit, "totalPages": 0, "totalPapers": 0})

        search_operator = {"index": atlas_search_index_name, "compound": {}}
        if must_clauses: search_operator["compound"]["must"] = must_clauses
        if should_clauses: search_operator["compound"]["should"] = should_clauses
        if filter_clauses: search_operator["compound"]["filter"] = filter_clauses

        if not must_clauses and not should_clauses:
            search_operator["compound"].pop("must", None)
            search_operator["compound"].pop("should", None)

        search_pipeline_stages = [{"$search": search_operator}]

        if search_term:
            search_pipeline_stages.extend([
                {"$addFields": {"searchScore": {"$meta": "searchScore"}}},
                {"$match": {"searchScore": {"$gt": score_threshold}}}
            ])
            sort_stage = {"$sort": {"searchScore": DESCENDING, "publication_date": DESCENDING}}
        else:
            sort_stage = {"$sort": {"publication_date": DESCENDING}}

        search_pipeline_stages.append(sort_stage)
        search_pipeline_stages.append({"$limit": overall_limit})

        facet_pipeline = search_pipeline_stages + [
            {"$facet": {
                "paginatedResults": [{"$skip": skip}, {"$limit": limit}],
                "totalCount": [{"$count": 'count'}]
            }}
        ]

        current_app.logger.info(f"Executing Atlas Search pipeline: {facet_pipeline}")
        results = list(papers_collection.aggregate(facet_pipeline, allowDiskUse=True))

        if results and results[0] and results[0]['totalCount']:
            total_papers = results[0]['totalCount'][0]['count']
            papers_cursor = results[0]['paginatedResults']
            search_type = "Text search" if search_term else "Filter-only search"
            current_app.logger.info(f"Atlas Search ({search_type}) found {total_papers} total documents matching criteria (pre-facet limit: {overall_limit}).")
        else:
            total_papers = 0
            papers_cursor = []
            current_app.logger.info("Atlas Search returned no results.")

        current_user_id = session.get('user', {}).get('id')
        papers_list = [transform_paper(paper, current_user_id) for paper in papers_cursor]
        papers_list = [p for p in papers_list if p is not None]

        total_pages = (total_papers + limit - 1) // limit if total_papers > 0 else 1

        return jsonify({
            "papers": papers_list,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
            "totalPapers": total_papers
        })

    except Exception as e:
        current_app.logger.error(f"Error in /papers/search endpoint: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during search."}), 500


def _check_and_update_non_implementable_status(paper_id_obj):
    papers_collection = get_papers_collection()
    user_actions_collection = get_user_actions_collection()
    if not papers_collection or not user_actions_collection:
        current_app.logger.error("Cannot check status: DB connection unavailable.")
        return

    paper = papers_collection.find_one({"_id": paper_id_obj})
    if not paper:
        current_app.logger.warning(f"Cannot check status for non-existent paper: {paper_id_obj}")
        return

    confirm_threshold = current_app.config.get('NON_IMPLEMENTABLE_CONFIRM_THRESHOLD', 3)
    status_confirmed = current_app.config['STATUS_CONFIRMED_NON_IMPLEMENTABLE']
    status_flagged = current_app.config['STATUS_FLAGGED']
    status_implementable = current_app.config['STATUS_IMPLEMENTABLE']
    status_not_started = current_app.config['STATUS_NOT_STARTED']
    action_confirm = 'confirm_non_implementable'
    action_dispute = 'dispute_non_implementable'

    current_status = paper.get("nonImplementableStatus")

    if current_status not in [status_flagged, status_implementable, None]:
        return

    confirm_votes = paper.get("nonImplementableVotes", 0)
    dispute_votes = paper.get("disputeImplementableVotes", 0)
    current_app.logger.info(f"Checking thresholds for paper {paper_id_obj}: Confirm={confirm_votes}, Dispute={dispute_votes}, Threshold={confirm_threshold}")

    final_status_update = {"$set": {}, "$unset": {}}
    needs_update = False

    if confirm_votes > 0 and confirm_votes >= dispute_votes + confirm_threshold:
        if current_status != status_confirmed or paper.get("nonImplementableConfirmedBy") != "community":
            final_status_update["$set"] = {
                "is_implementable": False,
                "nonImplementableStatus": status_confirmed,
                "status": status_confirmed,
                "nonImplementableConfirmedBy": "community"
            }
            needs_update = True
            current_app.logger.info(f"Paper {paper_id_obj} meets threshold for community confirmation.")

    elif (dispute_votes >= confirm_votes or confirm_votes == 0) and current_status == status_flagged:
        final_status_update["$set"] = {
            "is_implementable": True,
            "nonImplementableStatus": status_implementable,
            "status": status_not_started
        }
        final_status_update["$unset"] = {
            "nonImplementableVotes": "", "disputeImplementableVotes": "",
            "nonImplementableFlaggedBy": "", "nonImplementableConfirmedBy": ""
        }
        needs_update = True
        current_app.logger.info(f"Paper {paper_id_obj} meets threshold to revert to implementable.")
        try:
            delete_actions_result = user_actions_collection.delete_many({
                "paperId": paper_id_obj,
                "actionType": {"$in": [action_confirm, action_dispute]}
            })
            current_app.logger.info(f"Revert: Deleted {delete_actions_result.deleted_count} status actions for paper {paper_id_obj}.")
        except Exception as del_err:
            current_app.logger.error(f"Error deleting status actions for paper {paper_id_obj} on revert: {del_err}")

    elif confirm_votes > 0 and current_status != status_flagged and current_status != status_confirmed:
        final_status_update["$set"] = {
            "nonImplementableStatus": status_flagged
        }
        needs_update = True
        current_app.logger.info(f"Paper {paper_id_obj} status set to flagged.")

    if needs_update:
        if not final_status_update["$set"]: del final_status_update["$set"]
        if not final_status_update["$unset"]: del final_status_update["$unset"]

        try:
            update_result = papers_collection.update_one({"_id": paper_id_obj}, final_status_update)
            if update_result.modified_count > 0:
                current_app.logger.info(f"Successfully applied status update to paper {paper_id_obj}.")
            elif update_result.matched_count > 0:
                current_app.logger.info(f"Status update check for paper {paper_id_obj} resulted in no change.")
            else:
                current_app.logger.warning(f"Matched 0 documents when trying to update status for paper {paper_id_obj}.")
        except Exception as e:
            current_app.logger.error(f"Failed to apply final status update for paper {paper_id_obj}: {e}")
            traceback.print_exc()


@papers_bp.route('/papers/<paper_id>/implementability', methods=['POST'])
@login_required
def vote_implementability(paper_id):
    user_actions_collection = get_user_actions_collection()
    papers_collection = get_papers_collection()
    if not user_actions_collection or not papers_collection:
        return jsonify({"error": "Database connection not available"}), 503

    try:
        paper_id_obj = ObjectId(paper_id)
        user_id_obj = ObjectId(session['user']['id'])
    except InvalidId:
        return jsonify({"error": "Invalid paper or user ID format"}), 400

    data = request.get_json()
    action = data.get('action')

    if action not in ['confirm', 'dispute', 'retract']:
        return jsonify({"error": "Invalid action. Must be 'confirm', 'dispute', or 'retract'."}), 400

    paper = papers_collection.find_one({"_id": paper_id_obj})
    if not paper:
        return jsonify({"error": "Paper not found"}), 404

    status_confirmed = current_app.config['STATUS_CONFIRMED_NON_IMPLEMENTABLE']
    status_flagged = current_app.config['STATUS_FLAGGED']
    status_implementable = current_app.config['STATUS_IMPLEMENTABLE']

    if paper.get("nonImplementableStatus") == status_confirmed and paper.get("nonImplementableConfirmedBy") == "owner":
        return jsonify({"error": "Implementability status already confirmed by owner."}), 400

    now = datetime.now(timezone.utc)
    action_confirm = 'confirm_non_implementable'
    action_dispute = 'dispute_non_implementable'

    current_action_doc = user_actions_collection.find_one({
        "userId": user_id_obj,
        "paperId": paper_id_obj,
        "actionType": {"$in": [action_confirm, action_dispute]}
    })
    current_action_type = current_action_doc.get("actionType") if current_action_doc else None

    action_update_successful = False
    increment_confirm = 0
    increment_dispute = 0
    set_flagged_status = False
    set_flagged_by = False

    try:
        if action == 'retract':
            if not current_action_doc:
                return jsonify({"error": "No existing vote to retract."}), 400
            delete_result = user_actions_collection.delete_one({"_id": current_action_doc["_id"]})
            if delete_result.deleted_count == 1:
                action_update_successful = True
                if current_action_type == action_confirm:
                    increment_confirm = -1
                elif current_action_type == action_dispute:
                    increment_dispute = -1
                current_app.logger.info(f"User {user_id_obj} retracted {current_action_type} vote for paper {paper_id_obj}")
            else:
                current_app.logger.warning(f"Failed to delete action {current_action_doc['_id']} during retract.")

        elif action == 'confirm':
            new_action_type = action_confirm
            if current_action_type == new_action_type:
                return jsonify({"error": "You have already confirmed non-implementability."}), 400
            if current_action_doc:
                update_result = user_actions_collection.update_one(
                    {"_id": current_action_doc["_id"]},
                    {"$set": {"actionType": new_action_type, "timestamp": now}}
                )
                if update_result.modified_count == 1:
                    action_update_successful = True
                    increment_confirm = 1
                    increment_dispute = -1
                    current_app.logger.info(f"User {user_id_obj} switched vote to {new_action_type} for paper {paper_id_obj}")
            else:
                insert_result = user_actions_collection.insert_one({
                    "userId": user_id_obj, "paperId": paper_id_obj,
                    "actionType": new_action_type, "timestamp": now
                })
                if insert_result.inserted_id:
                    action_update_successful = True
                    increment_confirm = 1
                    if paper.get("nonImplementableStatus", status_implementable) == status_implementable:
                        set_flagged_status = True
                        if not paper.get("nonImplementableFlaggedBy"):
                            set_flagged_by = True
                    current_app.logger.info(f"User {user_id_obj} added new {new_action_type} vote for paper {paper_id_obj}")

        elif action == 'dispute':
            new_action_type = action_dispute
            if current_action_type == new_action_type:
                return jsonify({"error": "You have already disputed non-implementability."}), 400
            current_status = paper.get("nonImplementableStatus")
            if current_status not in [status_flagged, status_confirmed] or \
               (current_status == status_confirmed and paper.get("nonImplementableConfirmedBy") == "owner"):
                return jsonify({"error": "Paper is not currently in a state that can be disputed."}), 400
            if current_action_doc:
                update_result = user_actions_collection.update_one(
                    {"_id": current_action_doc["_id"]},
                    {"$set": {"actionType": new_action_type, "timestamp": now}}
                )
                if update_result.modified_count == 1:
                    action_update_successful = True
                    increment_confirm = -1
                    increment_dispute = 1
                    current_app.logger.info(f"User {user_id_obj} switched vote to {new_action_type} for paper {paper_id_obj}")
            else:
                insert_result = user_actions_collection.insert_one({
                    "userId": user_id_obj, "paperId": paper_id_obj,
                    "actionType": new_action_type, "timestamp": now
                })
                if insert_result.inserted_id:
                    action_update_successful = True
                    increment_dispute = 1
                    current_app.logger.info(f"User {user_id_obj} added new {new_action_type} vote for paper {paper_id_obj}")

        if action_update_successful and (increment_confirm != 0 or increment_dispute != 0 or set_flagged_status):
            paper_update = {"$inc": {}}
            if increment_confirm != 0:
                paper_update["$inc"]["nonImplementableVotes"] = increment_confirm
            if increment_dispute != 0:
                paper_update["$inc"]["disputeImplementableVotes"] = increment_dispute
            if set_flagged_status:
                paper_update["$set"] = {"nonImplementableStatus": status_flagged}
                if set_flagged_by:
                    paper_update["$set"]["nonImplementableFlaggedBy"] = user_id_obj

            if not paper_update["$inc"]: del paper_update["$inc"]
            if paper_update:
                update_result = papers_collection.update_one({"_id": paper_id_obj}, paper_update)
                if update_result.matched_count == 0:
                    current_app.logger.error(f"Failed to apply initial update to paper {paper_id_obj} after action {action}.")
                else:
                    current_app.logger.info(f"Applied initial increments/status for paper {paper_id_obj}.")

        if action_update_successful:
            _check_and_update_non_implementable_status(paper_id_obj)

        final_paper_doc = papers_collection.find_one({"_id": paper_id_obj})
        if final_paper_doc:
            transformed_paper = transform_paper(final_paper_doc, session['user']['id'])
            return jsonify(transformed_paper) if transformed_paper else jsonify({"error": "Failed to process final paper data"}), 500
        else:
            return jsonify({"error": "Failed to retrieve final paper status."}), 500

    except Exception as e:
        current_app.logger.error(f"Error processing implementability vote for paper {paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during implementability voting"}), 500