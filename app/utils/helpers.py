from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
import traceback
from flask import current_app

# Assuming db access functions are in app.db
from ..db import get_user_actions_collection, get_papers_collection

# Define status constants (can also be imported from config if defined there)
STATUS_NOT_STARTED = "Not Started"
STATUS_CONFIRMED_NON_IMPLEMENTABLE = "Confirmed Non-Implementable"
STATUS_IMPLEMENTABLE = "implementable" # Added
STATUS_FLAGGED = "flagged_non_implementable" # Added

def transform_paper(paper_doc, current_user_id=None):
    """Transforms a paper document from the database into the API response format."""
    if not paper_doc:
        return None

    try:
        # Default implementation steps (consider moving to config or constants file)
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
                if user_actions_collection:
                    # Find all relevant actions by this user on this paper
                    user_actions = list(user_actions_collection.find({
                        "userId": user_obj_id,
                        "paperId": paper_doc["_id"],
                        "actionType": {"$in": ['upvote', 'confirm_non_implementable', 'dispute_non_implementable']}
                    }))
                    for action_doc in user_actions:
                        action_type = action_doc.get("actionType")
                        if action_type == 'upvote':
                            current_user_vote = 'up'
                        elif action_type == 'confirm_non_implementable':
                            current_user_implementability_vote = 'up' # Map confirm -> up
                        elif action_type == 'dispute_non_implementable':
                            current_user_implementability_vote = 'down' # Map dispute -> down
            except InvalidId:
                print(f"Invalid current_user_id format: {current_user_id}") # Log error
            except Exception as e:
                print(f"Error fetching user actions for paper {paper_doc.get('_id')} and user {current_user_id}: {e}")
                traceback.print_exc()

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
            "proceeding": paper_doc.get("venue"), # Assuming venue maps to proceeding
            "tasks": paper_doc.get("tasks", []),
            # Implementability Fields (matching app_old.py's transform_paper)
            "isImplementable": paper_doc.get("is_implementable", True), # Use the snake_case field from DB
            "nonImplementableStatus": paper_doc.get("nonImplementableStatus", STATUS_IMPLEMENTABLE),
            "nonImplementableVotes": paper_doc.get("nonImplementableVotes", 0),
            "disputeImplementableVotes": paper_doc.get("disputeImplementableVotes", 0),
            "currentUserImplementabilityVote": current_user_implementability_vote,
            "nonImplementableConfirmedBy": paper_doc.get("nonImplementableConfirmedBy"),
            # General Status and Steps
            "implementationStatus": paper_doc.get("status", STATUS_NOT_STARTED),
            "implementationSteps": paper_doc.get("implementationSteps", default_steps),
            "upvoteCount": paper_doc.get("upvoteCount", 0),
            "currentUserVote": current_user_vote,
            # Add score if available (from search results)
            "searchScore": paper_doc.get("searchScore")
        }
    except Exception as e:
        print(f"Error transforming paper {paper_doc.get('_id', 'N/A')}: {e}")
        traceback.print_exc()
        return None # Return None on error to allow filtering

# --- Add Helper for updating vote counts --- (from app_old.py, adapted)
def _update_paper_vote_counts(paper_id_obj, action_type, increment):
    """Helper to increment/decrement vote counts on the paper document."""
    papers_collection = get_papers_collection()
    if not papers_collection:
        current_app.logger.error("Cannot update vote counts: Papers collection not available.")
        return False # Indicate failure

    update_field = None
    if action_type == 'upvote':
        update_field = "upvoteCount"
    elif action_type == 'confirm_non_implementable':
        update_field = "nonImplementableVotes"
    elif action_type == 'dispute_non_implementable':
        update_field = "disputeImplementableVotes"
    # Add more action types if needed

    if update_field:
        try:
            result = papers_collection.update_one(
                {"_id": paper_id_obj},
                {"$inc": {update_field: increment}}
            )
            if result.matched_count == 0:
                current_app.logger.warning(f"Attempted to update vote count for non-existent paper: {paper_id_obj}")
                return False
            # Optional: Ensure count doesn't go below zero
            # papers_collection.update_one({"_id": paper_id_obj, update_field: {"$lt": 0}}, {"$set": {update_field: 0}})
            return True # Indicate success
        except Exception as e:
            current_app.logger.error(f"Error updating {update_field} for paper {paper_id_obj}: {e}")
            traceback.print_exc()
            return False # Indicate failure
    else:
        current_app.logger.warning(f"Unsupported action_type for vote count update: {action_type}")
        return False