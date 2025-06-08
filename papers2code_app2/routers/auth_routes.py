from fastapi import APIRouter, Depends, status, Response, Request
from fastapi.responses import RedirectResponse, JSONResponse
import logging

from ..schemas_minimal import UserSchema, TokenResponse, UserMinimal, CsrfToken, UserUpdateProfile # Added UserUpdateProfile
from ..shared import config_settings
from ..auth import get_current_user # SECRET_KEY, ALGORITHM, create_refresh_token are used by service
from ..services.auth_service import AuthService
from ..constants import OAUTH_STATE_COOKIE_NAME, CSRF_TOKEN_COOKIE_NAME
from ..services.exceptions import (
    InvalidTokenException,
    UserNotFoundException,
    OAuthException,
    DatabaseOperationException # Added DatabaseOperationException
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)

auth_service = AuthService()

@router.get("/csrf-token", response_model=CsrfToken)
async def get_csrf_token(request: Request, response: Response):
    csrf_token_value = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)
    if not csrf_token_value:
        csrf_token_value = auth_service.generate_csrf_token() # generate_csrf_token should be a method in AuthService
        response.set_cookie(
            key=CSRF_TOKEN_COOKIE_NAME,
            value=csrf_token_value,
            httponly=False, 
            samesite="lax",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            path="/",
            max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60 # Match access token lifetime or a reasonable session duration
        )
    return {"csrf_token": csrf_token_value}

@router.get("/github/login")
async def github_login(request: Request): # Removed unused response: Response
    try:
        # This method now returns a RedirectResponse with the cookie set on it
        return auth_service.prepare_github_login_redirect(request)
    except OAuthException as e:
        logger.error(f"OAuth login preparation failed: {e.message}")
        # Return a JSONResponse for API-like error, or redirect to a frontend error page
        # For consistency with callback, redirecting to frontend error page
        frontend_url = config_settings.FRONTEND_URL
        return RedirectResponse(f"{frontend_url}/?login_error=oauth_prepare_failed&detail={e.message}", status_code=307)
    except Exception as e:
        logger.error(f"Unexpected error during GitHub login initiation: {e}", exc_info=True)
        frontend_url = config_settings.FRONTEND_URL
        return RedirectResponse(f"{frontend_url}/?login_error=oauth_prepare_unexpected", status_code=307)


@router.get("/github/callback", name="github_callback_endpoint")
async def github_callback(code: str, state: str, request: Request): # Removed response: Response
    # The auth_service.handle_github_callback now constructs and returns the RedirectResponse
    # with all cookies set on it, or a RedirectResponse to an error page.
    try:
        # This call will handle all logic and return the appropriate RedirectResponse
        # The RedirectResponse will have cookies set by the service method.
        return await auth_service.handle_github_callback(code, state, request)
    except Exception as e:
        # This is a fallback catch-all. Specific errors should be handled within handle_github_callback
        # and result in a RedirectResponse to the frontend with an error query parameter.
        logger.error(f"General unexpected error in GitHub callback router: {e}", exc_info=True)
        frontend_url = config_settings.FRONTEND_URL
        # Construct a generic error redirect if something truly unexpected happens at the router level
        # The service method should ideally prevent this by handling its own errors.
        error_redirect = RedirectResponse(f"{frontend_url}/?login_error=callback_router_unexpected_error", status_code=307)
        # Attempt to clear state cookie as a last resort if it wasn't done
        error_redirect.delete_cookie(
            OAUTH_STATE_COOKIE_NAME, 
            httponly=True, 
            samesite="lax", 
            path="/api/auth/github/callback", # Path where it was set
            secure=True if config_settings.ENV_TYPE == "production" else False
        )
        return error_redirect


@router.get("/me", response_model=UserMinimal)
async def get_current_user_api(current_user: UserSchema = Depends(get_current_user)):
    # Logic moved to AuthService.get_user_details
    # Ensure get_user_details returns a Pydantic model or a dict that matches UserMinimal
    user_details_model = auth_service.get_user_details(current_user)
    return user_details_model # FastAPI will serialize Pydantic model to JSON

