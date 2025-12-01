"""
Keycloak OAuth Service - Adapter for Development Environment
Provides a unified interface to use Keycloak as an OIDC provider instead of direct GitHub/Google OAuth
Uses separate Keycloak realms for Mock GitHub and Mock Google with self-registration enabled

Features:
- Self-registration: Users can create new accounts via Keycloak's registration form
- Separate realms: mock-github and mock-google act as independent identity providers
- Realistic OAuth flows: Full OAuth2/OIDC protocol support
- Unlimited test accounts: Create as many test accounts as needed for testing account linking
"""

import httpx
import uuid
import secrets
import logging
import hashlib
import os
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

# Environment check for secure logging
_is_development = config_settings.ENV_TYPE.lower() not in ("production", "prod")


class KeycloakOAuthService:
    """
    Service to handle OAuth flows through Keycloak in development environments.
    Uses separate Keycloak realms for Mock GitHub and Mock Google OAuth.
    Drop-in replacement for GitHubOAuthService/GoogleOAuthService when USE_DEX_OAUTH=true
    
    Key features:
    - Self-registration enabled: New users can create accounts
    - Separate user databases per provider (realm)
    - Test account linking scenarios with different provider accounts
    """
    
    def __init__(self):
        self.users_collection = None
        
        # Keycloak base URL (internal Docker network URL)
        keycloak_base = os.getenv('KEYCLOAK_BASE_URL', 'http://localhost:8080')
        
        # Mock GitHub realm configuration
        self.github_issuer = os.getenv(
            'KEYCLOAK_GITHUB_ISSUER_URL', 
            f'{keycloak_base}/realms/mock-github'
        )
        self.github_client_id = os.getenv('KEYCLOAK_GITHUB_CLIENT_ID', 'papers2code-github')
        self.github_client_secret = os.getenv('KEYCLOAK_GITHUB_CLIENT_SECRET', 'dev-github-secret')
        
        # Mock Google realm configuration
        self.google_issuer = os.getenv(
            'KEYCLOAK_GOOGLE_ISSUER_URL',
            f'{keycloak_base}/realms/mock-google'
        )
        self.google_client_id = os.getenv('KEYCLOAK_GOOGLE_CLIENT_ID', 'papers2code-google')
        self.google_client_secret = os.getenv('KEYCLOAK_GOOGLE_CLIENT_SECRET', 'dev-google-secret')
        
        # External URL for browser redirects (localhost for dev)
        self.external_keycloak_base = os.getenv('KEYCLOAK_EXTERNAL_URL', 'http://localhost:8080')
        
    def _get_provider_config(self, provider: str) -> Dict[str, str]:
        """Get OIDC configuration for the specified provider"""
        if provider == "github":
            base_issuer = self.github_issuer
            external_issuer = f"{self.external_keycloak_base}/realms/mock-github"
            return {
                "issuer": base_issuer,
                "external_issuer": external_issuer,
                "client_id": self.github_client_id,
                "client_secret": self.github_client_secret,
                "authorize_url": f"{external_issuer}/protocol/openid-connect/auth",
                "token_url": f"{base_issuer}/protocol/openid-connect/token",
                "userinfo_url": f"{base_issuer}/protocol/openid-connect/userinfo",
            }
        elif provider == "google":
            base_issuer = self.google_issuer
            external_issuer = f"{self.external_keycloak_base}/realms/mock-google"
            return {
                "issuer": base_issuer,
                "external_issuer": external_issuer,
                "client_id": self.google_client_id,
                "client_secret": self.google_client_secret,
                "authorize_url": f"{external_issuer}/protocol/openid-connect/auth",
                "token_url": f"{base_issuer}/protocol/openid-connect/token",
                "userinfo_url": f"{base_issuer}/protocol/openid-connect/userinfo",
            }
        else:
            raise OAuthException(f"Unknown provider: {provider}")
        
    async def _init_collections(self) -> None:
        """Initialize database collections asynchronously."""
        if self.users_collection is None:
            self.users_collection = await get_users_collection_async()

    def _get_callback_url(self, request: Request, provider: str) -> str:
        """Helper to generate callback URL based on provider."""
        # Use API_URL from config for consistent callback URLs
        api_url = config_settings.API_URL.rstrip('/')
        return f"{api_url}/api/auth/{provider}/callback"
    
    def prepare_github_login_redirect(self, request: Request) -> RedirectResponse:
        """
        Prepare GitHub OAuth login redirect to Keycloak mock-github realm
        """
        return self._prepare_login_redirect(request, provider="github")
    
    def prepare_google_login_redirect(self, request: Request) -> RedirectResponse:
        """
        Prepare Google OAuth login redirect to Keycloak mock-google realm
        """
        return self._prepare_login_redirect(request, provider="google")
    
    def _prepare_login_redirect(self, request: Request, provider: str) -> RedirectResponse:
        """
        Internal method to prepare OAuth login redirect to Keycloak
        """
        try:
            config = self._get_provider_config(provider)
            
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
            
            callback_url = self._get_callback_url(request, provider)
            oauth_state_cookie_path = f"/api/auth/{provider}/callback"
            
            # Build Keycloak authorization URL
            auth_params = {
                "client_id": config["client_id"],
                "redirect_uri": callback_url,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state_value,
            }
            
            auth_url = f"{config['authorize_url']}?{urlencode(auth_params)}"
            
            logger.info(f"Redirecting to Keycloak for {provider} login: {auth_url}")
            
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
            logger.error(f"Error preparing Keycloak login redirect: {e}", exc_info=True)
            raise OAuthException(f"Failed to prepare OAuth login: {str(e)}")
    
    async def handle_github_callback(self, code: str, state_from_query: str, request: Request) -> RedirectResponse:
        """
        Handle GitHub OAuth callback from Keycloak mock-github realm
        """
        return await self._handle_callback(code, state_from_query, request, provider="github")
    
    async def handle_google_callback(self, code: str, state_from_query: str, request: Request) -> RedirectResponse:
        """
        Handle Google OAuth callback from Keycloak mock-google realm
        """
        return await self._handle_callback(code, state_from_query, request, provider="google")
    
    async def _handle_callback(self, code: str, state_from_query: str, request: Request, provider: str) -> RedirectResponse:
        """
        Internal method to handle OAuth callback from Keycloak
        """
        await self._init_collections()
        
        frontend_url = config_settings.FRONTEND_URL
        oauth_state_cookie_path = f"/api/auth/{provider}/callback"
        config = self._get_provider_config(provider)
        
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
            token_data = await self._exchange_code_for_token(code, request, provider, config)
        except Exception as e:
            logger.error(f"Token exchange failed: {e}")
            response = RedirectResponse(url=f"{frontend_url}/?login_error=token_exchange_failed", status_code=307)
            response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
            return response
        
        # Get user info from Keycloak
        try:
            user_info = await self._get_user_info(token_data["access_token"], config)
            if _is_development:
                logger.info(f"Keycloak user info retrieved for {provider}")
        except Exception as e:
            if _is_development:
                logger.error(f"Failed to get user info: {e}")
            else:
                logger.error("Failed to get user info from Keycloak")
            response = RedirectResponse(url=f"{frontend_url}/?login_error=user_info_failed", status_code=307)
            response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
            return response
        
        # Format user data to match GitHub/Google format
        formatted_user_data = self._format_user_data(user_info, provider)
        
        # Check for account linking scenario (same email, different provider)
        email = formatted_user_data.get("email")
        if email:
            link_response = await self._check_account_linking(formatted_user_data, provider, frontend_url, oauth_state_cookie_path)
            if link_response:
                return link_response
        
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
        csrf_token = secrets.token_urlsafe(32)
        
        # Create success response - redirect to dashboard with login_success flag
        response = RedirectResponse(url=f"{frontend_url}/dashboard?login_success=true", status_code=307)
        
        is_production = config_settings.ENV_TYPE == "production"
        samesite_setting = "none" if is_production else "lax"
        
        # Set cookies
        response.set_cookie(
            key=ACCESS_TOKEN_COOKIE_NAME,
            value=access_token,
            httponly=True,
            samesite=samesite_setting,
            secure=True if is_production else False,
            path="/",
            max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        
        response.set_cookie(
            key=REFRESH_TOKEN_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            samesite=samesite_setting,
            secure=True if is_production else False,
            path="/api/auth",
            max_age=config_settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        )
        
        response.set_cookie(
            key=CSRF_TOKEN_COOKIE_NAME,
            value=csrf_token,
            httponly=False,  # CSRF token needs to be readable by frontend
            samesite=samesite_setting,
            secure=True if is_production else False,
            path="/",
            max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        
        # Delete state cookie
        response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
        
        logger.info(f"Successfully authenticated user {user_doc.get('username', user_id_str)} via Keycloak ({provider})")
        
        return response
    
    async def _exchange_code_for_token(self, code: str, request: Request, provider: str, config: Dict[str, str]) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        callback_url = self._get_callback_url(request, provider)
        
        token_params = {
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": callback_url,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                config["token_url"],
                data=token_params,
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()
            return response.json()
    
    async def _get_user_info(self, access_token: str, config: Dict[str, str]) -> Dict[str, Any]:
        """Get user information from Keycloak userinfo endpoint"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                config["userinfo_url"],
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    def _format_user_data(self, user_info: Dict[str, Any], provider: str) -> Dict[str, Any]:
        """
        Format Keycloak user info to match GitHub/Google format
        Makes it transparent to the rest of the application
        """
        # Keycloak returns standard OIDC claims
        formatted = {
            "id": user_info.get("sub"),  # Subject (unique user ID)
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "email_verified": user_info.get("email_verified", True),
            "preferred_username": user_info.get("preferred_username"),
        }
        
        # Add provider-specific fields
        if provider == "github":
            # Mimic GitHub user structure
            username = (
                user_info.get("preferred_username")
                or user_info.get("login")  # Custom claim from Keycloak mapper
                or (user_info.get("email") or "").split("@")[0]
                or "dev_user"
            )
            github_numeric_id = self._generate_mock_github_id(user_info.get("sub"), username)
            
            # Get avatar from Keycloak or generate a placeholder
            avatar_url = (
                user_info.get("avatar_url")  # Custom claim from Keycloak mapper
                or user_info.get("picture")
                or f"https://ui-avatars.com/api/?name={username}&background=random&size=150"
            )
            
            formatted.update({
                "login": username,
                "username": username,
                "github_numeric_id": github_numeric_id,
                "avatar_url": avatar_url,
                "html_url": f"https://github.com/{username}",  # Fake URL for consistency
            })
        elif provider == "google":
            # Mimic Google user structure
            # Get avatar from Keycloak or generate a placeholder
            email = user_info.get("email", "")
            picture = (
                user_info.get("picture")
                or f"https://ui-avatars.com/api/?name={email.split('@')[0]}&background=random&size=150"
            )
            
            formatted.update({
                "picture": picture,
                "verified_email": user_info.get("email_verified", True),
            })
        
        return formatted

    @staticmethod
    def _generate_mock_github_id(sub: Optional[str], username: str) -> int:
        """Generate a deterministic integer GitHub ID so Pydantic validations pass."""
        source = sub or username or str(uuid.uuid4())
        digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
        # Use first 12 hex chars (~48 bits) to stay within typical GitHub ID range
        return int(digest[:12], 16)
    
    async def _check_account_linking(
        self, 
        user_data: Dict[str, Any], 
        provider: str, 
        frontend_url: str,
        oauth_state_cookie_path: str
    ) -> Optional[RedirectResponse]:
        """
        Check if the email matches an existing account from a different provider.
        If so, return a redirect to the account linking flow.
        """
        email = user_data.get("email")
        if not email:
            return None
            
        if provider == "github":
            # Check for existing Google account with same email
            github_id = user_data.get("github_numeric_id")
            existing_google_user = await self.users_collection.find_one({
                "email": email,
                "googleId": {"$exists": True},
                "githubId": {"$exists": False}
            })
            
            if existing_google_user:
                # Create pending link token
                pending_link_data = {
                    "existing_user_id": str(existing_google_user["_id"]),
                    "existing_username": existing_google_user.get("username", ""),
                    "existing_avatar": existing_google_user.get("googleAvatarUrl", ""),
                    "github_id": github_id,
                    "github_username": user_data.get("login"),
                    "github_avatar": user_data.get("avatar_url"),
                    "github_email": email,
                    "github_name": user_data.get("name"),
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
                }
                pending_link_token = create_access_token(data=pending_link_data)
                logger.info(f"Email match found between GitHub and Google accounts. Redirecting to account linking modal.")
                
                response = RedirectResponse(
                    url=f"{frontend_url}/?pending_link={pending_link_token}",
                    status_code=307
                )
                response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
                return response
                
        elif provider == "google":
            # Check for existing GitHub account with same email
            google_id = user_data.get("id")
            existing_github_user = await self.users_collection.find_one({
                "email": email,
                "githubId": {"$exists": True},
                "googleId": {"$exists": False}
            })
            
            if existing_github_user:
                # Create pending link token
                pending_link_data = {
                    "existing_user_id": str(existing_github_user["_id"]),
                    "existing_username": existing_github_user.get("username", ""),
                    "existing_avatar": existing_github_user.get("githubAvatarUrl", ""),
                    "google_id": google_id,
                    "google_email": email,
                    "google_avatar": user_data.get("picture"),
                    "google_username": (email or "").split("@")[0],
                    "google_name": user_data.get("name"),
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
                }
                pending_link_token = create_access_token(data=pending_link_data)
                logger.info(f"Email match found between Google and GitHub accounts. Redirecting to account linking modal.")
                
                response = RedirectResponse(
                    url=f"{frontend_url}/?pending_link={pending_link_token}",
                    status_code=307
                )
                response.delete_cookie(OAUTH_STATE_COOKIE_NAME, path=oauth_state_cookie_path)
                return response
        
        return None
    
    async def _create_or_update_user(self, user_data: Dict[str, Any], provider: str) -> Dict[str, Any]:
        """Create or update user in database"""
        email = user_data.get("email")
        current_time = datetime.now(timezone.utc)
        
        if provider == "github":
            github_id = user_data.get("github_numeric_id")
            github_username = user_data.get("login")
            primary_username = user_data.get("username") or github_username
            
            # Try to find existing user by GitHub ID
            existing_user = await self.users_collection.find_one({"githubId": github_id})
            
            if existing_user:
                # Update existing user
                update_fields = {
                    "githubUsername": github_username,
                    "displayName": user_data.get("name") or github_username,
                    "githubAvatarUrl": user_data.get("avatar_url"),
                    "email": email,
                    "updatedAt": current_time,
                    "lastLoginAt": current_time,
                }
                
                # Compute avatar based on preference
                preferred_source = existing_user.get("preferredAvatarSource", "github")
                if preferred_source == "google" and existing_user.get("googleAvatarUrl"):
                    update_fields["avatarUrl"] = existing_user.get("googleAvatarUrl")
                else:
                    update_fields["avatarUrl"] = user_data.get("avatar_url")
                
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
                    "username": primary_username,
                    "email": email,
                    "displayName": user_data.get("name") or github_username,
                    "avatarUrl": user_data.get("avatar_url"),
                    "githubAvatarUrl": user_data.get("avatar_url"),
                    "preferredAvatarSource": "github",
                    "bio": None,
                    "createdAt": current_time,
                    "updatedAt": current_time,
                    "lastLoginAt": current_time,
                    "isAdmin": False,
                    "showEmail": True,
                    "showGithub": True,
                }
                
                result = await self.users_collection.insert_one(new_user)
                new_user["_id"] = result.inserted_id
                return new_user
                
        elif provider == "google":
            google_id = user_data.get("id")
            google_username = (email or "").split("@")[0] or f"google_user_{google_id}"
            
            # Try to find existing user by Google ID
            existing_user = await self.users_collection.find_one({"googleId": google_id})
            
            if existing_user:
                # Update existing user
                update_fields = {
                    "googleUsername": google_username,
                    "displayName": user_data.get("name"),
                    "googleAvatarUrl": user_data.get("picture"),
                    "email": email,
                    "updatedAt": current_time,
                    "lastLoginAt": current_time,
                }
                
                # Compute avatar based on preference
                preferred_source = existing_user.get("preferredAvatarSource", "google")
                if preferred_source == "github" and existing_user.get("githubAvatarUrl"):
                    update_fields["avatarUrl"] = existing_user.get("githubAvatarUrl")
                else:
                    update_fields["avatarUrl"] = user_data.get("picture")
                
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
                    "googleUsername": google_username,
                    "username": google_username,
                    "email": email,
                    "displayName": user_data.get("name"),
                    "avatarUrl": user_data.get("picture"),
                    "googleAvatarUrl": user_data.get("picture"),
                    "preferredAvatarSource": "google",
                    "bio": None,
                    "createdAt": current_time,
                    "updatedAt": current_time,
                    "lastLoginAt": current_time,
                    "isAdmin": False,
                    "showEmail": True,
                    "showGithub": True,
                }
                
                result = await self.users_collection.insert_one(new_user)
                new_user["_id"] = result.inserted_id
                return new_user
        
        raise OAuthException(f"Unknown provider: {provider}")


# Singleton instance
keycloak_oauth_service = KeycloakOAuthService()

# Alias for backward compatibility with code expecting dex_oauth_service
dex_oauth_service = keycloak_oauth_service
