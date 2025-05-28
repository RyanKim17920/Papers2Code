from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse, JSONResponse
from pymongo import ReturnDocument
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timedelta, timezone
import httpx
import uuid
from jose import jwt, JWTError
import secrets
import logging

from ..schemas_minimal import UserSchema, TokenResponse, UserMinimal, CsrfToken
from ..shared import config_settings
from ..database import get_users_collection_sync
from ..auth import create_access_token, get_current_user, SECRET_KEY, ALGORITHM, create_refresh_token
from ..services.auth_service import AuthService # Add this import
from ..services.exceptions import (
    InvalidTokenException, UserNotFoundException, OAuthException, 
    OAuthStateMissingException, OAuthStateMismatchException, 
    GitHubTokenExchangeException, GitHubUserDataException, DatabaseOperationException
) # Add this import

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)

auth_service = AuthService() # Instantiate AuthService

OAUTH_STATE_COOKIE_NAME = "oauth_state_token"
ACCESS_TOKEN_COOKIE_NAME = "access_token_cookie"
REFRESH_TOKEN_COOKIE_NAME = "refresh_token"
CSRF_TOKEN_COOKIE_NAME = "csrf_token_cookie"
CSRF_TOKEN_HEADER_NAME = "X-CSRFToken"

@router.get("/csrf-token", response_model=CsrfToken)
async def get_csrf_token(request: Request, response: Response):
    csrf_token_value = auth_service.generate_csrf_token()
    response.set_cookie(
        key=CSRF_TOKEN_COOKIE_NAME,
        value=csrf_token_value,
        httponly=True,
        samesite="lax",
        secure=True if config_settings.ENV_TYPE == "production" else False,
        path="/"
    )
    return {"csrf_token": csrf_token_value}

@router.get("/github/login")
async def github_login(request: Request, response: Response):
    try:
        auth_url, state_jwt = auth_service.prepare_github_login_redirect(request)
        
        redirect_response = RedirectResponse(auth_url)
        redirect_response.set_cookie(
            key=OAUTH_STATE_COOKIE_NAME,
            value=state_jwt,
            httponly=True,
            samesite="lax",
            max_age=600, # 10 minutes, should match state token expiry
            path="/api/auth/github/callback", # Path where the callback will be handled
            secure=True if config_settings.ENV_TYPE == "production" else False
        )
        return redirect_response
    except OAuthException as e:
        logger.error(f"OAuth login preparation failed: {e.message}")
        # Redirect to a frontend error page or return a JSON error
        # For simplicity, raising HTTPException here, but a redirect might be more user-friendly
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error during GitHub login initiation: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not initiate GitHub login.")

@router.get("/github/callback", name="github_callback_endpoint")
async def github_callback(code: str, state: str, request: Request, response: Response): # Added response: Response
    frontend_url = config_settings.FRONTEND_URL
    callback_path = "/api/auth/github/callback" # Used for deleting state cookie on error

    try:
        # The auth_service.handle_github_callback will set the necessary cookies on the `response` object directly.
        final_redirect_url = await auth_service.handle_github_callback(code, state, request, response)
        return RedirectResponse(url=final_redirect_url)
    
    except (OAuthStateMissingException, OAuthStateMismatchException, InvalidTokenException) as e:
        logger.warning(f"OAuth callback state/token error: {e.message}")
        error_param = "state_error"
        if isinstance(e, OAuthStateMissingException):
            error_param = "state_cookie_missing"
        elif isinstance(e, OAuthStateMismatchException):
            error_param = "state_mismatch"
        elif isinstance(e, InvalidTokenException):
            error_param = "state_decode_error"
        
        error_redirect_response = RedirectResponse(f"{frontend_url}/?login_error={error_param}")
        # Ensure state cookie is cleared on state-related errors
        error_redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
        return error_redirect_response

    except (GitHubTokenExchangeException, GitHubUserDataException, OAuthException) as e:
        logger.error(f"GitHub OAuth processing error: {e.message}")
        error_param = "github_processing_error"
        if isinstance(e, GitHubTokenExchangeException):
            error_param = "github_token_exchange_failed"
        elif isinstance(e, GitHubUserDataException):
            error_param = "github_user_data_failed"
        elif "misconfigured" in e.message.lower(): # For generic OAuthException related to config
            error_param = "auth_misconfigured"
        
        error_redirect_response = RedirectResponse(f"{frontend_url}/?login_error={error_param}")
        error_redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
        return error_redirect_response

    except DatabaseOperationException as e:
        logger.error(f"Database operation failed during OAuth callback: {e.message}")
        error_redirect_response = RedirectResponse(f"{frontend_url}/?login_error=database_user_op_failed")
        error_redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
        return error_redirect_response

    except Exception as e:
        logger.error(f"General unexpected error in GitHub callback: {e}", exc_info=True)
        error_redirect_response = RedirectResponse(f"{frontend_url}/?login_error=callback_processing_error")
        error_redirect_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
        return error_redirect_response


@router.get("/me")
async def get_current_user_api(current_user: UserSchema = Depends(get_current_user)):
    # Logic moved to AuthService.get_user_details
    user_details = auth_service.get_user_details(current_user)
    return JSONResponse(content=user_details.model_dump(by_alias=True, mode="json"))

@router.post("/refresh_token", response_model=TokenResponse)
async def refresh_access_token(request: Request, response: Response):
    try:
        token_data = auth_service.refresh_access_token(request, response)
        return TokenResponse(**token_data)
    except InvalidTokenException as e:
        # For InvalidTokenException, clear the refresh token cookie as it's no longer valid.
        logout_response = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": e.message}
        )
        logout_response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME,
            path="/api/auth/refresh_token",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        # Optionally, clear the access token cookie as well, though it might have already expired.
        logout_response.delete_cookie(
            ACCESS_TOKEN_COOKIE_NAME,
            path="/",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        return logout_response
    except UserNotFoundException as e:
        # If the user is not found based on the refresh token, it implies a state
        # where the token is valid but the user doesn't exist. This is critical.
        # Treat similarly to an invalid token: clear cookies and force re-login.
        logout_response = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": e.message + " Please log in again."}
        )
        logout_response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME,
            path="/api/auth/refresh_token",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        logout_response.delete_cookie(
            ACCESS_TOKEN_COOKIE_NAME,
            path="/",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        return logout_response
    except Exception as e:
        # Catch-all for other unexpected errors from the service or during its call.
        logger.error(f"Unexpected error during token refresh: {e}", exc_info=True)
        # For generic errors, it's safer to also clear cookies to prevent an inconsistent auth state.
        logout_response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Could not refresh token due to an internal error. Please log in again."}
        )
        logout_response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME,
            path="/api/auth/refresh_token",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        logout_response.delete_cookie(
            ACCESS_TOKEN_COOKIE_NAME,
            path="/",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        return logout_response

@router.post("/logout", summary="Logout user")
async def logout(response: Response):
    auth_service.logout_user(response) # Call the service method
    return {"message": "Logout successful"}
