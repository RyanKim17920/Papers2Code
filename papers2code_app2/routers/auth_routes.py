from fastapi import APIRouter, Depends, status, Response, Request
from fastapi.responses import RedirectResponse, JSONResponse
import logging

from ..schemas.minimal import (
    UserSchema,
    TokenResponse,
    UserMinimal,
    CsrfToken,
    UserUpdateProfile,
)
from ..shared import config_settings
from ..auth import get_current_user # SECRET_KEY, ALGORITHM, create_refresh_token are used by service
from ..services.auth_service import AuthService
from ..services.github_oauth_service import GitHubOAuthService
from ..services.google_oauth_service import GoogleOAuthService
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
github_oauth_service = GitHubOAuthService()
google_oauth_service = GoogleOAuthService()

@router.get("/csrf-token", response_model=CsrfToken)
async def get_csrf_token(request: Request, response: Response):
    """
    Generate and return a CSRF token.
    
    Security Model:
    1. Token is set as an HttpOnly cookie (secure from XSS)
    2. Token is also returned in response body for X-CSRFToken header
    3. Backend validates both cookie and header match (double-submit pattern)
    
    This approach:
    - Prevents XSS theft via HttpOnly cookie
    - Prevents CSRF via double-submit validation
    - Works cross-domain with SameSite=None + Secure
    """
    csrf_token_value = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)
    
    # Always generate a fresh token if none exists or to rotate regularly
    if not csrf_token_value:
        csrf_token_value = auth_service.generate_csrf_token()
        logger.info(f"Generated new CSRF token for request from {request.client.host if request.client else 'unknown'}")
        
    is_production = config_settings.ENV_TYPE == "production"
    
    # Set cookie with secure cross-domain settings
    # SECURITY: HttpOnly prevents XSS access, SameSite=None + Secure allows cross-domain
    response.set_cookie(
        key=CSRF_TOKEN_COOKIE_NAME,
        value=csrf_token_value,
        httponly=True,  # SECURITY: Prevent JavaScript access to cookie (XSS protection)
        samesite="none" if is_production else "lax",  # none: cross-domain, lax: same-site dev
        secure=True if is_production else False,  # Required for SameSite=None
        path="/",
        max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        domain=None  # Let browser handle domain automatically for proper subdomain support
    )
    
    logger.info(
        f"CSRF token configured - Production: {is_production}, "
        f"SameSite: {'none' if is_production else 'lax'}, "
        f"Secure: {is_production}, HttpOnly: True"
    )
    
    # Return token in response body so frontend can send it in X-CSRFToken header
    # Using CsrfToken model ensures proper camelCase conversion via alias_generator
    return CsrfToken(csrf_token=csrf_token_value)

@router.get("/github/login")
async def github_login(request: Request): # Removed unused response: Response
    try:
        # This method now returns a RedirectResponse with the cookie set on it
        return github_oauth_service.prepare_github_login_redirect(request)
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
        return await github_oauth_service.handle_github_callback(code, state, request)
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


@router.get("/google/login")
async def google_login(request: Request):
    try:
        return google_oauth_service.prepare_google_login_redirect(request)
    except OAuthException as e:
        logger.error(f"OAuth login preparation failed: {e.message}")
        frontend_url = config_settings.FRONTEND_URL
        return RedirectResponse(f"{frontend_url}/?login_error=oauth_prepare_failed&detail={e.message}", status_code=307)
    except Exception as e:
        logger.error(f"Unexpected error during Google login initiation: {e}", exc_info=True)
        frontend_url = config_settings.FRONTEND_URL
        return RedirectResponse(f"{frontend_url}/?login_error=oauth_prepare_unexpected", status_code=307)


@router.get("/google/callback", name="google_callback_endpoint")
async def google_callback(code: str, state: str, request: Request):
    try:
        return await google_oauth_service.handle_google_callback(code, state, request)
    except Exception as e:
        logger.error(f"General unexpected error in Google callback router: {e}", exc_info=True)
        frontend_url = config_settings.FRONTEND_URL
        error_redirect = RedirectResponse(f"{frontend_url}/?login_error=callback_router_unexpected_error", status_code=307)
        error_redirect.delete_cookie(
            OAUTH_STATE_COOKIE_NAME, 
            httponly=True, 
            samesite="lax", 
            path="/api/auth/google/callback",
            secure=True if config_settings.ENV_TYPE == "production" else False
        )
        return error_redirect


