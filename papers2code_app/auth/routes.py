from flask import jsonify, request, redirect, url_for, session, current_app
from flask_wtf.csrf import generate_csrf
from . import auth_bp # Import the blueprint instance
from ..extensions import limiter, mongo # Import extensions
from ..models import get_users_collection # Import models
from ..utils import login_required # Import decorators
from ..config import Config # Import config

import requests
import uuid
from datetime import datetime, timezone
from pymongo import ReturnDocument
import traceback

# --- Authentication Endpoints ---

@auth_bp.route('/github/login')
@limiter.limit("10 per minute")
def github_login():
    state = str(uuid.uuid4())
    session['oauth_state'] = state
    # Use config values
    auth_url = (
        f"{Config.GITHUB_AUTHORIZE_URL}?"
        f"client_id={Config.GITHUB_CLIENT_ID}&"
        f"redirect_uri={url_for('.github_callback', _external=True)}&" # Use relative blueprint endpoint name
        f"scope={Config.GITHUB_SCOPE}&"
        f"state={state}"
    )
    return redirect(auth_url)

@auth_bp.route('/github/callback')
@limiter.limit("20 per minute")
def github_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    expected_state = session.pop('oauth_state', None)

    # Use config for frontend URL
    frontend_url = Config.FRONTEND_URL

    if not expected_state or state != expected_state:
        print("Error: Invalid OAuth state")
        return redirect(f"{frontend_url}/?login_error=state_mismatch")
    if not code:
        print("Error: No code provided by GitHub")
        return redirect(f"{frontend_url}/?login_error=no_code")

    try:
        token_response = requests.post(
            Config.GITHUB_ACCESS_TOKEN_URL,
            headers={'Accept': 'application/json'},
            data={
                'client_id': Config.GITHUB_CLIENT_ID,
                'client_secret': Config.GITHUB_CLIENT_SECRET,
                'code': code,
                'redirect_uri': url_for('.github_callback', _external=True) # Use relative blueprint endpoint name
            },
            timeout=10
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        if not access_token:
            print(f"Error getting access token: {token_data.get('error_description', 'No access token')}")
            return redirect(f"{frontend_url}/?login_error=token_exchange_failed")
    except requests.exceptions.RequestException as e:
        print(f"Error requesting access token: {e}")
        return redirect(f"{frontend_url}/?login_error=token_request_error")

    try:
        user_response = requests.get(
            Config.GITHUB_API_USER_URL,
            headers={
                'Authorization': f'token {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            },
            timeout=10
        )
        user_response.raise_for_status()
        user_data = user_response.json()
        github_id = user_data.get('id')
        if not github_id:
             print("Error: GitHub user data missing ID")
             return redirect(f"{frontend_url}/?login_error=github_id_missing")

        try:
            users_collection = get_users_collection()
            user_doc = users_collection.find_one_and_update(
                {'githubId': github_id},
                {'$set': {
                    'username': user_data.get('login'),
                    'avatarUrl': user_data.get('avatar_url'),
                    'name': user_data.get('name'),
                    'email': user_data.get('email'), # Store email if available
                    'lastLogin': datetime.now(timezone.utc)
                 },
                 '$setOnInsert': {
                    'githubId': github_id,
                    'createdAt': datetime.now(timezone.utc)
                 }},
                upsert=True,
                return_document=ReturnDocument.AFTER
            )
            user_internal_id = str(user_doc['_id'])
            print(f"User '{user_doc['username']}' (ID: {user_internal_id}) upserted into DB.")
        except Exception as db_error:
            print(f"Error upserting user into MongoDB: {db_error}")
            traceback.print_exc()
            return redirect(f"{frontend_url}/?login_error=db_upsert_failed")

        # Store relevant user info in session
        session['user'] = {
            'id': user_internal_id,
            'githubId': github_id,
            'username': user_doc.get('username'),
            'avatarUrl': user_doc.get('avatarUrl'),
            'name': user_doc.get('name')
        }
        session.permanent = True # Make session persistent
        print(f"User '{user_doc.get('username')}' session created.")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching user info from GitHub: {e}")
        return redirect(f"{frontend_url}/?login_error=user_fetch_failed")
    except Exception as e:
        print(f"An unexpected error occurred during GitHub callback: {e}")
        traceback.print_exc()
        return redirect(f"{frontend_url}/?login_error=unknown")

    return redirect(frontend_url)

@auth_bp.route('/me')
@limiter.limit("20 per minute")
@login_required
def get_current_user():
    user = session.get('user')
    if user:
        # Use config for owner username
        owner_username = Config.OWNER_GITHUB_USERNAME
        is_owner = owner_username is not None and user.get('username') == owner_username
        user_info = user.copy()
        user_info['isOwner'] = is_owner
        return jsonify(user_info)
    else:
        # This case should ideally not be reached due to @login_required
        return jsonify({"error": "Not authenticated"}), 401

@auth_bp.route('/logout', methods=['POST'])
@limiter.limit("10 per minute")
@login_required
def logout():
    user = session.pop('user', None)
    if user:
        print(f"User '{user.get('username')}' logged out.")
    else:
        print("Logout called but no user was in session.")
    return jsonify({"message": "Logged out successfully"})


@auth_bp.route('/csrf-token', methods=['GET'])
@limiter.limit("60 per minute") # Limit requests for the token itself
def get_csrf_token():
    """
    Generates and returns a CSRF token.
    The frontend should call this once (e.g., on load) and include the token
    in the 'X-CSRFToken' header for subsequent state-changing requests.
    """
    token = generate_csrf()
    return jsonify({'csrfToken': token})