@router.put("/users/me/profile", response_model=UserSchema)
async def update_current_user_profile(
    profile_data: UserUpdateProfile,
    current_user: UserSchema = Depends(get_current_user),
    auth_service_instance: AuthService = Depends(lambda: auth_service) # Use Depends for service instance
):
    try:
        updated_user = await auth_service_instance.update_user_profile(user_id=str(current_user.id), profile_data=profile_data)
        return updated_user
    except UserNotFoundException as e:
        logger.warning(f"User not found when trying to update profile for user_id: {current_user.id}")
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": e.message})
    except DatabaseOperationException as e: # Assuming DatabaseOperationException is a relevant exception from your service
        logger.error(f"Database error updating profile for user_id: {current_user.id}: {e.message}")
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Failed to update profile due to a database error."})
    except Exception as e:
        logger.exception(f"Unexpected error updating profile for user_id: {current_user.id}")
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "An unexpected error occurred."})


@router.post("/refresh_token", response_model=TokenResponse)
async def refresh_access_token_route(request: Request, response: Response): # response needed to set cookie
    try:
        # AuthService.refresh_access_token now needs to set cookies on the passed 'response' object
        token_data_dict = await auth_service.refresh_access_token(request, response)
        # Ensure CSRF token is also refreshed/re-set if access token is refreshed
        csrf_token_value = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)
        if not csrf_token_value: # Or if you want to always refresh it alongside access token
            csrf_token_value = auth_service.generate_csrf_token()
        response.set_cookie(
            key=CSRF_TOKEN_COOKIE_NAME,
            value=csrf_token_value,
            httponly=False,
            samesite="lax",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            path="/",
            max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        return TokenResponse(**token_data_dict) # FastAPI will serialize this
    except (InvalidTokenException, UserNotFoundException) as e:
        logout_response_content = {"detail": e.message}
        status_code = status.HTTP_401_UNAUTHORIZED
        
        # Create JSONResponse to clear cookies
        error_response = JSONResponse(
            status_code=status_code,
            content=logout_response_content
        )
        # Clear cookies on this error response
        auth_service.clear_auth_cookies(error_response) # Assuming clear_auth_cookies takes a Response object
        return error_response
    except Exception as e:
        logger.error(f"Unexpected error during token refresh: {e}", exc_info=True)
        error_response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Could not refresh token due to an internal error. Please log in again."}
        )
        auth_service.clear_auth_cookies(error_response)
        return error_response

@router.post("/logout")
async def logout_user_route(request: Request, response: Response): # response needed to clear cookies
    try:
        await auth_service.logout_user(request, response) # Modifies 'response' to clear cookies
        return {"message": "Logout successful"}
    except Exception as e:
        logger.error(f"Error during logout process: {e}", exc_info=True)
        # Even if logout service fails, try to clear cookies on a new response
        error_response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An error occurred during logout."}
        )
        auth_service.clear_auth_cookies(error_response) # Clear cookies on this new response
        return error_response

# Ensure AuthService has a clear_auth_cookies method:
# def clear_auth_cookies(self, response: Response):
#     cookie_secure_flag = True if config_settings.ENV_TYPE == "production" else False
#     response.delete_cookie(ACCESS_TOKEN_COOKIE_NAME, path="/", secure=cookie_secure_flag, httponly=True, samesite="lax")
#     response.delete_cookie(REFRESH_TOKEN_COOKIE_NAME, path="/api/auth/refresh_token", secure=cookie_secure_flag, httponly=True, samesite="lax")
#     response.delete_cookie(CSRF_TOKEN_COOKIE_NAME, path="/", secure=cookie_secure_flag, httponly=False, samesite="lax")
#     # Optionally delete OAUTH_STATE_COOKIE_NAME if it could be lingering, though its path is specific
#     # response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path="/api/auth/github/callback", ...)
#     logger.debug("Cleared auth cookies (access, refresh, csrf).")
