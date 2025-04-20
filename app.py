# app.py (Updated with Sorting for /api/papers)

import os
import re
import requests
import uuid
from flask import Flask, jsonify, request, redirect, url_for, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from pymongo import MongoClient, ReturnDocument, DESCENDING, ASCENDING
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from datetime import datetime
from functools import wraps

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
    print("Available collections:", db.list_collection_names())
    try:
        papers_collection.drop_index("title_text_abstract_text_authors_text")
        print("Dropped old text index on papers collection.")
    except Exception as e:
        print(f"Could not drop old text index (might not exist): {e}")
    papers_collection.create_index(
        [("title", "text"), ("abstract", "text"), ("authors", "text")],
        weights={"title": 10, "abstract": 5, "authors": 1},
        name="title_text_abstract_text_authors_text", background=True )
    print("Ensured text index on papers collection.")
    papers_collection.create_index([("pwc_url", 1)], unique=True, background=True)
    print("Ensured unique index on 'pwc_url' in papers collection.")
    users_collection.create_index([("githubId", 1)], unique=True, background=True)
    print("Ensured unique index on 'githubId' in users collection.")
    papers_collection.create_index([("publication_date", DESCENDING)], background=True)
    print("Ensured index on 'publication_date' in papers collection.")
    removed_papers_collection.create_index([("removedAt", DESCENDING)], background=True)
    print("Ensured index on 'removedAt' in removed_papers collection.")
    removed_papers_collection.create_index([("original_pwc_url", 1)], background=True)
    print("Ensured index on 'original_pwc_url' in removed_papers collection.")
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(f"Error connecting to MongoDB or creating indexes: {e}")
    exit()

# --- Helper Function ---
def transform_paper(paper_doc):
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
    return {
        "id": str(paper_doc["_id"]), "pwcUrl": paper_doc.get("pwc_url"),
        "arxivId": paper_doc.get("arxiv_id"), "title": paper_doc.get("title"),
        "abstract": paper_doc.get("abstract"), "authors": authors_list,
        "urlAbs": paper_doc.get("url_abs"), "urlPdf": paper_doc.get("url_pdf"),
        "date": date_str, "proceeding": paper_doc.get("venue"),
        "tasks": paper_doc.get("tasks", []), "isImplementable": paper_doc.get("is_implementable", True),
        "implementationStatus": paper_doc.get("status", "Not Started"),
        "implementationSteps": paper_doc.get("implementationSteps", default_steps),
        "upvoteCount": paper_doc.get("upvoteCount", 0)
    }

# --- API Endpoints ---

@app.route('/api/papers', methods=['GET'])
@limiter.limit("100 per minute")
def get_papers():
    try:
        limit_str = request.args.get('limit', '12')
        page_str = request.args.get('page', '1')
        search_term = request.args.get('search', '').strip()
        sort_param = request.args.get('sort', 'newest').lower()

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

        skip = (page - 1) * limit

        base_filter = {}

        papers_cursor = None

        if search_term:
            print(f"Executing AGGREGATION for search: '{search_term}'")
            query_filter = {"$text": {"$search": search_term}}
            if base_filter:
                query_filter = {"$and": [base_filter, query_filter]}
            sort_criteria = {"score": {"$meta": "textScore"}}
            pipeline = [
                {"$match": query_filter},
                {"$sort": sort_criteria},
                {"$skip": skip},
                {"$limit": limit}
            ]
            print(f"Pipeline: {pipeline}")
            papers_cursor = papers_collection.aggregate(pipeline)
        else:
            print(f"Executing FIND with sort: '{sort_param}'")
            query_filter = base_filter
            if sort_param == 'oldest':
                sort_direction = ASCENDING
                print("Sorting by publication_date ASCENDING")
            else:
                sort_direction = DESCENDING
                print("Sorting by publication_date DESCENDING")
            sort_criteria = [("publication_date", sort_direction)]
            papers_cursor = papers_collection.find(query_filter).sort(sort_criteria).skip(skip).limit(limit)

        total_count = papers_collection.count_documents(query_filter)
        total_pages = (total_count + limit - 1) // limit

        papers_list = [transform_paper(paper) for paper in papers_cursor]
        return jsonify({"papers": papers_list, "totalPages": total_pages})
    except Exception as e:
        print(f"Error in /api/papers: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

@app.route('/api/papers/<string:paper_id>', methods=['GET'])
@limiter.limit("100 per minute")
def get_paper_by_id(paper_id):
    try:
        try: obj_id = ObjectId(paper_id)
        except InvalidId: return jsonify({"error": "Invalid paper ID format"}), 400
        paper_doc = papers_collection.find_one({"_id": obj_id})
        if paper_doc: return jsonify(transform_paper(paper_doc))
        else: return jsonify({"error": "Paper not found"}), 404
    except Exception as e:
        print(f"Error in /api/papers/{paper_id}: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500

@app.route('/api/papers/<string:paper_id>', methods=['DELETE'])
@limiter.limit("30 per minute")
@login_required
@owner_required
@csrf.exempt
def remove_paper(paper_id):
    try:
        try:
            obj_id = ObjectId(paper_id)
        except InvalidId:
            return jsonify({"error": "Invalid paper ID format"}), 400

        paper_to_remove = papers_collection.find_one({"_id": obj_id})
        if not paper_to_remove:
            return jsonify({"error": "Paper not found"}), 404

        removed_doc = paper_to_remove.copy()
        removed_doc["original_id"] = removed_doc.pop("_id")
        removed_doc["removedAt"] = datetime.utcnow()
        removed_doc["removedBy"] = {
            "userId": session['user'].get('id'),
            "username": session['user'].get('username')
        }
        if "pwc_url" in removed_doc:
             removed_doc["original_pwc_url"] = removed_doc["pwc_url"]

        insert_result = removed_papers_collection.insert_one(removed_doc)
        print(f"Paper {paper_id} moved to removed_papers collection with new ID {insert_result.inserted_id}")

        delete_result = papers_collection.delete_one({"_id": obj_id})
        if delete_result.deleted_count == 1:
            print(f"Paper {paper_id} successfully deleted from main collection.")
            return jsonify({"message": "Paper removed successfully"}), 200
        else:
            print(f"Warning: Paper {paper_id} was found but deletion failed (deleted_count={delete_result.deleted_count}). It was already moved to removed_papers.")
            return jsonify({"error": "Paper removed but encountered issue during final cleanup"}), 207

    except Exception as e:
        print(f"Error removing paper {paper_id}: {e}")
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
    app.run(host='0.0.0.0', port=5000, debug=False)