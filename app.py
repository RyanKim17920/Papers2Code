# app.py (Updated with Sorting for /api/papers)

import os
import re
import requests
import shlex
import uuid
from flask import Flask, jsonify, request, redirect, url_for, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from pymongo import MongoClient, ReturnDocument, DESCENDING, ASCENDING
from pymongo.errors import OperationFailure, DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from datetime import datetime
from dateutil.parser import parse as parse_date # For flexible date parsing
from dateutil.parser._parser import ParserError # Import specific error
from functools import wraps
import traceback  # Add traceback for better error logging

# --- Decorators ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- NEW: Owner Required Decorator ---
def owner_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Authentication required"}), 401
        owner_username = os.getenv('OWNER_GITHUB_USERNAME')
        if not owner_username:
            print("Warning: OWNER_GITHUB_USERNAME not set in environment.")
            return jsonify({"error": "Server configuration error: Owner not defined"}), 500
        if session['user'].get('username') != owner_username:
            return jsonify({"error": "Forbidden: Owner privileges required"}), 403
        return f(*args, **kwargs)
    return decorated_function

# --- Flask App Initialization ---
load_dotenv()
app = Flask(__name__)

# --- Configuration ---
MONGO_URI = os.getenv('MONGO_URI')
GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID')
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET')
FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY')
OWNER_GITHUB_USERNAME = os.getenv('OWNER_GITHUB_USERNAME')
NON_IMPLEMENTABLE_CONFIRM_THRESHOLD = int(os.getenv('NON_IMPLEMENTABLE_CONFIRM_THRESHOLD', 3))
# Define the status string
STATUS_CONFIRMED_NON_IMPLEMENTABLE = "Confirmed Non-Implementable"
STATUS_NOT_STARTED = "Not Started" 

if not MONGO_URI: raise ValueError("No MONGO_URI found")
if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET: raise ValueError("GitHub Client ID or Secret not found")
if not FLASK_SECRET_KEY: raise ValueError("FLASK_SECRET_KEY not found")
if not OWNER_GITHUB_USERNAME:
    print("Warning: OWNER_GITHUB_USERNAME is not set in the environment. Paper removal functionality will be disabled.")

app.secret_key = FLASK_SECRET_KEY
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}}, supports_credentials=True)
csrf = CSRFProtect(app)
talisman = Talisman(
    app,
    content_security_policy=None,
    content_security_policy_nonce_in=['script-src'],
    force_https=False
)

# --- Rate Limiter Initialization ---
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
    strategy="fixed-window"
)

