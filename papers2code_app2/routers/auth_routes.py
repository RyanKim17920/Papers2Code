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

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)

OAUTH_STATE_COOKIE_NAME = "oauth_state_token"
ACCESS_TOKEN_COOKIE_NAME = "access_token_cookie"
REFRESH_TOKEN_COOKIE_NAME = "refresh_token"
CSRF_TOKEN_COOKIE_NAME = "csrf_token_cookie"
CSRF_TOKEN_HEADER_NAME = "X-CSRFToken"

@router.get("/csrf-token", response_model=CsrfToken)
async def get_csrf_token(request: Request, response: Response):
    csrf_token_value = secrets.token_hex(32)
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
    state_value = str(uuid.uuid4())
    state_token_payload = {"state_val": state_value, "sub": "oauth_state_marker"}
    state_jwt = create_access_token(data=state_token_payload, expires_delta=timedelta(minutes=10))

    github_authorize_url = config_settings.GITHUB.AUTHORIZE_URL
    github_client_id = config_settings.GITHUB.CLIENT_ID
    github_scope = config_settings.GITHUB.SCOPE
    
    if github_client_id is None:
        logger.error("GITHUB.CLIENT_ID is not found in configuration (is None). Check .env file or environment variables.")
        raise HTTPException(status_code=500, detail="Authentication service is misconfigured (GitHub Client ID not set).")
    elif not github_client_id: # Catches empty string ""
        logger.error("GITHUB.CLIENT_ID is configured but is an empty string. Check .env file.")
        raise HTTPException(status_code=500, detail="Authentication service is misconfigured (GitHub Client ID is empty).")

    try:
        redirect_uri = str(request.url_for('github_callback_endpoint'))
        if not str(redirect_uri).startswith("http"):
            base_url = str(request.base_url).rstrip('/')
            redirect_uri = f"{base_url}{router.prefix}/github/callback"
    except Exception as e:
        logger.error(f"Error constructing redirect_uri: {e}")
        raise HTTPException(status_code=500, detail="Error preparing authentication request.")

    auth_url = (
        f"{github_authorize_url}?"
        f"client_id={github_client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={github_scope}&"
        f"state={state_value}"
    )
    
    redirect_response = RedirectResponse(auth_url)
    redirect_response.set_cookie(
        key=OAUTH_STATE_COOKIE_NAME,
        value=state_jwt,
        httponly=True,
        samesite="lax",
        max_age=600,
        path="/api/auth/github/callback",
        secure=True if config_settings.ENV_TYPE == "production" else False
    )
    return redirect_response

