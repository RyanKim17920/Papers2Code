"""
Dex OAuth Service - Adapter for Development Environment
Provides a unified interface to use Dex as an OIDC provider instead of direct GitHub/Google OAuth
Matches the same interface as GitHubOAuthService and GoogleOAuthService for drop-in compatibility
"""

import httpx
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from urllib.parse import urlencode
from fastapi import Request
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from bson import ObjectId
from pymongo import ReturnDocument

from ..database import get_users_collection_async
from ..schemas.minimal import UserSchema
from ..shared import config_settings
from ..auth.token_utils import create_access_token, create_refresh_token
from ..constants import (
    ACCESS_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME,
    OAUTH_STATE_COOKIE_NAME,
    CSRF_TOKEN_COOKIE_NAME,
)
from .exceptions import (
    OAuthException,
    OAuthStateMissingException,
    OAuthStateMismatchException,
    DatabaseOperationException,
)

logger = logging.getLogger(__name__)


class DexOAuthService:
    """
    Service to handle OAuth flows through Dex in development environments.
    Dex acts as a unified OIDC provider that can federate to multiple backends.
    Drop-in replacement for GitHubOAuthService/GoogleOAuthService when USE_DEX_OAUTH=true
    """
    
    def __init__(self):
        self.users_collection = None
        # Use more robust fallbacks: if the config attribute exists but is None/empty
        # we explicitly fall back to sensible development defaults. `getattr` alone
        # only applies the default when the attribute is missing which does not
        # cover the common case where the attribute exists but was left unset.
        self.dex_issuer = getattr(config_settings, 'DEX_ISSUER_URL', None) or 'http://localhost:5556/dex'
        self.client_id = getattr(config_settings, 'DEX_CLIENT_ID', None) or 'papers2code-backend'
        self.client_secret = getattr(config_settings, 'DEX_CLIENT_SECRET', None) or 'dev-client-secret'
        
        # OIDC endpoints
        self.authorize_url = f"{self.dex_issuer}/auth"
        self.token_url = f"{self.dex_issuer}/token"
        self.userinfo_url = f"{self.dex_issuer}/userinfo"
        
    async def _init_collections(self):
        """Initialize database collections"""
        if self.users_collection is None:
            self.users_collection = await get_users_collection_async()
    
    def prepare_github_login_redirect(self, request: Request) -> RedirectResponse:
        """
        Prepare GitHub OAuth login redirect to Dex (matching GitHubOAuthService interface)
        """
        return self._prepare_login_redirect(request, provider="github")
    
    def prepare_google_login_redirect(self, request: Request) -> RedirectResponse:
        """
        Prepare Google OAuth login redirect to Dex (matching GoogleOAuthService interface)
        """
        return self._prepare_login_redirect(request, provider="google")
    
    def _prepare_login_redirect(self, request: Request, provider: str) -> RedirectResponse:
        """
        Internal method to prepare OAuth login redirect to Dex
        """
        try:
            # Generate state token for CSRF protection
            state_value = str(uuid.uuid4())
            state_token_payload = {
                "state_val": state_value,
                "provider": provider,
                "sub": "oauth_state_marker",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
            }
            
            state_jwt = jwt.encode(
                state_token_payload,
                config_settings.FLASK_SECRET_KEY,
                algorithm=config_settings.ALGORITHM
            )
            
            # Determine callback URL based on provider
            if provider == "github":
                try:
                    callback_url = str(request.url_for("github_callback_endpoint"))
                except Exception:
                    base_url = str(request.base_url).rstrip('/')
                    callback_url = f"{base_url}/api/auth/github/callback"
                oauth_state_cookie_path = "/api/auth/github/callback"
            elif provider == "google":
                try:
                    callback_url = str(request.url_for("google_callback_endpoint"))
                except Exception:
                    base_url = str(request.base_url).rstrip('/')
                    callback_url = f"{base_url}/api/auth/google/callback"
                oauth_state_cookie_path = "/api/auth/google/callback"
            else:
                raise OAuthException(f"Unknown provider: {provider}")
            
            # Build Dex authorization URL
            auth_params = {
                "client_id": self.client_id,
                "redirect_uri": callback_url,
                "response_type": "code",
                "scope": "openid email profile groups",
                "state": state_value,
            }
            
            auth_url = f"{self.authorize_url}?{urlencode(auth_params)}"
            
            logger.info(f"Redirecting to Dex for {provider} login: {auth_url}")
            
            # Set state cookie
            response = RedirectResponse(url=auth_url, status_code=307)
            
            is_production = config_settings.ENV_TYPE == "production"
            response.set_cookie(
                key=OAUTH_STATE_COOKIE_NAME,
                value=state_jwt,
                httponly=True,
                samesite="none" if is_production else "lax",
                secure=True if is_production else False,
                path=oauth_state_cookie_path,
                max_age=600,
            )
            
            return response
            
        except OAuthException:
            raise
        except Exception as e:
            logger.error(f"Error preparing Dex login redirect: {e}", exc_info=True)
            raise OAuthException(f"Failed to prepare OAuth login: {str(e)}")
    
    async def handle_github_callback(self, code: str, state_from_query: str, request: Request) -> RedirectResponse:
        """
        Handle GitHub OAuth callback from Dex (matching GitHubOAuthService interface)
        """
        return await self._handle_callback(code, state_from_query, request, provider="github")
    
    async def handle_google_callback(self, code: str, state_from_query: str, request: Request) -> RedirectResponse:
        """
        Handle Google OAuth callback from Dex (matching GoogleOAuthService interface)
        """
        return await self._handle_callback(code, state_from_query, request, provider="google")
    
    async def _handle_callback(self, code: str, state_from_query: str, request: Request, provider: str) -> RedirectResponse:
        """
        Internal method to handle OAuth callback from Dex
        """
        await self._init_collections()
        
        frontend_url = config_settings.FRONTEND_URL
        oauth_state_cookie_path = f"/api/auth/{provider}/callback"
        
        # Get state cookie
        state_jwt_from_cookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
        
        if not state_jwt_from_cookie:
            logger.warning("OAuth state cookie missing")
            return RedirectResponse(url=f"{frontend_url}/?login_error=state_cookie_missing", status_code=307)
        
        # Validate state
        try:
            payload = jwt.decode(
                state_jwt_from_cookie,
                config_settings.FLASK_SECRET_KEY,
                algorithms=[config_settings.ALGORITHM]
            )
            state_val_from_cookie = payload.get("state_val")
            
            if state_val_from_cookie != state_from_query:
                logger.warning("OAuth state mismatch")
                response = RedirectResponse(url=f"{frontend_url}/?login_error=state_mismatch", status_code=307)
                response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
                return response
                
        except JWTError as e:
            logger.error(f"JWT validation error: {e}")
            response = RedirectResponse(url=f"{frontend_url}/?login_error=invalid_state", status_code=307)
            response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
            return response
        
        # Exchange code for tokens
        try:
            token_data = await self._exchange_code_for_token(code, request, provider)
        except Exception as e:
            logger.error(f"Token exchange failed: {e}")
            response = RedirectResponse(url=f"{frontend_url}/?login_error=token_exchange_failed", status_code=307)
            response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
            return response
        
        # Get user info from Dex
        try:
            user_info = await self._get_user_info(token_data["access_token"])
        except Exception as e:
            logger.error(f"Failed to get user info: {e}")
            response = RedirectResponse(url=f"{frontend_url}/?login_error=user_info_failed", status_code=307)
            response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
            return response
        
        # Format user data to match GitHub/Google format
        formatted_user_data = self._format_user_data(user_info, provider)
        
        # Create or update user in database
        try:
            user_doc = await self._create_or_update_user(formatted_user_data, provider)
        except Exception as e:
            logger.error(f"Database operation failed: {e}")
            response = RedirectResponse(url=f"{frontend_url}/?login_error=db_error", status_code=307)
            response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
            return response
        
        # Create tokens
        user_id_str = str(user_doc["_id"])
        access_token = create_access_token(data={"sub": user_id_str})
        refresh_token = create_refresh_token(data={"sub": user_id_str})
        
        # Generate CSRF token
        csrf_token = self._generate_csrf_token()
        
        # Create success response
        response = RedirectResponse(url=frontend_url, status_code=307)
        
        is_production = config_settings.ENV_TYPE == "production"
        
        # Set cookies
        response.set_cookie(
            key=ACCESS_TOKEN_COOKIE_NAME,
            value=access_token,
            httponly=True,
            samesite="none" if is_production else "lax",
            secure=True if is_production else False,
            path="/",
            max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        
        response.set_cookie(
            key=REFRESH_TOKEN_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            samesite="none" if is_production else "lax",
            secure=True if is_production else False,
            path="/",
            max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        )
        
        response.set_cookie(
            key=CSRF_TOKEN_COOKIE_NAME,
            value=csrf_token,
            httponly=True,
            samesite="none" if is_production else "lax",
            secure=True if is_production else False,
            path="/",
            max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        
        # Delete state cookie
        response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
        
        logger.info(f"Successfully authenticated user {user_id_str} via Dex ({provider})")
        
        return response
    
    async def _exchange_code_for_token(self, code: str, request: Request, provider: str) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        if provider == "github":
            callback_url = str(request.url_for("github_callback_endpoint"))
        else:
            callback_url = str(request.url_for("google_callback_endpoint"))
        
        token_params = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": callback_url,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data=token_params,
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()
            return response.json()
    
    async def _get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from Dex userinfo endpoint"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    def _format_user_data(self, user_info: Dict[str, Any], provider: str) -> Dict[str, Any]:
        """
        Format Dex user info to match GitHub/Google format
        Makes it transparent to the rest of the application
        """
        # Dex returns standard OIDC claims
        formatted = {
            "id": user_info.get("sub"),  # Subject (unique user ID)
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "email_verified": user_info.get("email_verified", True),
        }
        
        # Add provider-specific fields
        if provider == "github":
            # Mimic GitHub user structure
            username = user_info.get("preferred_username") or user_info.get("email", "").split("@")[0]
            formatted.update({
                "login": username,
                "avatar_url": user_info.get("picture", "https://via.placeholder.com/150?text=Dev"),
                "html_url": f"https://github.com/{username}",  # Fake URL for consistency
            })
        elif provider == "google":
            # Mimic Google user structure
            formatted.update({
                "picture": user_info.get("picture", "https://via.placeholder.com/150?text=Dev"),
                "verified_email": user_info.get("email_verified", True),
            })
        
        return formatted
    
    async def _create_or_update_user(self, user_data: Dict[str, Any], provider: str) -> Dict[str, Any]:
        """Create or update user in database"""
        email = user_data.get("email")
        
        if provider == "github":
            github_id = user_data.get("id")
            github_username = user_data.get("login")
            
            # Try to find existing user by GitHub ID or email
            existing_user = await self.users_collection.find_one({
                "$or": [
                    {"githubId": github_id},
                    {"email": email}
                ]
            })
            
            if existing_user:
                # Update existing user
                update_fields = {
                    "githubUsername": github_username,
                    "githubId": github_id,
                    "displayName": user_data.get("name", github_username),
                    "avatarUrl": user_data.get("avatar_url"),
                    "email": email,
                }
                
                updated_user = await self.users_collection.find_one_and_update(
                    {"_id": existing_user["_id"]},
                    {"$set": update_fields},
                    return_document=ReturnDocument.AFTER
                )
                return updated_user
            else:
                # Create new user
                new_user = {
                    "githubId": github_id,
                    "githubUsername": github_username,
                    "email": email,
                    "displayName": user_data.get("name", github_username),
                    "avatarUrl": user_data.get("avatar_url"),
                    "bio": None,
                    "createdAt": datetime.utcnow(),
                    "isAdmin": False,
                }
                
                result = await self.users_collection.insert_one(new_user)
                new_user["_id"] = result.inserted_id
                return new_user
                
        elif provider == "google":
            google_id = user_data.get("id")
            
            # Try to find existing user by Google ID or email
            existing_user = await self.users_collection.find_one({
                "$or": [
                    {"googleId": google_id},
                    {"email": email}
                ]
            })
            
            if existing_user:
                # Update existing user
                update_fields = {
                    "googleId": google_id,
                    "displayName": user_data.get("name"),
                    "avatarUrl": user_data.get("picture"),
                    "email": email,
                }
                
                updated_user = await self.users_collection.find_one_and_update(
                    {"_id": existing_user["_id"]},
                    {"$set": update_fields},
                    return_document=ReturnDocument.AFTER
                )
                return updated_user
            else:
                # Create new user
                new_user = {
                    "googleId": google_id,
                    "email": email,
                    "displayName": user_data.get("name"),
                    "avatarUrl": user_data.get("picture"),
                    "bio": None,
                    "createdAt": datetime.utcnow(),
                    "isAdmin": False,
                }
                
                result = await self.users_collection.insert_one(new_user)
                new_user["_id"] = result.inserted_id
                return new_user
    
    def _generate_csrf_token(self) -> str:
        """Generate a CSRF token"""
        import secrets
        return secrets.token_urlsafe(32)


# Singleton instance
dex_oauth_service = DexOAuthService()
