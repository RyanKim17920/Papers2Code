from flask import Blueprint, request, jsonify, session, redirect, url_for, current_app
import requests
from datetime import datetime, timezone
from urllib.parse import urlencode

# Assuming db access functions are in app.db
from ..db import get_users_collection
from ..utils.decorators import login_required # Import decorator

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login')
def login():
    """Redirects the user to GitHub for authentication."""
    github_authorize_url = current_app.config['GITHUB_AUTHORIZE_URL']
    client_id = current_app.config['GITHUB_CLIENT_ID']
    scope = current_app.config['GITHUB_SCOPE']
    # Consider adding a state parameter for CSRF protection
    params = {'client_id': client_id, 'scope': scope}
    return redirect(f"{github_authorize_url}?{urlencode(params)}")

@auth_bp.route('/callback')
def callback():
    """Handles the callback from GitHub after authentication."""
    code = request.args.get('code')
    if not code:
        return jsonify({"error": "Authorization code not provided"}), 400

    # Exchange code for access token
    token_url = current_app.config['GITHUB_ACCESS_TOKEN_URL']
    client_id = current_app.config['GITHUB_CLIENT_ID']
    client_secret = current_app.config['GITHUB_CLIENT_SECRET']
    token_payload = {
        'client_id': client_id,
        'client_secret': client_secret,
        'code': code
    }
    headers = {'Accept': 'application/json'}
    token_r = requests.post(token_url, json=token_payload, headers=headers)
    token_data = token_r.json()

    if 'error' in token_data or 'access_token' not in token_data:
        current_app.logger.error(f"GitHub token exchange failed: {token_data}")
        return jsonify({"error": "Failed to obtain access token from GitHub"}), 500

    access_token = token_data['access_token']

    # Fetch user info from GitHub API
    user_api_url = current_app.config['GITHUB_API_USER_URL']
    user_headers = {'Authorization': f'token {access_token}', 'Accept': 'application/json'}
    user_r = requests.get(user_api_url, headers=user_headers)
    user_info = user_r.json()

    if user_r.status_code != 200 or 'id' not in user_info:
        current_app.logger.error(f"Failed to fetch user info from GitHub: {user_info}")
        return jsonify({"error": "Failed to fetch user info from GitHub"}), 500

    # --- User Upsert Logic ---
    users_collection = get_users_collection()
    github_id = user_info['id']
    username = user_info['login']
    avatar_url = user_info.get('avatar_url')
    profile_url = user_info.get('html_url')
    now = datetime.now(timezone.utc)

    # Check if user is the owner
    is_owner = username == current_app.config.get('OWNER_GITHUB_USERNAME')

    update_data = {
        '$set': {
            'username': username,
            'avatarUrl': avatar_url,
            'profileUrl': profile_url,
            'lastLogin': now,
            # Set isAdmin based on owner status ONLY if not already set
            # Or explicitly manage admin status elsewhere
            # 'isAdmin': is_owner # Be careful with automatically granting admin
        },
        '$setOnInsert': {
            'githubId': github_id,
            'firstLogin': now,
            'isAdmin': is_owner # Grant admin on first login if owner
        }
    }

    try:
        result = users_collection.update_one(
            {'githubId': github_id},
            update_data,
            upsert=True
        )

        user_id = None
        if result.upserted_id:
            user_id = result.upserted_id
            current_app.logger.info(f"New user created: {username} (ID: {user_id})")
        else:
            # Find the existing user's _id
            user_doc = users_collection.find_one({'githubId': github_id}, {'_id': 1})
            if user_doc:
                user_id = user_doc['_id']
            else: # Should not happen with upsert=True, but handle defensively
                 current_app.logger.error(f"Could not find user {username} after update operation.")
                 return jsonify({"error": "User login process failed internally"}), 500

        # --- Session Management ---
        session['user'] = {
            'id': str(user_id), # Store MongoDB ObjectId as string
            'githubId': github_id,
            'username': username,
            'avatarUrl': avatar_url
            # Avoid storing sensitive info like access_token in session if not needed client-side
        }
        session.permanent = True # Use persistent sessions

        # Redirect to frontend
        frontend_url = current_app.config.get('FRONTEND_URL', '/')
        return redirect(frontend_url)

    except Exception as e:
        current_app.logger.error(f"Database error during user upsert for {username}: {e}")
        return jsonify({"error": "Database error during login"}), 500


@auth_bp.route('/logout')
def logout():
    """Logs the user out by clearing the session."""
    session.pop('user', None)
    return jsonify({"message": "Logged out successfully"})

@auth_bp.route('/status')
def status():
    """Returns the current logged-in user's status, including owner status."""
    if 'user' not in session:
        return jsonify({"isAuthenticated": False, "user": None})

    user_data = session['user']
    is_admin = False # Default
    is_owner = False # Default

    # Fetch fresh admin/owner status from DB for accuracy
    try:
        from bson import ObjectId
        from bson.errors import InvalidId
        users_collection = get_users_collection()
        user_doc = users_collection.find_one({"_id": ObjectId(user_data['id'])}, {"isAdmin": 1, "username": 1})
        if user_doc:
            is_admin = user_doc.get('isAdmin', False)
            # Check owner status based on config
            owner_username = current_app.config.get('OWNER_GITHUB_USERNAME')
            if owner_username and user_doc.get('username') == owner_username:
                is_owner = True
        else:
            # User in session but not DB? Clear session (handled by before_request, but double-check)
            session.pop('user', None)
            return jsonify({"isAuthenticated": False, "user": None})

    except InvalidId:
        current_app.logger.error(f"Invalid user ID format in session: {user_data.get('id')}")
        session.pop('user', None)
        return jsonify({"isAuthenticated": False, "user": None})
    except Exception as e:
        current_app.logger.error(f"Error fetching user status for user {user_data.get('id')}: {e}")
        is_admin = False
        is_owner = False

    return jsonify({
        "isAuthenticated": True,
        "user": {
            "id": user_data.get('id'), # Include internal ID
            "githubId": user_data.get('githubId'),
            "username": user_data.get('username'),
            "avatarUrl": user_data.get('avatarUrl'),
            "isAdmin": is_admin, # Include admin status from DB
            "isOwner": is_owner # Include owner status
        }
    })