# --- MongoDB Connection & Indexing ---
try:
    client = MongoClient(MONGO_URI)
    db = client.get_database('papers2code')
    print("Connected to MongoDB database:", db.name)
    papers_collection = db.papers_without_code
    users_collection = db.users
    removed_papers_collection = db.removed_papers
    user_votes_collection = db.user_action_votes
    paper_status_votes_collection = db.paper_status_votes
    print("Available collections:", db.list_collection_names())

    # --- Get existing index names --- 
    papers_indexes = papers_collection.index_information()
    users_indexes = users_collection.index_information()
    removed_papers_indexes = removed_papers_collection.index_information()
    user_votes_indexes = user_votes_collection.index_information()
    paper_status_votes_indexes = paper_status_votes_collection.index_information()
    print("Existing indexes fetched.")

    # --- Ensure Indexes --- 
    # Papers Collection
    text_index_name = "title_text_abstract_text_authors_text"

    if text_index_name not in papers_indexes:
         # If the index somehow got dropped, recreate it (adjust weights if needed)
         print(f"Recreating missing text index: {text_index_name}...")
         papers_collection.create_index(
             [("title", "text"), ("abstract", "text"), ("authors", "text")],
             weights={"title": 200, "abstract": 2, "authors": 5}, # Keep weights for initial match
             name=text_index_name, background=True )
         print(f"Index '{text_index_name}' created.")
    else:
         print(f"Index exists: {text_index_name}")

    pwc_url_index_name = "pwc_url_1"
    if pwc_url_index_name not in papers_indexes:
        papers_collection.create_index([("pwc_url", 1)], name=pwc_url_index_name, unique=True, background=True)
        print(f"Creating index: {pwc_url_index_name}")
    else:
        print(f"Index exists: {pwc_url_index_name}")

    pub_date_index_name = "publication_date_-1"
    if pub_date_index_name not in papers_indexes:
        papers_collection.create_index([("publication_date", DESCENDING)], name=pub_date_index_name, background=True)
        print(f"Creating index: {pub_date_index_name}")
    else:
        print(f"Index exists: {pub_date_index_name}")

    upvote_index_name = "upvoteCount_-1"
    if upvote_index_name not in papers_indexes:
        papers_collection.create_index([("upvoteCount", DESCENDING)], name=upvote_index_name, background=True, sparse=True)
        print(f"Creating index: {upvote_index_name}")
    else:
        print(f"Index exists: {upvote_index_name}")

    # Users Collection
    github_id_index_name = "githubId_1"
    if github_id_index_name not in users_indexes:
        users_collection.create_index([("githubId", 1)], name=github_id_index_name, unique=True, background=True)
        print(f"Creating index: {github_id_index_name}")
    else:
        print(f"Index exists: {github_id_index_name}")

    # Removed Papers Collection
    removed_at_index_name = "removedAt_-1"
    if removed_at_index_name not in removed_papers_indexes:
        removed_papers_collection.create_index([("removedAt", DESCENDING)], name=removed_at_index_name, background=True)
        print(f"Creating index: {removed_at_index_name}")
    else:
        print(f"Index exists: {removed_at_index_name}")

    original_pwc_url_index_name = "original_pwc_url_1"
    if original_pwc_url_index_name not in removed_papers_indexes:
        removed_papers_collection.create_index([("original_pwc_url", 1)], name=original_pwc_url_index_name, background=True)
        print(f"Creating index: {original_pwc_url_index_name}")
    else:
        print(f"Index exists: {original_pwc_url_index_name}")

    # User Votes Collection
    user_paper_vote_index_name = "userId_1_paperId_1"
    if user_paper_vote_index_name not in user_votes_indexes:
        user_votes_collection.create_index([("userId", 1), ("paperId", 1)], name=user_paper_vote_index_name, unique=True, background=True)
        print(f"Creating index: {user_paper_vote_index_name}")
    else:
        print(f"Index exists: {user_paper_vote_index_name}")

    paper_vote_lookup_index_name = "paperId_1"
    if paper_vote_lookup_index_name not in user_votes_indexes:
        user_votes_collection.create_index([("paperId", 1)], name=paper_vote_lookup_index_name, background=True)
        print(f"Creating index: {paper_vote_lookup_index_name}")
    else:
        print(f"Index exists: {paper_vote_lookup_index_name}")

    status_vote_user_paper_type_index = "userId_1_paperId_1_voteType_1"
    if status_vote_user_paper_type_index not in paper_status_votes_indexes:
        paper_status_votes_collection.create_index(
            [("userId", 1), ("paperId", 1), ("voteType", 1)],
            name=status_vote_user_paper_type_index, unique=True, background=True
        )
        print(f"Creating index: {status_vote_user_paper_type_index}")
    else:
        print(f"Index exists: {status_vote_user_paper_type_index}")

    status_vote_paper_lookup_index = "paperId_1"
    if status_vote_paper_lookup_index not in paper_status_votes_indexes:
        paper_status_votes_collection.create_index(
            [("paperId", 1)], name=status_vote_paper_lookup_index, background=True
        )
        print(f"Creating index: {status_vote_paper_lookup_index}")
    else:
        print(f"Index exists: {status_vote_paper_lookup_index}")

    print("Index check complete.")
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(f"Error connecting to MongoDB or creating indexes: {e}")
    traceback.print_exc() # Print traceback on error
    exit()

