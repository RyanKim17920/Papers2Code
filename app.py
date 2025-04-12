# app.py
import os
import re
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId  # For converting string ID to ObjectId
from bson.errors import InvalidId # For handling invalid ID formats
from dotenv import load_dotenv
from datetime import datetime # For date formatting

load_dotenv()  # Load environment variables from .env file

app = Flask(__name__)

# --- Configuration ---
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    raise ValueError("No MONGO_URI found in environment variables. Did you create a .env file?")

# Enable CORS for requests from your React app's origin
# Replace 'http://localhost:5173' with your frontend's actual origin if different
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

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

# --- Run the App ---
if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your network if needed
    # Debug=True is helpful during development but should be False in production
    app.run(host='0.0.0.0', port=5000, debug=True)