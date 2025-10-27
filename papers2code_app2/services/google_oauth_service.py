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

class GoogleOAuthService:
    def __init__(self):
        self.users_collection = None

    async def _init_collections(self):
        if self.users_collection is None:
            self.users_collection = await get_users_collection_async()

    def prepare_google_login_redirect(self, request: Request) -> RedirectResponse:
        """Prepares the Google authorization URL, state JWT, and returns a RedirectResponse with the state cookie set."""
        state_value = str(uuid.uuid4())
        state_token_payload = {"state_val": state_value, "sub": "oauth_state_marker", "exp": datetime.now(timezone.utc) + timedelta(minutes=10)}
        state_jwt = jwt.encode(state_token_payload, config_settings.FLASK_SECRET_KEY, algorithm=config_settings.ALGORITHM)

        google_authorize_url = config_settings.GOOGLE.AUTHORIZE_URL
        google_client_id = config_settings.GOOGLE.CLIENT_ID
        google_scope = config_settings.GOOGLE.SCOPE

        if not google_client_id:
            logger.error("GOOGLE.CLIENT_ID is not configured.")
            raise OAuthException(detail="Authentication service is misconfigured (Google Client ID not set).")

        try:
            redirect_uri = str(request.url_for('google_callback_endpoint'))
            if not redirect_uri.startswith("http"):
                base_url = str(request.base_url).rstrip('/')
                redirect_uri = f"{base_url}/auth/google/callback"
        except Exception as e:
            logger.error(f"Error constructing redirect_uri for Google OAuth: {e}")
            raise OAuthException(detail="Error preparing authentication request to Google.")

        auth_url = (
            f"{google_authorize_url}?"
            f"client_id={google_client_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope={google_scope}&"
            f"state={state_value}&"
            f"access_type=offline&"
            f"prompt=consent"
        )

        response = RedirectResponse(url=auth_url)
        response.set_cookie(
            key=OAUTH_STATE_COOKIE_NAME,
            value=state_jwt,
            httponly=True,
            samesite="lax",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            path="/api/auth/google/callback",
            max_age=10 * 60
        )
        return response

    async def handle_google_callback(
        self, code: str, state_from_query: str, request: Request
    ) -> RedirectResponse:
        """Handles the Google OAuth callback, exchanges code for token, fetches user, creates/updates user, sets cookies, and returns a RedirectResponse."""
        await self._init_collections()
        state_jwt_from_cookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
        frontend_url = config_settings.FRONTEND_URL
        oauth_state_cookie_delete_path = "/api/auth/google/callback"

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

        google_access_token_url = config_settings.GOOGLE.ACCESS_TOKEN_URL
        google_client_id = config_settings.GOOGLE.CLIENT_ID
        google_client_secret = config_settings.GOOGLE.CLIENT_SECRET
        google_api_user_url = config_settings.GOOGLE.API_USER_URL

        if not google_client_id or not google_client_secret:
            logger.error("Google client ID or secret not configured for callback.")
            return RedirectResponse(url=f"{frontend_url}/?login_error=auth_misconfigured", status_code=307)

        if not code:
            logger.warning("No authorization code received from Google.")
            return RedirectResponse(url=f"{frontend_url}/?login_error=google_no_code", status_code=307)

        try:
            actual_redirect_uri = str(request.url_for('google_callback_endpoint'))
            if not actual_redirect_uri.startswith("http"):
                 base_url = str(request.base_url).rstrip('/')
                 actual_redirect_uri = f"{base_url}{request.url.path}"
        except Exception:
             base_url = str(request.base_url).rstrip('/')
             actual_redirect_uri = f"{base_url}/api/auth/google/callback"

        async with httpx.AsyncClient() as client:
            token_exchange_data = {
                "client_id": google_client_id,
                "client_secret": google_client_secret,
                "code": code,
                "redirect_uri": actual_redirect_uri,
                "grant_type": "authorization_code"
            }
            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            try:
                token_response = await client.post(google_access_token_url, data=token_exchange_data, headers=headers)
                token_response.raise_for_status()
                token_data = token_response.json()
                google_token = token_data.get("access_token")
                if not google_token:
                    logger.error(f"Failed to retrieve access_token from Google. Response: {token_data}")
                    return RedirectResponse(url=f"{frontend_url}/?login_error=google_token_exchange_failed", status_code=307)
            except httpx.HTTPStatusError as http_err:
                logger.error(f"Google token exchange HTTP error: {http_err.response.status_code} - {http_err.response.text}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=google_token_exchange_http_error", status_code=307)
            except httpx.RequestError as req_exc:
                logger.error(f"Google token exchange request error: {req_exc}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=google_token_exchange_request_error", status_code=307)
            except Exception as e:
                logger.error(f"Google token exchange unexpected error: {e}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=google_token_exchange_unexpected_error", status_code=307)

            user_headers = {"Authorization": f"Bearer {google_token}"}
            try:
                user_api_response = await client.get(google_api_user_url, headers=user_headers)
                user_api_response.raise_for_status()
                google_user_data = user_api_response.json()
            except httpx.HTTPStatusError as http_err:
                logger.error(f"Google user data fetch HTTP error: {http_err.response.status_code} - {http_err.response.text}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=google_user_data_http_error", status_code=307)
            except httpx.RequestError as req_exc:
                logger.error(f"Google user data fetch request error: {req_exc}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=google_user_data_request_error", status_code=307)
            except Exception as e:
                logger.error(f"Google user data fetch unexpected error: {e}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=google_user_data_unexpected_error", status_code=307)

            # Extract user information from Google response
            google_user_id = google_user_data.get("id")
            email = google_user_data.get("email")
            name = google_user_data.get("name")
            avatar_url = google_user_data.get("picture")
            
            # Create username from email (before @ symbol)
            username = email.split("@")[0] if email else f"user_{google_user_id}"

            if google_user_id is None or email is None:
                logger.error(
                    f"Essential user data (ID or email) missing from Google response: {google_user_data}"
                )
                return RedirectResponse(
                    url=f"{frontend_url}/?login_error=google_missing_essential_data",
                    status_code=307,
                )

            current_time = datetime.now(timezone.utc)
            
            # Check if user already exists by google_id or email
            existing_user = await self.users_collection.find_one({
                "$or": [
                    {"google_id": google_user_id},
                    {"email": email}
                ]
            })
            
            # If user exists with a different provider, we need to handle this
            if existing_user and existing_user.get("github_id") and not existing_user.get("google_id"):
                # User exists via GitHub, now linking Google account
                logger.info(f"Linking Google account to existing GitHub user: {existing_user.get('username')}")
                update_payload = {
                    "google_id": google_user_id,
                    "email": email,
                    "updatedAt": current_time,
                    "lastLoginAt": current_time,
                }
                user_document = await self.users_collection.find_one_and_update(
                    {"_id": existing_user["_id"]},
                    {"$set": update_payload},
                    return_document=ReturnDocument.AFTER
                )
            else:
                # Create new user or update existing Google user
                try:
                    # Ensure username uniqueness by checking and appending numbers if needed
                    base_username = username
                    counter = 1
                    while await self.users_collection.find_one({"username": username, "google_id": {"$ne": google_user_id}}):
                        username = f"{base_username}{counter}"
                        counter += 1
                    
                    set_payload = {
                        "name": name,
                        "avatarUrl": avatar_url,
                        "email": email,
                        "google_id": google_user_id,
                        "updatedAt": current_time,
                        "lastLoginAt": current_time,
                    }

                    set_on_insert_payload = {
                        "username": username,
                        "createdAt": current_time,
                        "is_admin": False,
                    }

                    user_document = await self.users_collection.find_one_and_update(
                        {"google_id": google_user_id},
                        {
                            "$set": set_payload,
                            "$setOnInsert": set_on_insert_payload
                        },
                        upsert=True,
                        return_document=ReturnDocument.AFTER
                    )
                    if not user_document:
                        logger.error("GoogleOAuthService: Failed to upsert user document, find_one_and_update returned None unexpectedly.")
                        return RedirectResponse(url=f"{frontend_url}/?login_error=database_user_op_failed", status_code=307)
                    
                    logger.info(f"GoogleOAuthService: User {username} (DB ID: {user_document['_id']}, Google ID: {user_document.get('google_id')}) upserted successfully.")

                except Exception as db_exc:
                    logger.error(f"Database operation error during user upsert: {db_exc}")
                    return RedirectResponse(url=f"{frontend_url}/?login_error=database_user_op_generic_error", status_code=307)

            user_id_str = str(user_document["_id"])
            username = user_document["username"]
            access_token_payload = {
                "sub": user_id_str,
                "username": username,
                "google_id": google_user_id,
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