# --- Helper Function ---
def transform_paper(paper_doc, current_user_id=None):  # Add current_user_id
    default_steps = [
        {"id": 1, "name": 'Contact Author', "description": 'Email first author about open-sourcing.', "status": 'pending'},
        {"id": 2, "name": 'Define Requirements', "description": 'Outline key components, data, and metrics.', "status": 'pending'},
        {"id": 3, "name": 'Implement Code', "description": 'Develop the core algorithm and experiments.', "status": 'pending'},
        {"id": 4, "name": 'Annotate & Explain (Optional)', "description": 'Add detailed code comments linking to the paper.', "status": 'pending'},
        {"id": 5, "name": 'Submit & Review', "description": 'Submit code for review and potential merging.', "status": 'pending'},
    ]
    authors_list = [{"name": author_name} for author_name in paper_doc.get("authors", [])]
    publication_date = paper_doc.get("publication_date")
    date_str = publication_date.strftime('%Y-%m-%d') if isinstance(publication_date, datetime) else str(publication_date)

    # Determine current user's vote status
    current_user_vote = 'none'
    if current_user_id:
        vote_doc = user_votes_collection.find_one({"userId": ObjectId(current_user_id), "paperId": paper_doc["_id"]})
        if vote_doc:
            current_user_vote = 'up'  # Assuming only upvotes for now

    current_user_implementability_vote = 'none'
    if current_user_id:
        status_vote_doc = paper_status_votes_collection.find_one({
            "userId": ObjectId(current_user_id),
            "paperId": paper_doc["_id"]
        })
        if status_vote_doc:
            if status_vote_doc.get("voteType") == 'confirm_non_implementable':
                current_user_implementability_vote = 'up' # Map confirm -> up
            elif status_vote_doc.get("voteType") == 'dispute_non_implementable':
                current_user_implementability_vote = 'down' # Map dispute -> down


    return {
        "id": str(paper_doc["_id"]), "pwcUrl": paper_doc.get("pwc_url"),
        "arxivId": paper_doc.get("arxiv_id"), "title": paper_doc.get("title"),
        "abstract": paper_doc.get("abstract"), "authors": authors_list,
        "urlAbs": paper_doc.get("url_abs"), "urlPdf": paper_doc.get("url_pdf"),
        "date": date_str, "proceeding": paper_doc.get("venue"),
        "tasks": paper_doc.get("tasks", []),
        # --- Implementability Fields ---
        "isImplementable": paper_doc.get("isImplementable", True),
        "nonImplementableStatus": paper_doc.get("nonImplementableStatus", "implementable"),
        "nonImplementableVotes": paper_doc.get("nonImplementableVotes", 0), # Thumbs Up count
        "disputeImplementableVotes": paper_doc.get("disputeImplementableVotes", 0), # Thumbs Down count
        "currentUserImplementabilityVote": current_user_implementability_vote, # 'up', 'down', or 'none'
        "nonImplementableConfirmedBy": paper_doc.get("nonImplementableConfirmedBy"), # NEW: 'community', 'owner', or null
        # --- End Implementability Fields ---
        "implementationStatus": paper_doc.get("status", STATUS_NOT_STARTED), # Use constant
        "implementationSteps": paper_doc.get("implementationSteps", default_steps),
        "upvoteCount": paper_doc.get("upvoteCount", 0),
        "currentUserVote": current_user_vote
    }

# --- API Endpoints ---

@app.route('/api/papers', methods=['GET'])
@limiter.limit("100 per minute")
def get_papers():
    try:
        # --- Parameter Parsing ---
        # ... (keep existing parsing: limit, page, search_term, sort_param, dates, authors) ...
        limit_str = request.args.get('limit', '12')
        page_str = request.args.get('page', '1')
        search_term = request.args.get('search', '').strip()
        sort_param = request.args.get('sort', 'newest').lower()
        start_date_str = request.args.get('startDate', None)
        end_date_str = request.args.get('endDate', None)
        search_authors = request.args.get('searchAuthors', '').strip()

        # ... (limit, page validation) ...
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

        # --- Determine if Search or Advanced Filter is Active ---
        # Consider any specific filter or search term as 'active search'
        is_search_active = bool(search_term or start_date or end_date or search_authors)

        # --- Atlas Search Path ---
        if is_search_active:
            # ... (keep existing Atlas Search pipeline logic) ...
            # This path naturally allows finding non-implementable papers if they match search criteria.
            print(f"Executing Search/Filter with: Term='{search_term}', Start='{start_date}', End='{end_date}', Authors='{search_authors}'")

            # --- Atlas Search Pipeline ---
            atlas_search_index_name = "default"
            score_threshold = 3
            overall_limit = 2400

            # --- Build Search Clauses ---
            must_clauses = []
            should_clauses = []
            filter_clauses = []

            # 1. Main Search Term (Title/Abstract)
            if search_term:
                # ... (existing search term logic) ...
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
                        "score": {"boost": {"value": 3}}
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
                search_pipeline_stages = [{"$search": search_operator}]
                if search_term: # Only add score/highlight if text search was performed
                    search_pipeline_stages.extend([
                        {"$addFields": {"score": {"$meta": "searchScore"}, "highlights": {"$meta": "searchHighlights"}}},
                        {"$match": {"score": {"$gt": score_threshold}}}
                    ])
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
                    # ... (existing aggregation execution and error handling) ...
                    print("Executing Atlas Search $facet pipeline...")
                    results = list(papers_collection.aggregate(facet_pipeline, allowDiskUse=True))
                    if results and results[0]:
                        total_count = results[0]['totalCount'][0]['count'] if results[0]['totalCount'] else 0
                        papers_cursor = results[0]['paginatedResults']
                        search_type = "Text search" if search_term else "Filter-only search"
                        print(f"Atlas Search found {total_count} total documents matching criteria (capped at {overall_limit}).")
                        print(f"Returning {len(papers_cursor)} documents for page {page}.")
                    else:
                         print("Atlas Search returned no results or unexpected format after filtering/limiting.")
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
            # --- MODIFICATION: Add default filter ---
            base_filter = {
                "nonImplementableStatus": {"$ne": "confirmed_non_implementable"}
            }
            # --- End MODIFICATION ---

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
        # ... (keep existing result processing and return) ...
        total_count = int(total_count)
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
        papers_list = [transform_paper(paper, current_user_id) for paper in papers_cursor] if papers_cursor else []

        return jsonify({"papers": papers_list, "totalPages": total_pages})

    except Exception as e:
        print(f"General Error in /api/papers: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred"}), 500


