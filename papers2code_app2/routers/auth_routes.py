from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from pymongo import ReturnDocument
from datetime import datetime, timedelta
import requests
import uuid
from jose import jwt, JWTError

from ..schemas import User as UserSchema, TokenResponse
from ..schemas import UserResponse
from ..shared import get_users_collection_sync, config_settings
from ..auth import create_access_token, get_current_user, SECRET_KEY, ALGORITHM, create_refresh_token

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)

OAUTH_STATE_COOKIE_NAME = "oauth_state_token"

@router.get("/github/login")
async def github_login(request: Request, response: Response):
    """
    Redirects the user to GitHub for authentication.
    A state parameter is generated, signed into a JWT, stored in an HttpOnly cookie,
    and also sent to GitHub to prevent CSRF attacks.
    """
    state_value = str(uuid.uuid4())
    print(f"Generated OAuth state value: {state_value}")

    # Create a short-lived JWT for the state
    state_token_payload = {"state_val": state_value, "sub": "oauth_state_marker"}
    state_jwt = create_access_token(data=state_token_payload, expires_delta=timedelta(minutes=10))

    github_authorize_url = getattr(config_settings, 'GITHUB_AUTHORIZE_URL', "https://github.com/login/oauth/authorize")
    github_client_id = getattr(config_settings, 'GITHUB_CLIENT_ID', None)
    github_scope = getattr(config_settings, 'GITHUB_SCOPE', "user:email")
    
    if not github_client_id:
        raise HTTPException(status_code=500, detail="GitHub client ID not configured.")

    try:
        redirect_uri = str(request.url_for('github_callback_endpoint'))
    except Exception as e:
        print(f"Warning: request.url_for failed: {e}. Using placeholder redirect URI.")
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = f"{base_url}{router.prefix}/github/callback"

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
        path=f"{router.prefix}/github/callback"
    )
    return redirect_response

