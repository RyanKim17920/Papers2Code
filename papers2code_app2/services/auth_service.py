from fastapi import HTTPException, status, Request, Response # Add Response here
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from bson import ObjectId
from bson.errors import InvalidId
from ..database import get_users_collection_async # Changed from get_users_collection_sync
from ..auth import create_access_token, SECRET_KEY, ALGORITHM, create_refresh_token # Updated import
from .exceptions import (
    InvalidTokenException, UserNotFoundException, OAuthException,
    OAuthStateMissingException, OAuthStateMismatchException,
    GitHubTokenExchangeException, GitHubUserDataException, DatabaseOperationException
)
from ..schemas_minimal import UserSchema, UserMinimal
from ..shared import config_settings
import httpx # Add httpx import
import uuid # Add uuid import
import secrets # Add import for secrets
from datetime import datetime, timedelta, timezone # Add datetime, timedelta, timezone imports
from pymongo import ReturnDocument # Add pymongo import
import logging # Add logging import

logger = logging.getLogger(__name__)

ACCESS_TOKEN_COOKIE_NAME = "access_token_cookie"
REFRESH_TOKEN_COOKIE_NAME = "refresh_token"
OAUTH_STATE_COOKIE_NAME = "oauth_state_token" # Define OAUTH_STATE_COOKIE_NAME
CSRF_TOKEN_COOKIE_NAME = "csrf_token_cookie" # Define CSRF_TOKEN_COOKIE_NAME

