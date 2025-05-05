from functools import wraps
from flask import jsonify, session
from bson import ObjectId
from bson.errors import InvalidId
import traceback
import os # Import os for environment variables

# Assuming db access functions are in app.db
from ..db import get_users_collection

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Authentication required"}), 401
        # Optional: Add check if user ID in session is valid in DB
        # This might be better handled in a before_request hook
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Checks if the logged-in user has admin privileges by checking the DB."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session or 'id' not in session['user']:
            return jsonify({"error": "Authentication required"}), 401
        try:
            user_id = ObjectId(session['user']['id'])
            users_collection = get_users_collection()
            user_doc = users_collection.find_one({"_id": user_id}, {"isAdmin": 1}) # Only fetch isAdmin field

            if not user_doc:
                session.pop('user', None) # Clear invalid session
                return jsonify({"error": "User not found"}), 401
            if not user_doc.get('isAdmin', False):
                return jsonify({"error": "Forbidden: Admin privileges required"}), 403

        except InvalidId:
             session.pop('user', None) # Clear invalid session
             return jsonify({"error": "Invalid user ID in session"}), 401
        except Exception as e:
             print(f"Error checking admin status for user {session['user'].get('id', 'N/A')}: {e}")
             traceback.print_exc()
             return jsonify({"error": "Error verifying admin status"}), 500
        return f(*args, **kwargs)
    return decorated_function

# Add owner_required decorator
def owner_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Authentication required"}), 401

        # Fetch owner username from config (assuming it's loaded into app.config)
        from flask import current_app
        owner_username = current_app.config.get('OWNER_GITHUB_USERNAME')

        if not owner_username:
            current_app.logger.warning("OWNER_GITHUB_USERNAME not set in environment/config.")
            return jsonify({"error": "Server configuration error: Owner not defined"}), 500

        if session['user'].get('username') != owner_username:
            return jsonify({"error": "Forbidden: Owner privileges required"}), 403
        return f(*args, **kwargs)
    return decorated_function