@router.get("/github/callback", name="github_callback_endpoint")
async def github_callback(code: str, state: str, request: Request):
    """
    Handles the callback from GitHub after authentication.
    Verifies the state parameter against the signed state in the cookie.
    Exchanges the authorization code for an access token, fetches user info,
    and creates/updates the user in the database, then returns a JWT for the user.
    """
    print(f"Received OAuth callback with GitHub state: {state}, code: {code}")

    state_jwt_from_cookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
    frontend_url = getattr(config_settings, 'FRONTEND_URL', "/")

    if not state_jwt_from_cookie:
        print("Error: OAuth state cookie not found.")
        return RedirectResponse(f"{frontend_url}/?login_error=state_cookie_missing")

    try:
        payload = jwt.decode(state_jwt_from_cookie, SECRET_KEY, algorithms=[ALGORITHM])
        expected_state = payload.get("state_val")
        if not expected_state or expected_state != state:
            print(f"Error: Invalid OAuth state. Cookie state: '{expected_state}', GitHub state: '{state}'")
            error_response = RedirectResponse(f"{frontend_url}/?login_error=state_mismatch")
            error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=f"{router.prefix}/github/callback")
            return error_response
        print("OAuth state successfully verified.")
    except JWTError as e:
        print(f"Error decoding OAuth state JWT: {e}")
        error_response = RedirectResponse(f"{frontend_url}/?login_error=state_decode_error")
        error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=f"{router.prefix}/github/callback")
        return error_response

    github_access_token_url = getattr(config_settings, 'GITHUB_ACCESS_TOKEN_URL', "https://github.com/login/oauth/access_token")
    github_client_id = getattr(config_settings, 'GITHUB_CLIENT_ID', None)
    github_client_secret = getattr(config_settings, 'GITHUB_CLIENT_SECRET', None)
    github_api_user_url = getattr(config_settings, 'GITHUB_API_USER_URL', "https://api.github.com/user")

    if not github_client_id or not github_client_secret:
        raise HTTPException(status_code=500, detail="GitHub client credentials not configured.")

    if not code:
        print("Error: No code provided by GitHub")
        error_response = RedirectResponse(f"{frontend_url}/?login_error=no_code")
        error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=f"{router.prefix}/github/callback")
        return error_response

    try:
        actual_redirect_uri = str(request.url_for('github_callback_endpoint'))
    except Exception:
        base_url = str(request.base_url).rstrip('/')
        actual_redirect_uri = f"{base_url}{router.prefix}/github/callback"

    try:
        token_response = requests.post(
            github_access_token_url,
            headers={'Accept': 'application/json'},
            data={
                'client_id': github_client_id,
                'client_secret': github_client_secret,
                'code': code,
                'redirect_uri': actual_redirect_uri
            },
            timeout=10
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        github_access_token = token_data.get('access_token')
        if not github_access_token:
            print(f"Error getting GitHub access token: {token_data.get('error_description', 'No access token')}")
            error_response = RedirectResponse(f"{frontend_url}/?login_error=token_exchange_failed")
            error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=f"{router.prefix}/github/callback")
            return error_response
    except requests.exceptions.RequestException as e:
        print(f"Error requesting GitHub access token: {e}")
        error_response = RedirectResponse(f"{frontend_url}/?login_error=token_request_error")
        error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=f"{router.prefix}/github/callback")
        return error_response

    try:
        user_response = requests.get(
            github_api_user_url,
            headers={
                'Authorization': f'token {github_access_token}',
                'Accept': 'application/vnd.github.v3+json'
            },
            timeout=10
        )
        user_response.raise_for_status()
        user_data = user_response.json()
        github_id = user_data.get('id')
        if not github_id:
             print("Error: GitHub user data missing ID")
             error_response = RedirectResponse(f"{frontend_url}/?login_error=github_id_missing")
             error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=f"{router.prefix}/github/callback")
             return error_response

        users_collection = get_users_collection_sync()
        user_doc = users_collection.find_one_and_update(
            {'githubId': github_id},
            {'$set': {
                'username': user_data.get('login'),
                'avatarUrl': user_data.get('avatar_url'),
                'name': user_data.get('name'),
                'email': user_data.get('email'),
                'lastLogin': datetime.utcnow()
             },
             '$setOnInsert': {
                'githubId': github_id,
                'createdAt': datetime.utcnow()
             }},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        user_internal_id = str(user_doc['_id'])
        print(f"User '{user_doc['username']}' (ID: {user_internal_id}) upserted into DB.")

        api_access_token_expires = timedelta(minutes=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        api_access_token = create_access_token(
            data={"sub": user_doc["username"]}, expires_delta=api_access_token_expires
        )
        api_refresh_token_expires = timedelta(minutes=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        api_refresh_token = create_refresh_token(
            data={"sub": user_doc["username"]}, expires_delta=api_refresh_token_expires
        )

        final_response = RedirectResponse(url=f"{frontend_url}/?login_success=true")
        final_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=f"{router.prefix}/github/callback")
        
        final_response.set_cookie(
            key="refresh_token", 
            value=api_refresh_token, 
            httponly=True, 
            samesite="lax",
            max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
            path="/auth/refresh_token"
        )
        final_response.headers["Location"] = f"{frontend_url}/?login_success=true&access_token={api_access_token}"

        return final_response
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching user info from GitHub: {e}")
        error_response = RedirectResponse(f"{frontend_url}/?login_error=user_fetch_failed")
        error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=f"{router.prefix}/github/callback")
        return error_response
    except Exception as e:
        print(f"An unexpected error occurred during GitHub callback: {e}")
        error_response = RedirectResponse(f"{frontend_url}/?login_error=unknown")
        error_response.delete_cookie(OAUTH_STATE_COOKIE_NAME, httponly=True, samesite="lax", path=f"{router.prefix}/github/callback")
        return error_response

@router.get("/me", response_model=UserResponse) 
async def get_current_user_api(current_user: UserSchema = Depends(get_current_user)):
    """
    Returns the currently authenticated user's information.
    """
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    owner_username = getattr(config_settings, 'OWNER_GITHUB_USERNAME', None)
    is_owner = owner_username is not None and current_user.username == owner_username
    
    user_data = current_user.model_dump() if hasattr(current_user, 'model_dump') else dict(current_user)
    final_user_data = {
        "id": user_data.get("id") or user_data.get("_id"),
        "githubId": user_data.get("githubId"),
        "username": user_data.get("username"),
        "avatarUrl": user_data.get("avatarUrl"),
        "name": user_data.get("name"),
        "email": user_data.get("email"),
        "lastLogin": user_data.get("lastLogin"),
        "createdAt": user_data.get("createdAt"),
        "isOwner": is_owner
    }
    return UserResponse(**final_user_data)

@router.post("/refresh_token", response_model=TokenResponse)
async def refresh_access_token(request: Request, response: Response):
    refresh_token_from_cookie = request.cookies.get("refresh_token")

    if not refresh_token_from_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    try:
        payload = jwt.decode(refresh_token_from_cookie, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        token_type: str = payload.get("token_type")

        if not username or token_type != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        users_collection = get_users_collection_sync()
        user = users_collection.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        new_access_token_expires = timedelta(minutes=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            data={"sub": username}, expires_delta=new_access_token_expires
        )
        
        return TokenResponse(access_token=new_access_token, token_type="bearer")

    except JWTError:
        response.delete_cookie("refresh_token", httponly=True, samesite="lax", path="/auth/refresh_token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token", httponly=True, samesite="lax", path="/auth/refresh_token")
    return {"message": "Successfully logged out"}