class AuthService:
    def get_user_details(self, current_user: UserSchema) -> UserMinimal:
        if not current_user:
            # This check might be redundant if get_current_user already raises
            # but kept for explicitness within the service layer's responsibility.
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        owner_username = config_settings.OWNER_GITHUB_USERNAME
        is_owner = owner_username is not None and current_user.username == owner_username
        
        logger.info(f"User {current_user.username} is_owner status: {is_owner} (checked in service)")

        user_response_data = UserMinimal(
            id=str(current_user.id),
            username=current_user.username,
            name=current_user.name,
            avatar_url=str(current_user.avatar_url) if current_user.avatar_url else None,
            is_owner=is_owner,
            is_admin=getattr(current_user, 'is_admin', False)  # Safely access is_admin
        )
        return user_response_data

    async def refresh_access_token(self, request: Request, response: Response) -> dict: # Made async
        refresh_token_value = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
        if not refresh_token_value:
            raise InvalidTokenException(detail="Refresh token not found")

        try:
            payload = jwt.decode(refresh_token_value, SECRET_KEY, algorithms=[ALGORITHM])
            user_id_from_token = payload.get("sub")
            if user_id_from_token is None:
                raise InvalidTokenException(detail="User ID (sub) missing from refresh token") # Completed

            users_collection = await get_users_collection_async() # Changed to async
            try:
                user_obj_id = ObjectId(user_id_from_token) # Completed
                user_doc = await users_collection.find_one({"_id": user_obj_id}) # Completed
            except InvalidId:
                raise InvalidTokenException(detail="Invalid User ID format in refresh token") # Completed
            
            if not user_doc:
                raise UserNotFoundException(detail="User from refresh token not found") # Completed

            new_access_token_payload = {
                "sub": str(user_doc["_id"]),
                "username": user_doc["username"],
                "github_id": user_doc.get("githubId"),
            }
            new_access_token = create_access_token(data=new_access_token_payload)
            
            response.set_cookie(
                key=ACCESS_TOKEN_COOKIE_NAME,
                value=new_access_token,
                httponly=True,
                samesite="lax",
                max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                path="/",
                secure=True if config_settings.ENV_TYPE == "production" else False
            )
            return {"access_token": new_access_token, "token_type": "bearer"} # Corresponds to TokenResponse

        except JWTError as jwt_exc:
            raise InvalidTokenException(detail=f"Refresh token validation error: {jwt_exc}")
        # Catching generic Exception here might be too broad for a service, 
        # but if specific database errors are expected, they could be caught and re-raised as ServiceException subtypes.

    def prepare_github_login_redirect(self, request: Request) -> RedirectResponse: # Changed return type
        """Prepares the GitHub authorization URL, state JWT, and returns a RedirectResponse with the state cookie set."""
        state_value = str(uuid.uuid4())
        state_token_payload = {"state_val": state_value, "sub": "oauth_state_marker", "exp": datetime.now(timezone.utc) + timedelta(minutes=10)}
        state_jwt = jwt.encode(state_token_payload, SECRET_KEY, algorithm=ALGORITHM)

        github_authorize_url = config_settings.GITHUB.AUTHORIZE_URL
        github_client_id = config_settings.GITHUB.CLIENT_ID
        github_scope = config_settings.GITHUB.SCOPE

        if not github_client_id:
            logger.error("GITHUB.CLIENT_ID is not configured.")
            # For consistency, redirect to a frontend error page if possible,
            # or raise an exception that the router can catch and handle.
            # Here, raising OAuthException which the router should catch.
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

        # Create RedirectResponse and set the state cookie on it
        response = RedirectResponse(url=auth_url)
        response.set_cookie(
            key=OAUTH_STATE_COOKIE_NAME,
            value=state_jwt,
            httponly=True,
            samesite="lax",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            path="/api/auth/github/callback",  # Scope cookie to the callback path
            max_age=10 * 60  # 10 minutes, matching JWT expiry
        )
        logger.debug(f"Prepared GitHub login redirect to: {auth_url}")
        logger.debug(f"Setting {OAUTH_STATE_COOKIE_NAME} with path /api/auth/github/callback")
        return response

    async def handle_github_callback(
        self, code: str, state_from_query: str, request: Request
    ) -> RedirectResponse:
        """Handles the GitHub OAuth callback, exchanges code for token, fetches user, creates/updates user, sets cookies, and returns a RedirectResponse."""
        state_jwt_from_cookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
        frontend_url = config_settings.FRONTEND_URL
        oauth_state_cookie_delete_path = "/api/auth/github/callback" # Path where it was set

        # Create a response object for setting cookies and redirecting
        # This will be the actual response returned to the client.
        redirect_response = RedirectResponse(url=frontend_url)

        if not state_jwt_from_cookie:
            # Clear cookie on the response object we are about to send
            redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_delete_path, secure=True if config_settings.ENV_TYPE == "production" else False, httponly=True, samesite="lax")
            logger.warning("OAuth state cookie missing. Redirecting to frontend with error.")
            # Redirect to frontend with an error query parameter
            return RedirectResponse(url=f"{frontend_url}/?login_error=state_cookie_missing", status_code=307)


        try:
            payload = jwt.decode(state_jwt_from_cookie, SECRET_KEY, algorithms=[ALGORITHM])
            expected_state_from_token = payload.get("state_val")
            if not expected_state_from_token or expected_state_from_token != state_from_query:
                redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_delete_path, secure=True if config_settings.ENV_TYPE == "production" else False, httponly=True, samesite="lax")
                logger.warning("OAuth state mismatch. Redirecting to frontend with error.")
                return RedirectResponse(url=f"{frontend_url}/?login_error=state_mismatch", status_code=307)
        except JWTError as jwt_exc:
            redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_delete_path, secure=True if config_settings.ENV_TYPE == "production" else False, httponly=True, samesite="lax")
            logger.warning(f"OAuth state JWT validation error: {jwt_exc}. Redirecting to frontend with error.")
            return RedirectResponse(url=f"{frontend_url}/?login_error=state_decode_error", status_code=307)
        
        # State validated, clear the state cookie now on the final response
        redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_delete_path, secure=True if config_settings.ENV_TYPE == "production" else False, httponly=True, samesite="lax")
        logger.debug("OAuth state cookie cleared after successful validation.")

        # State validated, proceed to exchange code for token
        github_access_token_url = config_settings.GITHUB.ACCESS_TOKEN_URL
        github_client_id = config_settings.GITHUB.CLIENT_ID
        github_client_secret = config_settings.GITHUB.CLIENT_SECRET
        github_api_user_url = config_settings.GITHUB.API_USER_URL

        if not github_client_id or not github_client_secret:
            logger.error("GitHub client ID or secret not configured for callback.")
            # No cookies to set here other than clearing state, which is done.
            # Redirect to frontend with an error.
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
                logger.debug(f"Exchanging GitHub code. URL: {github_access_token_url}, Params: {token_exchange_params}")
                token_response = await client.post(github_access_token_url, params=token_exchange_params, headers=headers)
                token_response.raise_for_status()
                token_data = token_response.json()
                github_token = token_data.get("access_token")
                if not github_token:
                    logger.error(f"Failed to retrieve access_token from GitHub. Response: {token_data}")
                    return RedirectResponse(url=f"{frontend_url}/?login_error=github_token_exchange_failed", status_code=307)
                logger.debug("GitHub access token obtained successfully.")
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
                logger.debug(f"Fetching user data from GitHub API. URL: {github_api_user_url}")
                user_api_response = await client.get(github_api_user_url, headers=user_headers)
                user_api_response.raise_for_status()
                github_user_data = user_api_response.json()
                logger.debug(f"GitHub user data fetched successfully: { {key: github_user_data.get(key) for key in ['id', 'login', 'name', 'email']} }")
            except httpx.HTTPStatusError as http_err:
                logger.error(f"GitHub user data fetch HTTP error: {http_err.response.status_code} - {http_err.response.text}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_user_data_http_error", status_code=307)
            except httpx.RequestError as req_exc:
                logger.error(f"GitHub user data fetch request error: {req_exc}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_user_data_request_error", status_code=307)
            except Exception as e:
                logger.error(f"GitHub user data fetch unexpected error: {e}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_user_data_unexpected_error", status_code=307)

            # 3. User data fetched, now create or update user in DB
            users_collection = await get_users_collection_async()
            
            github_id = github_user_data.get("id")
            username = github_user_data.get("login") # This is the GitHub username
            name = github_user_data.get("name") or username # Use username if name is not set
            avatar_url = github_user_data.get("avatar_url")
            email = github_user_data.get("email") 

            if not github_id or not username:
                logger.error(f"Essential user data (ID or login) missing from GitHub response: {github_user_data}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=github_missing_essential_data", status_code=307)

            current_time = datetime.now(timezone.utc)
            try:
                user_document = await users_collection.find_one_and_update(
                    {"githubId": github_id},
                    {
                        "$set": {
                            "username": username,
                            "name": name,
                            "avatarUrl": avatar_url,
                            "email": email,
                            "updatedAt": current_time,
                            "lastLoginAt": current_time, # Also update last login time
                        },
                        "$setOnInsert": {
                            "githubId": github_id,
                            "createdAt": current_time,
                            "is_admin": False, 
                            # Add other default fields for new users if any, e.g., roles: []
                        }
                    },
                    upsert=True,
                    return_document=ReturnDocument.AFTER
                )
                if not user_document:
                    logger.error("Failed to upsert user document, find_one_and_update returned None unexpectedly.")
                    return RedirectResponse(url=f"{frontend_url}/?login_error=database_user_op_failed", status_code=307)
                logger.info(f"User {username} (ID: {user_document['_id']}) upserted successfully.")
            except Exception as db_exc:
                logger.error(f"Database operation error during user upsert: {db_exc}")
                return RedirectResponse(url=f"{frontend_url}/?login_error=database_user_op_generic_error", status_code=307)

            # 4. Create access and refresh tokens
            user_id_str = str(user_document["_id"])
            access_token_payload = {"sub": user_id_str, "username": username, "github_id": github_id}
            access_token = create_access_token(data=access_token_payload)
            
            refresh_token_payload = {"sub": user_id_str}
            refresh_token = create_refresh_token(data=refresh_token_payload)
            logger.debug(f"Access and refresh tokens created for user {username}.")

            # 5. Generate CSRF token
            csrf_token = self.generate_csrf_token()
            logger.debug("CSRF token generated.")

            # 6. Set cookies
            cookie_secure_flag = True if config_settings.ENV_TYPE == "production" else False
            cookie_samesite_policy = "lax" # Default to "lax"

            access_token_path = "/"
            refresh_token_path = "/api/auth/refresh_token"
            csrf_token_path = "/"

            logger.debug(f"Setting access_token_cookie: path={access_token_path}, secure={cookie_secure_flag}, httponly=True, samesite={cookie_samesite_policy}")
            redirect_response.set_cookie(
                key=ACCESS_TOKEN_COOKIE_NAME, value=access_token, httponly=True, samesite=cookie_samesite_policy,
                max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, path=access_token_path, secure=cookie_secure_flag,
            )
            logger.debug(f"Setting refresh_token_cookie: path={refresh_token_path}, secure={cookie_secure_flag}, httponly=True, samesite={cookie_samesite_policy}")
            redirect_response.set_cookie(
                key=REFRESH_TOKEN_COOKIE_NAME, value=refresh_token, httponly=True, samesite=cookie_samesite_policy,
                max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60, path=refresh_token_path, secure=cookie_secure_flag,
            )
            logger.debug(f"Setting csrf_token_cookie: path={csrf_token_path}, secure={cookie_secure_flag}, httponly=False, samesite={cookie_samesite_policy}")
            redirect_response.set_cookie(
                key=CSRF_TOKEN_COOKIE_NAME, value=csrf_token, httponly=False, samesite=cookie_samesite_policy,
                max_age=3600 * 24 * 7, path=csrf_token_path, secure=cookie_secure_flag,
            )
            logger.debug("Authentication cookies (access, refresh, csrf) set on RedirectResponse.")
            
            logger.info(f"GitHub OAuth callback successful for user {username}. Returning RedirectResponse to frontend: {frontend_url}")
            # The redirect_response already has frontend_url set at the beginning.
            # If an error occurred before this point, it would have returned a RedirectResponse to an error URL.
            return redirect_response

    def generate_csrf_token(self) -> str:
        """Generates a CSRF token string."""
        return secrets.token_hex(32) # Add import for secrets if not already at top level of service file

    def logout_user(self, response: Response) -> None:
        """Clears authentication-related cookies."""
        response.delete_cookie(
            ACCESS_TOKEN_COOKIE_NAME,
            path="/",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME,
            path="/api/auth/refresh_token",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        response.delete_cookie(
            CSRF_TOKEN_COOKIE_NAME,
            path="/",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=False, # MODIFIED: Allow JS to read CSRF token if needed
            samesite="lax"
        )

