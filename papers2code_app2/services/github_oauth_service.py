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
            redirect_uri = str(request.url_for('github_callback_endpoint'))
            if not redirect_uri.startswith("http"):
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
        response.set_cookie(
            key=OAUTH_STATE_COOKIE_NAME,
            value=state_jwt,
            httponly=True,
            samesite="lax",
            secure=True if config_settings.ENV_TYPE == "production" else False,
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
            actual_redirect_uri = str(request.url_for('github_callback_endpoint'))
            if not actual_redirect_uri.startswith("http"):
                 base_url = str(request.base_url).rstrip('/')
                 actual_redirect_uri = f"{base_url}{request.url.path}"
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
                    logger.error(f"Failed to retrieve access_token from GitHub. Response: {token_data}")
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
            avatar_url = github_user_data.get("avatar_url")
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
            try:
                set_payload = {
                    "name": name,
                    "avatarUrl": avatar_url,
                    "email": email,
                    "github_id": github_user_id,
                    "updatedAt": current_time,
                    "lastLoginAt": current_time,
                }

                set_on_insert_payload = {
                    "username": username,
                    "createdAt": current_time,
                    "is_admin": False,
                }

                user_document = await self.users_collection.find_one_and_update(
                    {"username": username},
                    {
                        "$set": set_payload,
                        "$setOnInsert": set_on_insert_payload
                    },
                    upsert=True,
                    return_document=ReturnDocument.AFTER
                )
                if not user_document:
                    logger.error("GitHubOAuthService: Failed to upsert user document, find_one_and_update returned None unexpectedly.")
                    return RedirectResponse(url=f"{frontend_url}/?login_error=database_user_op_failed", status_code=307)
                
                logger.info(f"GitHubOAuthService: User {username} (DB ID: {user_document['_id']}, GitHub ID: {user_document.get('github_id')}) upserted successfully.")

            except Exception as db_exc:
                logger.error(f"Database operation error during user upsert: {db_exc}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=database_user_op_generic_error", status_code=307)

            user_id_str = str(user_document["_id"])
            access_token_payload = {
                "sub": user_id_str,
                "username": username,
                "github_id": github_user_id,
            }
            access_token = create_access_token(data=access_token_payload)
            
            refresh_token_payload = {"sub": user_id_str}
            refresh_token = create_refresh_token(data=refresh_token_payload, expires_delta=timedelta(minutes=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES))

            redirect_response.set_cookie(
                key=ACCESS_TOKEN_COOKIE_NAME,
                value=access_token,
                httponly=True,
                samesite="lax",
                max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                path="/",
                secure=True if config_settings.ENV_TYPE == "production" else False
            )
            redirect_response.set_cookie(
                key=REFRESH_TOKEN_COOKIE_NAME,
                value=refresh_token,
                httponly=True,
                samesite="lax",
                max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
                path="/api/auth",
                secure=True if config_settings.ENV_TYPE == "production" else False
            )
            
            csrf_token = secrets.token_hex(16)
            redirect_response.set_cookie(
                key=CSRF_TOKEN_COOKIE_NAME,
                value=csrf_token,
                httponly=False,
                samesite="lax",
                max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                path="/",
                secure=True if config_settings.ENV_TYPE == "production" else False
            )
            logger.info(f"Successfully authenticated user {username}. Redirecting to frontend. Cookies being set: Access, Refresh, CSRF.")
            return redirect_response