@router.get("/me", response_model=UserMinimal)
async def get_current_user_api(current_user: UserSchema = Depends(get_current_user)):
    # Logic moved to AuthService.get_user_details
    # Ensure get_user_details returns a Pydantic model or a dict that matches UserMinimal
    user_details_model = auth_service.get_user_details(current_user)
    return user_details_model # FastAPI will serialize Pydantic model to JSON

@router.put("/me/profile", response_model=UserSchema)
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
    except Exception:
        logger.exception(
            f"Unexpected error updating profile for user_id: {current_user.id}"
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected error occurred."},
        )


@router.post("/refresh_token", response_model=TokenResponse)
async def refresh_access_token_route(request: Request, response: Response): # response needed to set cookie
    try:
        # AuthService.refresh_access_token now needs to set cookies on the passed 'response' object
        token_data_dict = await auth_service.refresh_access_token(request, response)
        # Ensure CSRF token is also refreshed/re-set if access token is refreshed
        csrf_token_value = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)
        if not csrf_token_value: # Or if you want to always refresh it alongside access token
            csrf_token_value = auth_service.generate_csrf_token()
        is_production = config_settings.ENV_TYPE == "production"
        response.set_cookie(
            key=CSRF_TOKEN_COOKIE_NAME,
            value=csrf_token_value,
            httponly=False,
            samesite="none" if is_production else "lax",
            secure=True if is_production else False,
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

@router.post("/link-accounts")
async def link_accounts(request: Request, response: Response):
    """
    Links two accounts (GitHub and Google) when user confirms the merge.
    Expects pending_token in the request body.
    """
    try:
        body = await request.json()
        pending_token = body.get("pending_token")
        
        if not pending_token:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Missing pending_token"}
            )
        
        # Decode the pending token
        try:
            from jose import jwt, JWTError
            from datetime import datetime, timezone
            pending_data = jwt.decode(pending_token, config_settings.FLASK_SECRET_KEY, algorithms=[config_settings.ALGORITHM])
            
            # Check expiration
            if pending_data.get("exp") and datetime.now(timezone.utc).timestamp() > pending_data.get("exp"):
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": "Link token expired. Please log in again."}
                )
        except JWTError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Invalid link token"}
            )
        
        # Perform the account linking based on which provider initiated
        from ..database import get_users_collection_async
        from bson import ObjectId
        from ..auth.token_utils import create_access_token, create_refresh_token
        from ..constants import ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME
        from datetime import timedelta
        from pymongo import ReturnDocument
        
        users_collection = await get_users_collection_async()
        existing_user_id = ObjectId(pending_data["existing_user_id"])
        current_time = datetime.now(timezone.utc)
        
        # Determine which account is being linked
        if "google_id" in pending_data:
            # Linking Google to existing GitHub account
            google_id = pending_data["google_id"]
            google_avatar = pending_data["google_avatar"]
            google_email = pending_data["google_email"]
            
            # Get existing user's avatar
            existing_user = await users_collection.find_one({"_id": existing_user_id})
            github_avatar = existing_user.get("githubAvatarUrl")
            
            update_payload = {
                "googleId": google_id,
                "googleAvatarUrl": google_avatar,
                "avatarUrl": github_avatar or google_avatar,  # Default to GitHub avatar
                "preferredAvatarSource": "github",
                "email": google_email,
                "updatedAt": current_time,
                "lastLoginAt": current_time,
            }
            
            user_document = await users_collection.find_one_and_update(
                {"_id": existing_user_id},
                {"$set": update_payload},
                return_document=ReturnDocument.AFTER
            )
            
            # Create tokens
            access_token_payload = {
                "sub": str(user_document["_id"]),
                "username": user_document["username"],
                "googleId": google_id,
            }
        else:
            # Linking GitHub to existing Google account
            github_id = pending_data["github_id"]
            github_avatar = pending_data["github_avatar"]
            github_username = pending_data["github_username"]
            github_token = pending_data["github_token"]
            github_email = pending_data["github_email"]
            github_name = pending_data["github_name"]
            
            # Get existing user's avatar
            existing_user = await users_collection.find_one({"_id": existing_user_id})
            google_avatar = existing_user.get("googleAvatarUrl")
            
            update_payload = {
                "githubId": github_id,
                "githubAvatarUrl": github_avatar,
                "githubAccessToken": github_token,
                "avatarUrl": github_avatar or google_avatar,  # Default to GitHub avatar
                "preferredAvatarSource": "github",
                "username": github_username,  # Update to GitHub username
                "name": github_name,
                "email": github_email,
                "updatedAt": current_time,
                "lastLoginAt": current_time,
            }
            
            user_document = await users_collection.find_one_and_update(
                {"_id": existing_user_id},
                {"$set": update_payload},
                return_document=ReturnDocument.AFTER
            )
            
            # Create tokens
            access_token_payload = {
                "sub": str(user_document["_id"]),
                "username": user_document["username"],
                "githubId": github_id,
            }
        
        access_token = create_access_token(data=access_token_payload)
        refresh_token_payload = {"sub": str(user_document["_id"])}
        refresh_token = create_refresh_token(data=refresh_token_payload, expires_delta=timedelta(minutes=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES))
        
        # Set cookies
        is_production = config_settings.ENV_TYPE == "production"
        samesite_setting = "none" if is_production else "lax"
        json_response = JSONResponse(content={"detail": "Accounts linked successfully"})
        json_response.set_cookie(
            key=ACCESS_TOKEN_COOKIE_NAME,
            value=access_token,
            httponly=True,
            samesite=samesite_setting,
            secure=True if is_production else False,
            path="/",
            max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        json_response.set_cookie(
            key=REFRESH_TOKEN_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            samesite=samesite_setting,
            secure=True if is_production else False,
            path="/",
            max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60
        )
        
        return json_response
        
    except Exception as e:
        logger.error(f"Error linking accounts: {e}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Failed to link accounts"}
        )