@app.route('/api/papers/<string:paper_id>', methods=['GET'])
@limiter.limit("100 per minute")
def get_paper_by_id(paper_id):
    try:
        try: obj_id = ObjectId(paper_id)
        except InvalidId: return jsonify({"error": "Invalid paper ID format"}), 400

        paper_doc = papers_collection.find_one({"_id": obj_id})
        if paper_doc:
            current_user_id = session.get('user', {}).get('id')
            return jsonify(transform_paper(paper_doc, current_user_id))
        else: return jsonify({"error": "Paper not found"}), 404
    except Exception as e:
        print(f"Error in /api/papers/{paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred"}), 500

@app.route('/api/papers/<string:paper_id>/vote', methods=['POST'])
@limiter.limit("60 per minute")
@login_required
@csrf.exempt
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

        paper_exists = papers_collection.count_documents({"_id": paper_obj_id}) > 0
        if not paper_exists:
            return jsonify({"error": "Paper not found"}), 404

        data = request.get_json()
        vote_type = data.get('voteType')

        if vote_type not in ['up', 'none']:
            return jsonify({"error": "Invalid vote type. Must be 'up' or 'none'."}), 400

        existing_vote = user_votes_collection.find_one({"userId": user_obj_id, "paperId": paper_obj_id})

        updated_paper = None

        if vote_type == 'up':
            if not existing_vote:
                user_votes_collection.insert_one({
                    "userId": user_obj_id,
                    "paperId": paper_obj_id,
                    "createdAt": datetime.utcnow()
                })
                updated_paper = papers_collection.find_one_and_update(
                    {"_id": paper_obj_id},
                    {"$inc": {"upvoteCount": 1}},
                    return_document=ReturnDocument.AFTER
                )
                print(f"User {user_id_str} upvoted paper {paper_id}")
            else:
                updated_paper = papers_collection.find_one({"_id": paper_obj_id})
                print(f"User {user_id_str} tried to upvote paper {paper_id} again.")

        elif vote_type == 'none':
            if existing_vote:
                user_votes_collection.delete_one({"_id": existing_vote["_id"]})
                updated_paper = papers_collection.find_one_and_update(
                    {"_id": paper_obj_id},
                    {"$inc": {"upvoteCount": -1}},
                    return_document=ReturnDocument.AFTER
                )
                if updated_paper and updated_paper.get("upvoteCount", 0) < 0:
                    papers_collection.update_one({"_id": paper_obj_id}, {"$set": {"upvoteCount": 0}})
                    updated_paper["upvoteCount"] = 0
                print(f"User {user_id_str} removed vote from paper {paper_id}")
            else:
                updated_paper = papers_collection.find_one({"_id": paper_obj_id})
                print(f"User {user_id_str} tried to remove non-existent vote from paper {paper_id}.")

        if updated_paper:
            return jsonify(transform_paper(updated_paper, user_id_str))
        else:
            return jsonify({"error": "Failed to update paper vote status"}), 500

    except Exception as e:
        print(f"Error voting on paper {paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during voting"}), 500


