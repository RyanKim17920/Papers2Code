from functools import wraps
from flask import session, jsonify, current_app
import os # Keep os import if needed for OWNER_GITHUB_USERNAME directly

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

def owner_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Authentication required"}), 401
        # Access OWNER_GITHUB_USERNAME from Flask app config
        owner_username = current_app.config.get('OWNER_GITHUB_USERNAME')
        if not owner_username:
            print("Warning: OWNER_GITHUB_USERNAME not set in Flask app config.")
            return jsonify({"error": "Server configuration error: Owner not defined"}), 500
        if session['user'].get('username') != owner_username:
            return jsonify({"error": "Forbidden: Owner privileges required"}), 403
        return f(*args, **kwargs)
    return decorated_function
