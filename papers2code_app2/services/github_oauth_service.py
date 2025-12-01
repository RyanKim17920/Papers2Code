import httpx
import uuid
import secrets
import logging
from datetime import datetime, timedelta, timezone
from fastapi import Request, Response
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument

from ..database import get_users_collection_async
from ..schemas.minimal import UserSchema, UserMinimal
from ..shared import config_settings
from ..services.exceptions import (
    OAuthException,
    UserNotFoundException,
    DatabaseOperationException,
) 
from ..auth.token_utils import create_access_token, create_refresh_token
from ..constants import (
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    OAUTH_STATE_COOKIE_NAME,
    CSRF_TOKEN_COOKIE_NAME,
)

logger = logging.getLogger(__name__)

# Environment check for secure logging
_is_development = config_settings.ENV_TYPE.lower() not in ("production", "prod")

class GitHubOAuthService:
    def __init__(self):
        self.users_collection = None

    async def _init_collections(self):
        if self.users_collection is None:
            self.users_collection = await get_users_collection_async()

    def prepare_github_login_redirect(self, request: Request) -> RedirectResponse:
        """Prepares the GitHub authorization URL, state JWT, and returns a RedirectResponse with the state cookie set."""
        state_value = str(uuid.uuid4())
        state_token_payload = {"state_val": state_value, "sub": "oauth_state_marker", "exp": datetime.now(timezone.utc) + timedelta(minutes=10)}
        state_jwt = jwt.encode(state_token_payload, config_settings.FLASK_SECRET_KEY, algorithm=config_settings.ALGORITHM)

        github_authorize_url = config_settings.GITHUB.AUTHORIZE_URL
        github_client_id = config_settings.GITHUB.CLIENT_ID
        github_scope = config_settings.GITHUB.SCOPE

        if not github_client_id:
            logger.error("GITHUB.CLIENT_ID is not configured.")
            raise OAuthException(detail="Authentication service is misconfigured (GitHub Client ID not set).")

        try:
            # Construct redirect_uri properly handling reverse proxies (e.g., Render)
            # Priority: 1) API_URL from config, 2) X-Forwarded headers, 3) request.base_url
            if config_settings.API_URL and not config_settings.API_URL.startswith("http://localhost"):
                # Use configured API_URL for production
                redirect_uri = f"{config_settings.API_URL.rstrip('/')}/auth/github/callback"
            else:
                # For development or when API_URL is localhost, try to construct from headers
                forwarded_proto = request.headers.get("x-forwarded-proto", "https" if config_settings.ENV_TYPE == "production" else "http")
                forwarded_host = request.headers.get("x-forwarded-host")

                if forwarded_host:
                    # Behind a reverse proxy (e.g., Render)
                    redirect_uri = f"{forwarded_proto}://{forwarded_host}/api/auth/github/callback"
                else:
                    # Direct request or development
                    base_url = str(request.base_url).rstrip('/')
                    redirect_uri = f"{base_url}/auth/github/callback"
        except Exception as e:
            logger.error(f"Error constructing redirect_uri for GitHub OAuth: {e}")
            raise OAuthException(detail="Error preparing authentication request to GitHub.")

        auth_url = (
            f"{github_authorize_url}?"
            f"client_id={github_client_id}&"
            f"redirect_uri={redirect_uri}&"
            f"scope={github_scope}&"
            f"state={state_value}"
        )

        response = RedirectResponse(url=auth_url)
        is_production = config_settings.ENV_TYPE == "production"
        response.set_cookie(
            key=OAUTH_STATE_COOKIE_NAME,
            value=state_jwt,
            httponly=True,
            samesite="none" if is_production else "lax",
            secure=True if is_production else False,
            path="/api/auth/github/callback",
            max_age=10 * 60
        )
        return response

    async def handle_github_callback(
        self, code: str, state_from_query: str, request: Request
    ) -> RedirectResponse:
        """Handles the GitHub OAuth callback, exchanges code for token, fetches user, creates/updates user, sets cookies, and returns a RedirectResponse."""
        await self._init_collections()
        state_jwt_from_cookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
        frontend_url = config_settings.FRONTEND_URL
        oauth_state_cookie_delete_path = "/api/auth/github/callback"

        redirect_response = RedirectResponse(url=frontend_url)

        if not state_jwt_from_cookie:
            redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_delete_path, secure=True if config_settings.ENV_TYPE == "production" else False, httponly=True, samesite="lax")
            logger.warning("OAuth state cookie missing. Redirecting to frontend with error.")
            return RedirectResponse(url=f"{frontend_url}/?login_error=state_cookie_missing", status_code=307)

        try:
            payload = jwt.decode(state_jwt_from_cookie, config_settings.FLASK_SECRET_KEY, algorithms=[config_settings.ALGORITHM])
            expected_state_from_token = payload.get("state_val")
            if not expected_state_from_token or expected_state_from_token != state_from_query:
                redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_delete_path, secure=True if config_settings.ENV_TYPE == "production" else False, httponly=True, samesite="lax")
                logger.warning("OAuth state mismatch. Redirecting to frontend with error.")
                return RedirectResponse(url=f"{frontend_url}/?login_error=state_mismatch", status_code=307)
        except JWTError as jwt_exc:
            redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_delete_path, secure=True if config_settings.ENV_TYPE == "production" else False, httponly=True, samesite="lax")
            logger.warning(f"OAuth state JWT validation error: {jwt_exc}. Redirecting to frontend with error.")
            return RedirectResponse(url=f"{frontend_url}/?login_error=state_decode_error", status_code=307)
        
        redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_delete_path, secure=True if config_settings.ENV_TYPE == "production" else False, httponly=True, samesite="lax")

        github_access_token_url = config_settings.GITHUB.ACCESS_TOKEN_URL
        github_client_id = config_settings.GITHUB.CLIENT_ID
        github_client_secret = config_settings.GITHUB.CLIENT_SECRET
        github_api_user_url = config_settings.GITHUB.API_USER_URL

        if not github_client_id or not github_client_secret:
            logger.error("GitHub client ID or secret not configured for callback.")
            return RedirectResponse(url=f"{frontend_url}/?login_error=auth_misconfigured", status_code=307)

        if not code:
            logger.warning("No authorization code received from GitHub.")
            return RedirectResponse(url=f"{frontend_url}/?login_error=github_no_code", status_code=307)

        try:
            # Construct actual_redirect_uri same way as prepare_github_login_redirect
            if config_settings.API_URL and not config_settings.API_URL.startswith("http://localhost"):
                actual_redirect_uri = f"{config_settings.API_URL.rstrip('/')}/auth/github/callback"
            else:
                forwarded_proto = request.headers.get("x-forwarded-proto", "https" if config_settings.ENV_TYPE == "production" else "http")
                forwarded_host = request.headers.get("x-forwarded-host")

                if forwarded_host:
                    actual_redirect_uri = f"{forwarded_proto}://{forwarded_host}/api/auth/github/callback"
                else:
                    base_url = str(request.base_url).rstrip('/')
                    actual_redirect_uri = f"{base_url}/auth/github/callback"
        except Exception:
            base_url = str(request.base_url).rstrip('/')
            actual_redirect_uri = f"{base_url}/api/auth/github/callback"

        async with httpx.AsyncClient() as client:
            token_exchange_params = {
                "client_id": github_client_id,
                "client_secret": github_client_secret,
                "code": code,
                "redirect_uri": actual_redirect_uri,
            }
            headers = {"Accept": "application/json"}
            try:
                token_response = await client.post(github_access_token_url, params=token_exchange_params, headers=headers)
                token_response.raise_for_status()
                token_data = token_response.json()
                github_token = token_data.get("access_token")
                if not github_token:
                    logger.error("Failed to retrieve access_token from GitHub. Token exchange succeeded but no access_token in response.")
                    return RedirectResponse(url=f"{frontend_url}/?login_error=github_token_exchange_failed", status_code=307)
            except httpx.HTTPStatusError as http_err:
                logger.error(f"GitHub token exchange HTTP error: {http_err.response.status_code} - {http_err.response.text}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_token_exchange_http_error", status_code=307)
            except httpx.RequestError as req_exc:
                logger.error(f"GitHub token exchange request error: {req_exc}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_token_exchange_request_error", status_code=307)
            except Exception as e:
                logger.error(f"GitHub token exchange unexpected error: {e}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_token_exchange_unexpected_error", status_code=307)

            user_headers = {"Authorization": f"token {github_token}", "Accept": "application/vnd.github.v3+json"}
            try:
                user_api_response = await client.get(github_api_user_url, headers=user_headers)
                user_api_response.raise_for_status()
                github_user_data = user_api_response.json()
            except httpx.HTTPStatusError as http_err:
                logger.error(f"GitHub user data fetch HTTP error: {http_err.response.status_code} - {http_err.response.text}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_user_data_http_error", status_code=307)
            except httpx.RequestError as req_exc:
                logger.error(f"GitHub user data fetch request error: {req_exc}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_user_data_request_error", status_code=307)
            except Exception as e:
                logger.error(f"GitHub user data fetch unexpected error: {e}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_user_data_unexpected_error", status_code=307)

            username = github_user_data.get("login")
            name = github_user_data.get("name") or username
            avatar_url = github_user_data.get("avatar_url")  # GitHub API uses snake_case
            email = github_user_data.get("email")
            github_user_id = github_user_data.get("id")

            if github_user_id is None or username is None:
                logger.error(
                    f"Essential user data (ID or login) missing from GitHub response: {github_user_data}"
                )
                return RedirectResponse(
                    url=f"{frontend_url}/?login_error=github_missing_essential_data",
                    status_code=307,
                )

            current_time = datetime.now(timezone.utc)
            
            # Check if user already exists by github_id
            existing_user = await self.users_collection.find_one({"githubId": github_user_id})
            
            # If no existing GitHub user, check for email match with different provider
            if not existing_user and email:
                # Check if there's a Google account with the same email
                google_account = await self.users_collection.find_one({"email": email, "googleId": {"$exists": True}})
                if google_account:
                    # Create pending link token with snake_case field names to match frontend expectations
                    pending_link_data = {
                        "existing_user_id": str(google_account["_id"]),
                        "existing_username": google_account.get("username", ""),
                        "existing_avatar": google_account.get("googleAvatarUrl", ""),
                        "github_id": github_user_id,
                        "github_username": username,
                        "github_avatar": avatar_url,
                        "github_token": github_token,
                        "github_email": email,
                        "github_name": name,
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
                    }
                    pending_link_token = create_access_token(data=pending_link_data)
                    logger.info(f"Email match found between GitHub and Google accounts. Redirecting to account linking modal.")
                    return RedirectResponse(
                        url=f"{frontend_url}/?pending_link={pending_link_token}",
                        status_code=307
                    )
            
            # Normal GitHub user creation/update
            try:
                # Ensure username uniqueness by checking and appending numbers if needed
                # This prevents conflicts when a Google user already has this username
                base_username = username
                counter = 1
                while await self.users_collection.find_one({"username": username, "githubId": {"$ne": github_user_id}}):
                    username = f"{base_username}{counter}"
                    counter += 1
                
                set_payload = {
                    "name": name,
                    "githubAvatarUrl": avatar_url,  # Store GitHub avatar separately
                    "email": email,
                    "githubId": github_user_id,
                    "githubUsername": username,  # Store provider-specific username
                    "githubAccessToken": github_token,  # Store the token for API calls
                    "updatedAt": current_time,
                    "lastLoginAt": current_time,
                }

                set_on_insert_payload = {
                    "username": username,
                    "createdAt": current_time,
                    "isAdmin": False,
                    # Set default privacy settings for new users
                    "showEmail": True,
                    "showGithub": True,
                    "preferredAvatarSource": "github",  # Default to GitHub avatar
                }

                # Match by githubId ONLY to prevent automatic account merging
                user_document = await self.users_collection.find_one_and_update(
                    {"githubId": github_user_id},
                    {
                        "$set": set_payload,
                        "$setOnInsert": set_on_insert_payload
                    },
                    upsert=True,
                    return_document=ReturnDocument.AFTER
                )
                
                # Compute primary avatar_url based on preference
                preferred_source = user_document.get("preferredAvatarSource", "github")
                if preferred_source == "google" and user_document.get("googleAvatarUrl"):
                    computed_avatar = user_document.get("googleAvatarUrl")
                else:
                    computed_avatar = user_document.get("githubAvatarUrl")
                
                # Update with computed avatar_url
                if computed_avatar:
                    await self.users_collection.update_one(
                        {"_id": user_document["_id"]},
                        {"$set": {"avatarUrl": computed_avatar}}
                    )
                    user_document["avatarUrl"] = computed_avatar
                
                if not user_document:
                    logger.error("GitHubOAuthService: Failed to upsert user document, find_one_and_update returned None unexpectedly.")
                    return RedirectResponse(url=f"{frontend_url}/?login_error=database_user_op_failed", status_code=307)
                
                logger.info(f"GitHubOAuthService: User {user_document.get('username')} (DB ID: {user_document['_id']}, GitHub ID: {user_document.get('githubId')}) upserted successfully.")

            except Exception as db_exc:
                logger.error(f"Database operation error during user upsert: {db_exc}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=database_user_op_generic_error", status_code=307)

            user_id_str = str(user_document["_id"])
            username_from_db = user_document["username"]
            access_token_payload = {
                "sub": user_id_str,
                "username": username_from_db,
                "githubId": github_user_id,
            }
            access_token = create_access_token(data=access_token_payload)
            
            refresh_token_payload = {"sub": user_id_str}
            refresh_token = create_refresh_token(data=refresh_token_payload, expires_delta=timedelta(minutes=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES))

            # Cookie settings: Use SameSite=None in production for cross-domain (Vercel + Render)
            # Use SameSite=Lax in development for same-origin (localhost)
            is_production = config_settings.ENV_TYPE == "production"
            samesite_setting = "none" if is_production else "lax"
            
            redirect_response.set_cookie(
                key=ACCESS_TOKEN_COOKIE_NAME,
                value=access_token,
                httponly=True,
                samesite=samesite_setting,
                max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                path="/",
                secure=True if is_production else False
            )
            redirect_response.set_cookie(
                key=REFRESH_TOKEN_COOKIE_NAME,
                value=refresh_token,
                httponly=True,
                samesite=samesite_setting,
                max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
                path="/api/auth",
                secure=True if is_production else False
            )
            
            csrf_token = secrets.token_hex(16)
            redirect_response.set_cookie(
                key=CSRF_TOKEN_COOKIE_NAME,
                value=csrf_token,
                httponly=False,
                samesite=samesite_setting,
                max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                path="/",
                secure=True if is_production else False
            )
            logger.info(f"Successfully authenticated user {username_from_db}. Redirecting to frontend. Cookies being set: Access, Refresh, CSRF.")
            
            # Add login_success query param to notify frontend of successful login
            success_redirect = RedirectResponse(url=f"{frontend_url}/dashboard?login_success=true", status_code=307)
            # Copy all cookies from redirect_response to success_redirect
            for key, value in redirect_response.headers.items():
                if key.lower() == 'set-cookie':
                    success_redirect.headers.append(key, value)
            return success_redirect