@app.route('/api/papers/<string:paper_id>/flag_implementability', methods=['POST'])
@limiter.limit("30 per minute")
@login_required
@csrf.exempt
def flag_paper_implementability(paper_id):
    try:
        user_id_str = session['user'].get('id')
        if not user_id_str: return jsonify({"error": "User ID not found in session"}), 401

        try:
            user_obj_id = ObjectId(user_id_str)
            paper_obj_id = ObjectId(paper_id)
        except InvalidId: return jsonify({"error": "Invalid paper or user ID format"}), 400

        data = request.get_json()
        # Action still expected as 'confirm' (thumbs up) or 'dispute' (thumbs down) from frontend mapping
        action = data.get('action')

        # Allow 'flag' as initial action (maps to confirm)
        if action not in ['flag', 'confirm', 'dispute', 'retract']:
            return jsonify({"error": "Invalid action type. Must map to 'confirm', 'dispute', or 'retract'."}), 400

        paper = papers_collection.find_one({"_id": paper_obj_id})
        if not paper: return jsonify({"error": "Paper not found"}), 404

        # Prevent voting if owner already confirmed
        if paper.get("nonImplementableStatus") == "confirmed_non_implementable":
             return jsonify({"error": "Implementability status already confirmed by owner."}), 400

        vote_type = None
        update = {"$set": {}} # Initialize $set
        increment = {}
        new_status = paper.get("nonImplementableStatus", "implementable")
        needs_status_check = False

        existing_vote = paper_status_votes_collection.find_one({
            "userId": user_obj_id, "paperId": paper_obj_id
        })
        current_vote_type = existing_vote.get("voteType") if existing_vote else None

        if action == 'retract':
            if not existing_vote:
                return jsonify({"error": "No existing vote to retract."}), 400

            delete_result = paper_status_votes_collection.delete_one({"_id": existing_vote["_id"]})
            if delete_result.deleted_count == 1:
                if current_vote_type == 'confirm_non_implementable':
                    increment["nonImplementableVotes"] = -1
                elif current_vote_type == 'dispute_non_implementable':
                    increment["disputeImplementableVotes"] = -1
                needs_status_check = True
                print(f"User {user_id_str} retracted {current_vote_type} vote for paper {paper_id}")
            else:
                 return jsonify({"error": "Failed to retract vote."}), 500

        elif action in ['flag', 'confirm']: # Thumbs Up
            vote_type = 'confirm_non_implementable'
            if current_vote_type == vote_type:
                return jsonify({"error": "You have already voted thumbs up (confirm non-implementability)."}), 400

            if existing_vote: # Switching vote from dispute to confirm
                paper_status_votes_collection.update_one(
                    {"_id": existing_vote["_id"]},
                    {"$set": {"voteType": vote_type, "createdAt": datetime.utcnow()}}
                )
                increment["nonImplementableVotes"] = 1
                increment["disputeImplementableVotes"] = -1
                print(f"User {user_id_str} switched vote to confirm (up) for paper {paper_id}")
            else: # New confirm vote
                try:
                    paper_status_votes_collection.insert_one({
                        "userId": user_obj_id, "paperId": paper_obj_id,
                        "voteType": vote_type, "createdAt": datetime.utcnow()
                    })
                    increment["nonImplementableVotes"] = 1
                    print(f"User {user_id_str} voted confirm (up) for paper {paper_id}")
                except DuplicateKeyError:
                     return jsonify({"error": "Vote already exists (concurrent request?)."}), 409

            # If it was previously 'implementable', flag it now
            if paper.get("nonImplementableStatus", "implementable") == "implementable":
                update["$set"]["nonImplementableStatus"] = "flagged_non_implementable"
                if not paper.get("nonImplementableFlaggedBy"):
                     update["$set"]["nonImplementableFlaggedBy"] = user_obj_id
                new_status = "flagged_non_implementable"
                print(f"Paper {paper_id} status changed to flagged_non_implementable")

            needs_status_check = True

        elif action == 'dispute': # Thumbs Down
            vote_type = 'dispute_non_implementable'
            if current_vote_type == vote_type:
                return jsonify({"error": "You have already voted thumbs down (dispute non-implementability)."}), 400

            # Can only dispute if it's currently flagged
            if paper.get("nonImplementableStatus") != "flagged_non_implementable":
                 return jsonify({"error": "Paper is not currently flagged as non-implementable."}), 400

            if existing_vote: # Switching vote from confirm to dispute
                paper_status_votes_collection.update_one(
                    {"_id": existing_vote["_id"]},
                    {"$set": {"voteType": vote_type, "createdAt": datetime.utcnow()}}
                )
                increment["nonImplementableVotes"] = -1
                increment["disputeImplementableVotes"] = 1
                print(f"User {user_id_str} switched vote to dispute (down) for paper {paper_id}")
            else: # New dispute vote
                 try:
                     paper_status_votes_collection.insert_one({
                         "userId": user_obj_id, "paperId": paper_obj_id,
                         "voteType": vote_type, "createdAt": datetime.utcnow()
                     })
                     increment["disputeImplementableVotes"] = 1
                     print(f"User {user_id_str} voted dispute (down) for paper {paper_id}")
                 except DuplicateKeyError:
                      return jsonify({"error": "Vote already exists (concurrent request?)."}), 409

            needs_status_check = True

        # Apply increments and potential status set
        if increment:
            update["$inc"] = increment
        # Ensure update has $set if it's empty, otherwise Mongo complains
        if not update["$set"]:
             del update["$set"]

        if update:
            updated_paper_doc = papers_collection.find_one_and_update(
                {"_id": paper_obj_id},
                update,
                return_document=ReturnDocument.AFTER
            )
            if not updated_paper_doc:
                 print(f"Error: Failed to apply update to paper {paper_id} after voting.")
                 return jsonify({"error": "Failed to update paper after voting."}), 500
            paper = updated_paper_doc
            new_status = paper.get("nonImplementableStatus")
        else:
             paper = papers_collection.find_one({"_id": paper_obj_id})


        # --- Check Thresholds ---
        final_status_update = {}
        if needs_status_check and new_status == "flagged_non_implementable":
            confirm_votes = paper.get("nonImplementableVotes", 0)
            dispute_votes = paper.get("disputeImplementableVotes", 0)

            print(f"Checking thresholds for paper {paper_id}: Confirm(Up)={confirm_votes}, Dispute(Down)={dispute_votes}")

            # Condition to confirm non-implementability by community
            if confirm_votes >= dispute_votes + NON_IMPLEMENTABLE_CONFIRM_THRESHOLD:
                final_status_update["$set"] = {
                    "isImplementable": False,
                    "nonImplementableStatus": "confirmed_non_implementable",
                    "status": STATUS_CONFIRMED_NON_IMPLEMENTABLE, # <-- Update main status
                    "nonImplementableConfirmedBy": "community" # <-- Set confirmation source
                }
                print(f"Paper {paper_id} confirmed non-implementable by community vote threshold.")

            # Condition to revert back to implementable
            elif dispute_votes >= confirm_votes:
                 final_status_update["$set"] = {
                     "isImplementable": True,
                     "nonImplementableStatus": "implementable",
                     "status": STATUS_NOT_STARTED # <-- Reset main status
                 }
                 final_status_update["$unset"] = {
                     "nonImplementableVotes": "",
                     "disputeImplementableVotes": "",
                     "nonImplementableFlaggedBy": "",
                     "nonImplementableConfirmedBy": "" # <-- Clear confirmation source
                 }
                 paper_status_votes_collection.delete_many({"paperId": paper_obj_id})
                 print(f"Paper {paper_id} reverted to implementable by vote threshold.")


        # Apply final status update if threshold met
        if final_status_update:
             updated_paper = papers_collection.find_one_and_update(
                 {"_id": paper_obj_id},
                 final_status_update,
                 return_document=ReturnDocument.AFTER
             )
        else:
             updated_paper = paper


        if updated_paper:
            return jsonify(transform_paper(updated_paper, user_id_str))
        else:
            # Fallback fetch
            final_paper_doc = papers_collection.find_one({"_id": paper_obj_id})
            if final_paper_doc:
                 return jsonify(transform_paper(final_paper_doc, user_id_str))
            else:
                 return jsonify({"error": "Failed to retrieve final paper status."}), 500


    except Exception as e:
        print(f"Error flagging/voting implementability for paper {paper_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during implementability voting"}), 500