@router.post("/logout")
async def logout_user_route(request: Request, response: Response): # response needed to clear cookies
    try:
        # This call to auth_service.logout_user internally calls auth_service.clear_auth_cookies(response),
        # which will add headers to the 'response' object to delete the old cookies, including the old CSRF cookie.
        await auth_service.logout_user(request, response) 

        # Generate a new CSRF token after old ones are marked for deletion
        new_csrf_token_value = auth_service.generate_csrf_token()
        
        # Set the new CSRF token cookie on the same response object.
        # Starlette should handle multiple Set-Cookie headers, including delete and then set for the same cookie name if necessary.
        is_production = config_settings.ENV_TYPE == "production"
        response.set_cookie(
            key=CSRF_TOKEN_COOKIE_NAME,
            value=new_csrf_token_value,
            httponly=False, 
            samesite="none" if is_production else "lax",
            secure=True if is_production else False,
            path="/", # Ensure path is consistent with where it's used/expected
            max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60 # Or a suitable duration for a 'logged-out' token
        )
        
        # Return the new CSRF token in the response body so the frontend can store it.
        # Using camelCase "csrfToken" for consistency with frontend expectations.
        return {"message": "Logout successful", "csrfToken": new_csrf_token_value}

    except Exception as e:
        logger.error(f"Error during logout process: {e}", exc_info=True)
        # Even if logout service fails, try to clear cookies on a new response
        # Create a new JSONResponse for the error to avoid modifying the original 'response' object
        # which might be in an inconsistent state.
        error_response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An error occurred during logout."}
        )
        # Attempt to clear auth cookies on this new error_response.
        # This ensures that if the main logout logic failed before clearing cookies,
        # we still make an attempt to clear them.
        auth_service.clear_auth_cookies(error_response) 
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