@router.get("/github/callback", name="github_callback_endpoint")
async def github_callback(code: str, state: str, request: Request):
    state_jwt_from_cookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
    frontend_url = config_settings.FRONTEND_URL
    callback_path = "/api/auth/github/callback"

    if not state_jwt_from_cookie:
        logger.warning("OAuth state cookie not found.")
        error_response = RedirectResponse(f"{frontend_url}/?login_error=state_cookie_missing")
        error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
        return error_response

    try:
        payload = jwt.decode(state_jwt_from_cookie, SECRET_KEY, algorithms=[ALGORITHM])
        expected_state = payload.get("state_val")
        if not expected_state or expected_state != state:
            logger.warning(f"OAuth state mismatch. Expected: '{expected_state}', Got: '{state}'.")
            error_response = RedirectResponse(f"{frontend_url}/?login_error=state_mismatch")
            error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
            return error_response
    except JWTError as jwt_exc:
        logger.error(f"OAuth state JWT validation error: {jwt_exc}")
        error_response = RedirectResponse(f"{frontend_url}/?login_error=state_decode_error")
        error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
        return error_response

    github_access_token_url = config_settings.GITHUB.ACCESS_TOKEN_URL
    github_client_id = config_settings.GITHUB.CLIENT_ID
    github_client_secret = config_settings.GITHUB.CLIENT_SECRET
    github_api_user_url = config_settings.GITHUB.API_USER_URL

    # Specific logging for configuration issues
    if github_client_id is None:
        logger.error("GitHub OAuth Callback: GITHUB.CLIENT_ID is not found in configuration (is None). Check .env file or environment variables.")
    elif not github_client_id: # Empty string
        logger.error("GitHub OAuth Callback: GITHUB.CLIENT_ID is configured but is an empty string. Check .env file.")

    if github_client_secret is None:
        logger.error("GitHub OAuth Callback: GITHUB.CLIENT_SECRET is not found in configuration (is None). Check .env file or environment variables.")
    elif not github_client_secret: # Empty string
        logger.error("GitHub OAuth Callback: GITHUB.CLIENT_SECRET is configured but is an empty string. Check .env file.")

    if not github_client_id or not github_client_secret:
        logger.error("GitHub client ID or secret not configured or empty for callback. Check .env file.") # Updated general log
        error_response = RedirectResponse(f"{frontend_url}/?login_error=auth_misconfigured")
        error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
        return error_response

    if not code:
        logger.warning("No authorization code received from GitHub.")
        error_response = RedirectResponse(f"{frontend_url}/?login_error=no_code")
        error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
        return error_response

    try:
        actual_redirect_uri = str(request.url_for('github_callback_endpoint'))
    except Exception:
        base_url = str(request.base_url).rstrip('/')
        actual_redirect_uri = f"{base_url}{router.prefix}/github/callback"

    async with httpx.AsyncClient() as client:
        try:
            token_params = {
                "client_id": github_client_id,
                "client_secret": github_client_secret,
                "code": code,
                "redirect_uri": actual_redirect_uri,
            }
            token_headers = {"Accept": "application/json"}
            token_response = await client.post(
                github_access_token_url, data=token_params, headers=token_headers
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            github_token = token_data.get("access_token")

            if not github_token:
                logger.error("GitHub OAuth: Access token not found in response from GitHub.")
                error_response = RedirectResponse(f"{frontend_url}/?login_error=github_token_exchange_failed")
                error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
                return error_response

            user_api_headers = {
                "Authorization": f"token {github_token}",
                "Accept": "application/vnd.github.v3+json",
            }
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
                    if not primary_email:
                        for email_info in emails_data:
                            if email_info.get("verified"):
                                primary_email = email_info.get("email")
                                break
                else:
                    logger.warning(f"Could not fetch emails for user {github_user_data.get('login')}, status: {emails_response.status_code}")

            users_collection = get_users_collection_sync()
            current_time_utc = datetime.now(timezone.utc)

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
                logger.error(f"Failed to create or update user {github_user_data['login']} in database.")
                error_response = RedirectResponse(f"{frontend_url}/?login_error=database_user_op_failed")
                error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
                return error_response

            access_token_payload = {
                "sub": str(user_doc["_id"]),
                "username": user_doc["username"],
                "github_id": user_doc.get("githubId"),
            }
            access_token = create_access_token(data=access_token_payload)
            refresh_token_payload = {"sub": str(user_doc["_id"])}
            refresh_token = create_refresh_token(data=refresh_token_payload)

            final_response = RedirectResponse(url=f"{frontend_url}/?login_success=true")
            final_response.set_cookie(
                key=ACCESS_TOKEN_COOKIE_NAME, value=access_token, httponly=True, samesite="lax",
                max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/",
                secure=True if config_settings.ENV_TYPE == "production" else False
            )
            final_response.set_cookie(
                key=REFRESH_TOKEN_COOKIE_NAME, value=refresh_token, httponly=True, samesite="lax",
                max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60, path="/api/auth/refresh_token",
                secure=True if config_settings.ENV_TYPE == "production" else False
            )
            final_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
            return final_response

        except httpx.HTTPStatusError as http_err:
            logger.error(f"HTTP error occurred during GitHub OAuth callback: {http_err} - Response: {http_err.response.text if http_err.response else 'No response text'}")
            error_code = "github_http_error"
            if http_err.response and http_err.response.status_code == 401:
                error_code = "github_unauthorized"
            error_response = RedirectResponse(f"{frontend_url}/?login_error={error_code}")
            error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
            return error_response
        except httpx.RequestError as req_exc:
            logger.error(f"Request to GitHub failed: {req_exc}")
            error_response = RedirectResponse(f"{frontend_url}/?login_error=github_request_failed")
            error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
            return error_response
        except Exception as gen_exc:
            logger.error(f"General error in GitHub callback: {gen_exc}", exc_info=True)
            error_response = RedirectResponse(f"{frontend_url}/?login_error=callback_processing_error")
            error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=callback_path, secure=True if config_settings.ENV_TYPE == "production" else False)
            return error_response

@router.get("/me")
async def get_current_user_api(current_user: UserSchema = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    owner_username = config_settings.OWNER_GITHUB_USERNAME 
    is_owner = owner_username is not None and current_user.username == owner_username
    
    logger.info(f"User {current_user.username} is_owner status: {is_owner}")

    user_response_data = UserMinimal(
        id=str(current_user.id),
        username=current_user.username,
        name=current_user.name,
        avatar_url=str(current_user.avatar_url) if current_user.avatar_url else None,
        is_owner=is_owner,
        is_admin=getattr(current_user, 'is_admin', False)
    )
    
    return JSONResponse(content=user_response_data.model_dump(by_alias=True, mode="json"))

@router.post("/refresh_token", response_model=TokenResponse)
async def refresh_access_token(request: Request, response: Response):
    refresh_token_value = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found")

    try:
        payload = jwt.decode(refresh_token_value, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_from_token = payload.get("sub")
        if user_id_from_token is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token: no subject")

        users_collection = get_users_collection_sync()
        user_doc = users_collection.find_one({"_id": ObjectId(user_id_from_token)})
        if not user_doc:
            logout_response = JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "User not found for refresh token. Please log in again."}
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
        return TokenResponse(access_token=new_access_token, token_type="bearer")

    except JWTError as jwt_exc:
        logger.warning(f"Refresh token validation error: {jwt_exc}")
        logout_response = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid or expired refresh token. Please log in again."}
        )
        logout_response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME,
            path="/api/auth/refresh_token",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        return logout_response
    except InvalidId:
        logger.error(f"Invalid ObjectId format for user_id from refresh token: {user_id_from_token if 'user_id_from_token' in locals() else 'unknown'}")
        logout_response = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid user identifier in refresh token. Please log in again."}
        )
        logout_response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME,
            path="/api/auth/refresh_token",
            secure=True if config_settings.ENV_TYPE == "production" else False,
            httponly=True,
            samesite="lax"
        )
        return logout_response
    except Exception as e:
        logger.error(f"Error during token refresh: {e}", exc_info=True)
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
        return logout_response

@router.post("/logout", summary="Logout user")
async def logout(response: Response):
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
    return {"message": "Logout successful"}