# --- NEW: Owner-Only Endpoint to Force Set Implementability ---
@app.route('/api/papers/<string:paper_id>/set_implementability', methods=['POST'])
@limiter.limit("30 per minute")
@login_required
@owner_required
@csrf.exempt
def set_paper_implementability(paper_id):
    try:
        user_id_str = session['user'].get('id')
        try:
            paper_obj_id = ObjectId(paper_id)
        except InvalidId:
            return jsonify({"error": "Invalid paper ID format"}), 400

        data = request.get_json()
        set_implementable = data.get('isImplementable')

        if not isinstance(set_implementable, bool):
            return jsonify({"error": "Invalid value for isImplementable. Must be true or false."}), 400

        update = { "$set": {}, "$unset": {} } # Initialize

        if set_implementable: # Owner sets to Implementable
            update["$set"] = {
                "isImplementable": True,
                "nonImplementableStatus": "implementable",
                "status": STATUS_NOT_STARTED # <-- Reset main status
            }
            update["$unset"] = {
                "nonImplementableVotes": "",
                "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": "",
                "nonImplementableConfirmedBy": "" # <-- Clear confirmation source
            }
            print(f"Owner setting paper {paper_id} to IMPLEMENTABLE.")
        else: # Owner sets to Non-Implementable
            update["$set"] = {
                "isImplementable": False,
                "nonImplementableStatus": "confirmed_non_implementable",
                "status": STATUS_CONFIRMED_NON_IMPLEMENTABLE, # <-- Set main status
                "nonImplementableConfirmedBy": "owner" # <-- Set confirmation source
            }
            update["$unset"] = {
                "nonImplementableVotes": "",
                "disputeImplementableVotes": "",
                "nonImplementableFlaggedBy": ""
                # Keep nonImplementableConfirmedBy = 'owner'
            }
            print(f"Owner setting paper {paper_id} to NON-IMPLEMENTABLE.")

        # Clean up empty $set or $unset
        if not update["$set"]: del update["$set"]
        if not update["$unset"]: del update["$unset"]

        # Delete any existing status votes for this paper regardless of action
        delete_result = paper_status_votes_collection.delete_many({"paperId": paper_obj_id})
        print(f"Owner action: Deleted {delete_result.deleted_count} status votes for paper {paper_id}.")

        updated_paper = papers_collection.find_one_and_update(
            {"_id": paper_obj_id},
            update,
            return_document=ReturnDocument.AFTER
        )

        if updated_paper:
            print(f"Owner set implementability for paper {paper_id} to {set_implementable}")
            return jsonify(transform_paper(updated_paper, user_id_str))
        else:
            if papers_collection.count_documents({"_id": paper_obj_id}) == 0:
                 return jsonify({"error": "Paper not found"}), 404
            else:
                 return jsonify({"error": "Failed to update paper implementability status"}), 500

    except Exception as e:
        print(f"Error setting implementability for paper {paper_id} by owner: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred during owner action"}), 500


