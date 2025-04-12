import os
import re
import requests # <-- Import requests
import uuid # <-- Import uuid for state generation
from flask import Flask, jsonify, request, redirect, url_for, session # <-- Add redirect, url_for, session
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = Flask(__name__)

# --- Configuration ---
MONGO_URI = os.getenv('MONGO_URI')
GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID') # <-- Load GitHub ID
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET') # <-- Load GitHub Secret
FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY') # <-- Load Flask Secret Key

if not MONGO_URI:
    raise ValueError("No MONGO_URI found")
if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
    raise ValueError("GitHub Client ID or Secret not found in .env")
if not FLASK_SECRET_KEY:
    raise ValueError("FLASK_SECRET_KEY not found in .env. Generate one.")

app.secret_key = FLASK_SECRET_KEY
# Enable CORS for requests from your React app's origin
# Replace 'http://localhost:5173' with your frontend's actual origin if different
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}}, supports_credentials=True)

# --- MongoDB Connection ---
try:
    client = MongoClient(MONGO_URI)
    # Select your database (replace 'papers_db' if different)
    db = client.get_database('papers2code')
    print("Connected to MongoDB database:", db.name)
    # Check if the database is empty (optional)
    if db.list_collection_names() == []:
        print("Database is empty. Please check your MongoDB setup.")
    else:
        print("Database is not empty. Proceeding with the application.")
        print(("Available collections:", db.list_collection_names()))
    # Select your collection (replace 'papers' if different)
    papers_collection = db.papers_without_code
    try:
        papers_collection.drop_index("title_text_abstract_text_authors_text")
    except Exception as e:
        print("Could not drop index:", e)

    # Create the text index with the desired weights
    papers_collection.create_index(
        [("title", "text"), ("abstract", "text"), ("authors", "text")],
        weights={"title": 10, "abstract": 5, "authors": 1},
        name="title_text_abstract_text_authors_text"
    )
    # Test connection
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    # Depending on policy, you might want the app to exit or handle this differently
    exit()


# --- Helper Function for Data Transformation ---
def transform_paper(paper_doc):
    """Converts MongoDB doc to the format expected by the frontend."""

    # Add default steps if not present in DB (adjust as needed)
    default_steps = [
        {"id": 1, "name": 'Contact Author', "description": 'Email first author about open-sourcing.', "status": 'pending'},
        {"id": 2, "name": 'Define Requirements', "description": 'Outline key components, data, and metrics.', "status": 'pending'},
        {"id": 3, "name": 'Implement Code', "description": 'Develop the core algorithm and experiments.', "status": 'pending'},
        {"id": 4, "name": 'Annotate & Explain (Optional)', "description": 'Add detailed code comments linking to the paper.', "status": 'pending'},
        {"id": 5, "name": 'Submit & Review', "description": 'Submit code for review and potential merging.', "status": 'pending'},
    ]

    # Convert authors array of strings to array of objects
    authors_list = [{"name": author_name} for author_name in paper_doc.get("authors", [])]

    # Format publication date (take only YYYY-MM-DD part)
    publication_date = paper_doc.get("publication_date")
    date_str = publication_date.strftime('%Y-%m-%d') if isinstance(publication_date, datetime) else str(publication_date) # Handle potential non-datetime types


    return {
        "id": str(paper_doc["_id"]), # Convert ObjectId to string
        "pwcUrl": paper_doc.get("pwc_url"),
        "arxivId": paper_doc.get("arxiv_id"),
        "title": paper_doc.get("title"),
        "abstract": paper_doc.get("abstract"),
        "authors": authors_list,
        # Map MongoDB field names to frontend names
        "urlAbs": paper_doc.get("url_abs"), # Assuming you store this, add if needed
        "urlPdf": paper_doc.get("url_pdf"), # Assuming you store this, add if needed
        "date": date_str,
        "proceeding": paper_doc.get("venue"), # Map 'venue' to 'proceeding'
        "tasks": paper_doc.get("tasks", []),
        "isImplementable": paper_doc.get("is_implementable", True), # Default to True if missing
        "implementationStatus": paper_doc.get("status", "Not Started"), # Map 'status', provide default
        # Add implementationSteps - This might need to be fetched/stored separately later
        "implementationSteps": paper_doc.get("implementationSteps", default_steps)
    }

# --- API Endpoints ---

