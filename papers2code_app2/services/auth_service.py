from fastapi import HTTPException, status, Request, Response
from jose import jwt, JWTError
from bson import ObjectId
from bson.errors import InvalidId
from ..database import get_users_collection_sync
from ..auth import create_access_token, SECRET_KEY, ALGORITHM, create_refresh_token # Updated import
from .exceptions import (
    InvalidTokenException, UserNotFoundException, OAuthException,
    OAuthStateMissingException, OAuthStateMismatchException,
    GitHubTokenExchangeException, GitHubUserDataException, DatabaseOperationException
)
from ..schemas_minimal import UserSchema, UserMinimal
from ..shared import config_settings
import logging
import httpx # Add httpx import
import uuid # Add uuid import
import secrets # Add import for secrets
from datetime import datetime, timedelta, timezone # Add datetime, timedelta, timezone imports
from pymongo import ReturnDocument # Add pymongo import

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

    def refresh_access_token(self, request: Request, response: Response) -> dict: # Return type can be more specific, e.g. TokenResponse model
        refresh_token_value = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
        if not refresh_token_value:
            raise InvalidTokenException(detail="Refresh token not found")

        try:
            payload = jwt.decode(refresh_token_value, SECRET_KEY, algorithms=[ALGORITHM])
            user_id_from_token = payload.get("sub")
            if user_id_from_token is None:
                raise InvalidTokenException(detail="Invalid refresh token: no subject")

            users_collection = get_users_collection_sync()
            try:
                user_doc = users_collection.find_one({"_id": ObjectId(user_id_from_token)})
            except InvalidId:
                raise InvalidTokenException(detail=f"Invalid user ID format in refresh token: {user_id_from_token}")
            
            if not user_doc:
                # This specific case might warrant a custom response in the router to clear cookies
                raise UserNotFoundException(user_identifier=user_id_from_token, criteria="ID from refresh token")

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

    def prepare_github_login_redirect(self, request: Request) -> tuple[str, str]:
        """Prepares the GitHub authorization URL and state JWT."""
        state_value = str(uuid.uuid4())
        # Note: The 'sub' for state_jwt is just a marker, not a user ID at this stage.
        state_token_payload = {"state_val": state_value, "sub": "oauth_state_marker", "exp": datetime.now(timezone.utc) + timedelta(minutes=10)}
        # Using the main SECRET_KEY and ALGORITHM for state token, ensure this is acceptable.
        # Alternatively, a dedicated key/method for state tokens could be used.
        state_jwt = jwt.encode(state_token_payload, SECRET_KEY, algorithm=ALGORITHM)

        github_authorize_url = config_settings.GITHUB.AUTHORIZE_URL
        github_client_id = config_settings.GITHUB.CLIENT_ID
        github_scope = config_settings.GITHUB.SCOPE

        if not github_client_id:
            logger.error("GITHUB.CLIENT_ID is not configured.")
            raise OAuthException(detail="Authentication service is misconfigured (GitHub Client ID not set).")

        try:
            # Construct redirect_uri for the callback endpoint
            redirect_uri = str(request.url_for('github_callback_endpoint'))
            # Ensure redirect_uri is absolute, as GitHub requires
            if not redirect_uri.startswith("http"):
                # Fallback if url_for doesn't produce an absolute URL (e.g. behind a proxy not forwarding headers correctly)
                base_url = str(request.base_url).rstrip('/')
                # Assuming router prefix is /auth as per existing code
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
        return auth_url, state_jwt

    async def handle_github_callback(
        self, code: str, state_from_query: str, request: Request, response: Response
    ) -> str: # Returns the frontend redirect URL string
        """Handles the GitHub OAuth callback, exchanges code for token, fetches user, creates/updates user, and sets cookies."""
        state_jwt_from_cookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
        frontend_url = config_settings.FRONTEND_URL
        callback_path = "/api/auth/github/callback" # Path for deleting state cookie

        if not state_jwt_from_cookie:
            raise OAuthStateMissingException()

        try:
            payload = jwt.decode(state_jwt_from_cookie, SECRET_KEY, algorithms=[ALGORITHM])
            expected_state_from_token = payload.get("state_val")
            if not expected_state_from_token or expected_state_from_token != state_from_query:
                raise OAuthStateMismatchException()
        except JWTError as jwt_exc:
            raise InvalidTokenException(detail=f"OAuth state JWT validation error: {jwt_exc}")
        
        # State validated, proceed to exchange code for token
        github_access_token_url = config_settings.GITHUB.ACCESS_TOKEN_URL
        github_client_id = config_settings.GITHUB.CLIENT_ID
        github_client_secret = config_settings.GITHUB.CLIENT_SECRET
        github_api_user_url = config_settings.GITHUB.API_USER_URL

        if not github_client_id or not github_client_secret:
            logger.error("GitHub client ID or secret not configured for callback.")
            raise OAuthException(detail="Authentication service misconfigured (GitHub client credentials missing).")

        if not code:
            raise OAuthException(detail="No authorization code received from GitHub.")

        try:
            actual_redirect_uri = str(request.url_for('github_callback_endpoint'))
            if not actual_redirect_uri.startswith("http"):
                base_url = str(request.base_url).rstrip('/')
                actual_redirect_uri = f"{base_url}/auth/github/callback"
        except Exception:
             base_url = str(request.base_url).rstrip('/')
             actual_redirect_uri = f"{base_url}/auth/github/callback"

        async with httpx.AsyncClient() as client:
            try:
                # Exchange code for GitHub access token
                token_params = {
                    "client_id": github_client_id,
                    "client_secret": github_client_secret,
                    "code": code,
                    "redirect_uri": actual_redirect_uri,
                }
                token_headers = {"Accept": "application/json"}
                token_response = await client.post(github_access_token_url, data=token_params, headers=token_headers)
                token_response.raise_for_status() # Raises HTTPStatusError for 4xx/5xx
                token_data = token_response.json()
                github_token = token_data.get("access_token")
                if not github_token:
                    raise GitHubTokenExchangeException()

                # Fetch user data from GitHub
                user_api_headers = {"Authorization": f"token {github_token}", "Accept": "application/vnd.github.v3+json"}
                user_response = await client.get(github_api_user_url, headers=user_api_headers)
                user_response.raise_for_status()
                github_user_data = user_response.json()

                primary_email = github_user_data.get("email")
                if not primary_email:
                    emails_response = await client.get(f"{github_api_user_url}/emails", headers=user_api_headers)
                    if emails_response.status_code == 200:
                        emails_data = emails_response.json()
                        for email_info in emails_data:
                            if email_info.get("primary") and email_info.get("verified"):
                                primary_email = email_info.get("email")
                                break
                        if not primary_email: # Fallback to first verified email if no primary verified
                            for email_info in emails_data:
                                if email_info.get("verified"):
                                    primary_email = email_info.get("email")
                                    break
                    else:
                        logger.warning(f"Could not fetch emails for GitHub user {github_user_data.get('login')}, status: {emails_response.status_code}")
            
            except httpx.HTTPStatusError as http_err:
                logger.error(f"HTTP error during GitHub OAuth process: {http_err} - Response: {http_err.response.text if http_err.response else 'No text'}")
                if token_response and not github_token: # Error during token exchange
                     raise GitHubTokenExchangeException(detail=f"GitHub token exchange failed: {http_err.response.text if http_err.response else 'No details'}")
                else: # Error during user data fetching
                    raise GitHubUserDataException(detail=f"Fetching GitHub user data failed: {http_err.response.text if http_err.response else 'No details'}")
            except httpx.RequestError as req_exc:
                logger.error(f"Request to GitHub failed during OAuth: {req_exc}")
                raise OAuthException(detail="Communication with GitHub failed.")

            # User data fetched, now create or update user in DB
            users_collection = get_users_collection_sync()
            current_time_utc = datetime.now(timezone.utc)
            try:
                user_doc = users_collection.find_one_and_update(
                    {"githubId": github_user_data['id']},
                    {
                        "$set": {
                            "username": github_user_data['login'],
                            "name": github_user_data.get('name'),
                            "avatarUrl": github_user_data.get('avatar_url'),
                            "email": primary_email,
                            "lastLogin": current_time_utc
                        },
                        "$setOnInsert": {
                            "createdAt": current_time_utc,
                            "githubId": github_user_data['id']
                        }
                    },
                    upsert=True,
                    return_document=ReturnDocument.AFTER
                )
                if not user_doc:
                    raise DatabaseOperationException(detail=f"Failed to create or update user {github_user_data['login']} in database.")
            except Exception as db_exc: # Catch generic pymongo errors or other DB issues
                logger.error(f"Database error during user upsert for {github_user_data['login']}: {db_exc}")
                raise DatabaseOperationException(detail="Database operation failed during user sign-in.")

            # Create access and refresh tokens
            access_token_payload = {"sub": str(user_doc["_id"]), "username": user_doc["username"], "github_id": user_doc.get("githubId")}
            access_token = create_access_token(data=access_token_payload)
            refresh_token_payload = {"sub": str(user_doc["_id"])}
            refresh_token = create_refresh_token(data=refresh_token_payload)

            # Set cookies in the response object passed from the router
            response.set_cookie(
                key=ACCESS_TOKEN_COOKIE_NAME, value=access_token, httponly=True, samesite="lax",
                max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/",
                secure=True if config_settings.ENV_TYPE == "production" else False
            )
            response.set_cookie(
                key=REFRESH_TOKEN_COOKIE_NAME, value=refresh_token, httponly=True, samesite="lax",
                max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60, path="/api/auth/refresh_token", # Specific path for refresh token
                secure=True if config_settings.ENV_TYPE == "production" else False
            )
            # Delete the state cookie as it's no longer needed
            response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
            
            return f"{frontend_url}/?login_success=true"

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
            httponly=True,
            samesite="lax"
        )