@app.route('/api/papers/<string:paper_id>', methods=['DELETE'])
@limiter.limit("30 per minute")
@login_required
@owner_required
@csrf.exempt
def remove_paper(paper_id):
    try:
        try: obj_id = ObjectId(paper_id)
        except InvalidId: return jsonify({"error": "Invalid paper ID format"}), 400

        paper_to_remove = papers_collection.find_one({"_id": obj_id})
        if not paper_to_remove: return jsonify({"error": "Paper not found"}), 404

        # --- Move to removed collection ---
        removed_doc = paper_to_remove.copy()
        # ... (rest of removed_doc setup) ...
        removed_doc["original_id"] = removed_doc.pop("_id")
        removed_doc["removedAt"] = datetime.utcnow()
        removed_doc["removedBy"] = {"userId": session['user'].get('id'), "username": session['user'].get('username')}
        if "pwc_url" in removed_doc: removed_doc["original_pwc_url"] = removed_doc["pwc_url"]
        insert_result = removed_papers_collection.insert_one(removed_doc)
        print(f"Paper {paper_id} moved to removed_papers collection with new ID {insert_result.inserted_id}")

        # --- Clean up related data ---
        # Delete general votes
        vote_delete_result = user_votes_collection.delete_many({"paperId": obj_id})
        print(f"Removed {vote_delete_result.deleted_count} general votes for deleted paper {paper_id}")
        # Delete status votes
        status_vote_delete_result = paper_status_votes_collection.delete_many({"paperId": obj_id})
        print(f"Removed {status_vote_delete_result.deleted_count} status votes for deleted paper {paper_id}")

        # --- Delete from main collection ---
        delete_result = papers_collection.delete_one({"_id": obj_id})
        if delete_result.deleted_count == 1:
            print(f"Paper {paper_id} successfully deleted from main collection.")
            return jsonify({"message": "Paper removed successfully"}), 200
        else:
            print(f"Warning: Paper {paper_id} deletion failed (count={delete_result.deleted_count}). Moved to removed_papers.")
            # Status 207 might be appropriate if cleanup happened but delete failed
            return jsonify({"error": "Paper removed but encountered issue during final cleanup"}), 207
    except Exception as e:
        print(f"Error removing paper {paper_id}: {e}")
        traceback.print_exc() # Add traceback
        return jsonify({"error": "An internal server error occurred during paper removal"}), 500


# --- Authentication Endpoints ---
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_USER_URL = "https://api.github.com/user"
GITHUB_SCOPE = "read:user"
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