@app.route('/api/papers', methods=['GET'])
def get_papers():
    """Fetches papers, supporting search, filtering, and limiting."""
    try:
        # Get query parameters
        limit_str = request.args.get('limit', '10')
        search_term = request.args.get('search', '').strip()  # Get search term

        try:
            limit = int(limit_str)
            if limit <= 0: 
                limit = 10  # Ensure positive limit
        except ValueError:
            return jsonify({"error": "Invalid limit parameter"}), 400

        # --- Build the MongoDB Query Filter ---
        # Keep previous base filter code.
        query_filter = {"is_implementable": True}

        if search_term:
            # Escape regex special characters in search term
            safe_search_term = re.escape(search_term)
            # Use $text search to prioritize title, abstract, and authors.
            search_filter = {"$text": {"$search": safe_search_term}}
            query_filter = {"$and": [query_filter, search_filter]}

        # --- Execute Query ---
        # Build the aggregation pipeline.
        pipeline = [{"$match": query_filter}]  # Base match stage

        if search_term:
            # Only add sorting by text score if a search term is provided.
            pipeline.append({"$sort": {"score": {"$meta": "textScore"}}})

        # Use $limit to take the top 'limit' results.
        pipeline.append({"$limit": limit})

        # Execute the aggregation pipeline.
        papers_cursor = papers_collection.aggregate(pipeline)
        papers_list = [transform_paper(paper) for paper in papers_cursor]

        return jsonify(papers_list)

    except Exception as e:
        print(f"Error in /api/papers: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500


@app.route('/api/papers/<string:paper_id>', methods=['GET'])
def get_paper_by_id(paper_id):
    """Fetches a single paper by its MongoDB _id."""
    try:
        # Convert the string ID from the URL back to ObjectId
        try:
            obj_id = ObjectId(paper_id)
        except InvalidId:
            return jsonify({"error": "Invalid paper ID format"}), 400

        paper_doc = papers_collection.find_one({"_id": obj_id})

        if paper_doc:
            return jsonify(transform_paper(paper_doc))
        else:
            return jsonify({"error": "Paper not found"}), 404

    except Exception as e:
        print(f"Error in /api/papers/{paper_id}: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500


GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_USER_URL = "https://api.github.com/user"
# Define the scope needed - read:user is basic profile info
GITHUB_SCOPE = "read:user"
# Define where frontend runs - This MUST match the actual frontend URL in production
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')


@app.route('/api/auth/github/login')
def github_login():
    """Redirects the user to GitHub for authorization."""
    state = str(uuid.uuid4()) # Generate a random state
    session['oauth_state'] = state # Store state in session for later verification

    auth_url = (
        f"{GITHUB_AUTHORIZE_URL}?"
        f"client_id={GITHUB_CLIENT_ID}&"
        f"redirect_uri={url_for('github_callback', _external=True)}&" # Use url_for for correctness
        f"scope={GITHUB_SCOPE}&"
        f"state={state}"
    )
    return redirect(auth_url)


@app.route('/api/auth/github/callback')
def github_callback():
    """Handles the callback from GitHub after user authorization."""
    code = request.args.get('code')
    state = request.args.get('state')

    # --- Security Check: Verify State ---
    expected_state = session.pop('oauth_state', None)
    if not expected_state or state != expected_state:
        print("Error: Invalid OAuth state")
        # Redirect to frontend with an error indicator (optional)
        return redirect(f"{FRONTEND_URL}/?login_error=state_mismatch")

    if not code:
        print("Error: No code provided by GitHub")
        return redirect(f"{FRONTEND_URL}/?login_error=no_code")

    # --- Exchange Code for Access Token ---
    try:
        token_response = requests.post(
            GITHUB_ACCESS_TOKEN_URL,
            headers={'Accept': 'application/json'}, # Request JSON response
            data={
                'client_id': GITHUB_CLIENT_ID,
                'client_secret': GITHUB_CLIENT_SECRET,
                'code': code,
                'redirect_uri': url_for('github_callback', _external=True),
            },
            timeout=10 # Add a timeout
        )
        token_response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        token_data = token_response.json()
        access_token = token_data.get('access_token')

        if not access_token:
            print(f"Error getting access token: {token_data.get('error_description', 'No access token')}")
            return redirect(f"{FRONTEND_URL}/?login_error=token_exchange_failed")

    except requests.exceptions.RequestException as e:
        print(f"Error requesting access token: {e}")
        return redirect(f"{FRONTEND_URL}/?login_error=token_request_error")

    # --- Fetch User Info from GitHub API ---
    try:
        user_response = requests.get(
            GITHUB_API_USER_URL,
            headers={
                'Authorization': f'token {access_token}',
                'Accept': 'application/vnd.github.v3+json',
            },
            timeout=10
        )
        user_response.raise_for_status()
        user_data = user_response.json()

        # --- Store User Info in Session ---
        # Store relevant info. Don't store the access token long-term unless needed.
        session['user'] = {
            'id': user_data.get('id'),
            'username': user_data.get('login'),
            'avatar_url': user_data.get('avatar_url'),
            'name': user_data.get('name')
        }
        print(f"User '{user_data.get('login')}' logged in successfully.")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching user info from GitHub: {e}")
        return redirect(f"{FRONTEND_URL}/?login_error=user_fetch_failed")

    # --- Redirect back to the Frontend Homepage ---
    return redirect(FRONTEND_URL) # User is now logged in via session cookie

@app.route('/api/auth/me')
def get_current_user():
    """Checks if a user is logged in via session and returns their info."""
    user = session.get('user')
    if user:
        return jsonify(user)
    else:
        # Use 401 Unauthorized if not logged in
        return jsonify({"error": "Not authenticated"}), 401

@app.route('/api/auth/logout', methods=['POST']) # Use POST for actions like logout
def logout():
    """Logs the user out by clearing the session."""
    session.pop('user', None) # Clear specific user key
    # Or session.clear() # Clear entire session
    return jsonify({"message": "Logged out successfully"})



# --- Run the App ---
if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your network if needed
    # Debug=True is helpful during development but should be False in production
    app.run(host='0.0.0.0', port=5000, debug=True)


