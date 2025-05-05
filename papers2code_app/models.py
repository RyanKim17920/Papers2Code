from .extensions import mongo
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from flask import session, current_app # Needed for transform_paper

def get_papers_collection():
    """Returns the 'papers_without_code' collection from the current app context's database."""
    return mongo.db.papers_without_code

def get_users_collection():
    """Returns the 'users' collection from the current app context's database."""
    return mongo.db.users

def get_removed_papers_collection():
    """Returns the 'removed_papers' collection from the current app context's database."""
    return mongo.db.removed_papers

def get_user_actions_collection():
    """Returns the 'user_actions' collection from the current app context's database."""
    return mongo.db.user_actions

# --- Helper Function ---
def transform_paper(paper_doc, current_user_id=None):
    # ... (Keep the exact implementation from app_old.py) ...
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
    current_user_implementability_vote = 'none'
    if current_user_id:
        try:
            user_obj_id = ObjectId(current_user_id)
            user_actions_collection = get_user_actions_collection()
            # Find all actions by this user on this paper
            user_actions = list(user_actions_collection.find({
                "userId": user_obj_id,
                "paperId": paper_doc["_id"]
            }))
            for action_doc in user_actions:
                action_type = action_doc.get("actionType")
                if action_type == 'upvote':
                    current_user_vote = 'up'
                elif action_type == 'confirm_non_implementable':
                    current_user_implementability_vote = 'up' # Map confirm -> up
                elif action_type == 'dispute_non_implementable':
                    current_user_implementability_vote = 'down' # Map dispute -> down
                # Add more elif for future action types if needed
        except InvalidId:
            print(f"Warning: Invalid current_user_id '{current_user_id}' passed to transform_paper for paper {paper_doc.get('_id')}")
        except Exception as e:
            print(f"Error fetching user actions in transform_paper for user {current_user_id}, paper {paper_doc.get('_id')}: {e}")

    # Import status constants dynamically or pass them if needed
    # For simplicity here, hardcoding, but ideally get from config
    STATUS_NOT_STARTED = "Not Started"

    return {
        "id": str(paper_doc["_id"]),
        "pwcUrl": paper_doc.get("pwc_url"),
        "arxivId": paper_doc.get("arxiv_id"),
        "title": paper_doc.get("title"),
        "abstract": paper_doc.get("abstract"),
        "authors": authors_list,
        "urlAbs": paper_doc.get("url_abs"),
        "urlPdf": paper_doc.get("url_pdf"),
        "date": date_str,
        "proceeding": paper_doc.get("venue"),
        "tasks": paper_doc.get("tasks", []),
        # --- Implementability Fields ---
        "isImplementable": paper_doc.get("is_implementable", True),
        "nonImplementableStatus": paper_doc.get("nonImplementableStatus", "implementable"),
        "nonImplementableVotes": paper_doc.get("nonImplementableVotes", 0),
        "disputeImplementableVotes": paper_doc.get("disputeImplementableVotes", 0),
        "currentUserImplementabilityVote": current_user_implementability_vote,
        "nonImplementableConfirmedBy": paper_doc.get("nonImplementableConfirmedBy"),
        # --- End Implementability Fields ---
        "implementationStatus": paper_doc.get("status", STATUS_NOT_STARTED),
        "implementationSteps": paper_doc.get("implementationSteps", default_steps),
        "upvoteCount": paper_doc.get("upvoteCount", 0),
        "currentUserVote": current_user_vote
    }