@app.route('/api/auth/github/login')
@limiter.limit("10 per minute")
def github_login():
    state = str(uuid.uuid4())
    session['oauth_state'] = state
    auth_url = ( f"{GITHUB_AUTHORIZE_URL}?"
                 f"client_id={GITHUB_CLIENT_ID}&"
                 f"redirect_uri={url_for('github_callback', _external=True)}&"
                 f"scope={GITHUB_SCOPE}&" f"state={state}" )
    return redirect(auth_url)

@app.route('/api/auth/github/callback')
@limiter.limit("20 per minute")
def github_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    expected_state = session.pop('oauth_state', None)
    if not expected_state or state != expected_state:
        print("Error: Invalid OAuth state")
        return redirect(f"{FRONTEND_URL}/?login_error=state_mismatch")
    if not code:
        print("Error: No code provided by GitHub")
        return redirect(f"{FRONTEND_URL}/?login_error=no_code")
    try:
        token_response = requests.post(
            GITHUB_ACCESS_TOKEN_URL, headers={'Accept': 'application/json'},
            data={ 'client_id': GITHUB_CLIENT_ID, 'client_secret': GITHUB_CLIENT_SECRET,
                   'code': code, 'redirect_uri': url_for('github_callback', _external=True)},
            timeout=10 )
        token_response.raise_for_status()
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        if not access_token:
            print(f"Error getting access token: {token_data.get('error_description', 'No access token')}")
            return redirect(f"{FRONTEND_URL}/?login_error=token_exchange_failed")
    except requests.exceptions.RequestException as e:
        print(f"Error requesting access token: {e}")
        return redirect(f"{FRONTEND_URL}/?login_error=token_request_error")
    try:
        user_response = requests.get(
            GITHUB_API_USER_URL, headers={'Authorization': f'token {access_token}',
                                          'Accept': 'application/vnd.github.v3+json'}, timeout=10 )
        user_response.raise_for_status()
        user_data = user_response.json()
        github_id = user_data.get('id')
        if not github_id:
             print("Error: GitHub user data missing ID")
             return redirect(f"{FRONTEND_URL}/?login_error=github_id_missing")
        try:
            user_doc = users_collection.find_one_and_update(
                {'githubId': github_id},
                {'$set': { 'username': user_data.get('login'), 'avatarUrl': user_data.get('avatar_url'),
                           'name': user_data.get('name'), 'email': user_data.get('email'),
                           'lastLogin': datetime.utcnow() },
                 '$setOnInsert': { 'githubId': github_id, 'createdAt': datetime.utcnow() }},
                upsert=True, return_document=ReturnDocument.AFTER )
            user_internal_id = str(user_doc['_id'])
            print(f"User '{user_doc['username']}' (ID: {user_internal_id}) upserted into DB.")
        except Exception as db_error:
            print(f"Error upserting user into MongoDB: {db_error}")
            return redirect(f"{FRONTEND_URL}/?login_error=db_upsert_failed")
        session['user'] = { 'id': user_internal_id, 'githubId': github_id,
                            'username': user_doc.get('username'), 'avatarUrl': user_doc.get('avatarUrl'),
                            'name': user_doc.get('name') }
        print(f"User '{user_doc.get('username')}' session created.")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching user info from GitHub: {e}")
        return redirect(f"{FRONTEND_URL}/?login_error=user_fetch_failed")
    except Exception as e:
        print(f"An unexpected error occurred during GitHub callback: {e}")
        return redirect(f"{FRONTEND_URL}/?login_error=unknown")
    return redirect(FRONTEND_URL)

@app.route('/api/auth/me')
@limiter.limit("20 per minute")
@login_required
def get_current_user():
    user = session.get('user')
    if user:
        owner_username = os.getenv('OWNER_GITHUB_USERNAME')
        is_owner = owner_username is not None and user.get('username') == owner_username
        user_info = user.copy()
        user_info['isOwner'] = is_owner
        return jsonify(user_info)
    else:
        return jsonify({"error": "Not authenticated"}), 401

@app.route('/api/auth/logout', methods=['POST'])
@limiter.limit("10 per minute")
@login_required
@csrf.exempt
def logout():
    user = session.pop('user', None)
    if user: print(f"User '{user.get('username')}' logged out.")
    else: print("Logout called but no user was in session.")
    return jsonify({"message": "Logged out successfully"})

# --- Custom Error Handler for Rate Limits ---
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify(error="Rate limit exceeded", description=str(e.description)), 429

# --- Run the App ---
if __name__ == '__main__':
    from waitress import serve
    print("Starting server with Waitress on http://0.0.0.0:5000")
    serve(app, host='0.0.0.0', port=5000)
    # app.run(host='0.0.0.0', port=5000, debug=False) # Keep debug=False