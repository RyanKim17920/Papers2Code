"""
Tests for Google OAuth Service

This module tests the Google OAuth authentication flow including:
- Login redirect preparation
- OAuth callback handling
- User creation and updates
- Token generation and cookie setting
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from fastapi import Request
from fastapi.responses import RedirectResponse
from bson import ObjectId

from papers2code_app2.services.google_oauth_service import GoogleOAuthService
from papers2code_app2.services.exceptions import OAuthException


@pytest.fixture
def google_oauth_service():
    """Create a GoogleOAuthService instance for testing"""
    return GoogleOAuthService()


@pytest.fixture
def mock_request():
    """Create a mock FastAPI Request object"""
    request = Mock(spec=Request)
    request.url_for = Mock(return_value="http://localhost:5000/api/auth/google/callback")
    request.base_url = Mock(return_value="http://localhost:5000")
    request.url = Mock()
    request.url.path = "/api/auth/google/callback"
    request.cookies = {}
    return request


@pytest.fixture
def mock_google_user_data():
    """Mock Google user data response"""
    return {
        "id": "123456789",
        "email": "testuser@gmail.com",
        "name": "Test User",
        "picture": "https://example.com/avatar.jpg",
        "verified_email": True
    }


class TestGoogleOAuthService:
    """Test suite for GoogleOAuthService"""

    def test_service_initialization(self, google_oauth_service):
        """Test that the service initializes correctly"""
        assert google_oauth_service.users_collection is None

    @patch('papers2code_app2.services.google_oauth_service.config_settings')
    def test_prepare_google_login_redirect_success(self, mock_config, google_oauth_service, mock_request):
        """Test successful Google login redirect preparation"""
        # Setup mock config
        mock_config.GOOGLE.CLIENT_ID = "test_client_id"
        mock_config.GOOGLE.AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
        mock_config.GOOGLE.SCOPE = "openid email profile"
        mock_config.FLASK_SECRET_KEY = "test_secret_key"
        mock_config.ALGORITHM = "HS256"
        mock_config.ENV_TYPE = "DEV"

        # Execute
        response = google_oauth_service.prepare_google_login_redirect(mock_request)

        # Verify
        assert isinstance(response, RedirectResponse)
        assert "accounts.google.com" in response.headers["location"]
        assert "client_id=test_client_id" in response.headers["location"]
        assert "response_type=code" in response.headers["location"]
        assert "scope=openid+email+profile" in response.headers["location"] or "scope=openid%20email%20profile" in response.headers["location"]

    @patch('papers2code_app2.services.google_oauth_service.config_settings')
    def test_prepare_google_login_redirect_no_client_id(self, mock_config, google_oauth_service, mock_request):
        """Test login redirect fails when CLIENT_ID is not configured"""
        mock_config.GOOGLE.CLIENT_ID = None
        mock_config.FLASK_SECRET_KEY = "test_secret_key"
        mock_config.ALGORITHM = "HS256"

        with pytest.raises(OAuthException) as exc_info:
            google_oauth_service.prepare_google_login_redirect(mock_request)
        
        assert "Client ID not set" in str(exc_info.value.message)

    @pytest.mark.asyncio
    @patch('papers2code_app2.services.google_oauth_service.config_settings')
    @patch('papers2code_app2.services.google_oauth_service.get_users_collection_async')
    @patch('papers2code_app2.services.google_oauth_service.httpx.AsyncClient')
    @patch('papers2code_app2.services.google_oauth_service.jwt')
    @patch('papers2code_app2.services.google_oauth_service.create_access_token')
    @patch('papers2code_app2.services.google_oauth_service.create_refresh_token')
    async def test_handle_google_callback_success_new_user(
        self, mock_create_refresh, mock_create_access, mock_jwt, mock_httpx, 
        mock_get_users_collection, mock_config,
        google_oauth_service, mock_request, mock_google_user_data
    ):
        """Test successful Google OAuth callback with new user creation"""
        # Setup mocks
        mock_config.GOOGLE.CLIENT_ID = "test_client_id"
        mock_config.GOOGLE.CLIENT_SECRET = "test_client_secret"
        mock_config.GOOGLE.ACCESS_TOKEN_URL = "https://oauth2.googleapis.com/token"
        mock_config.GOOGLE.API_USER_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
        mock_config.FLASK_SECRET_KEY = "test_secret_key"
        mock_config.ALGORITHM = "HS256"
        mock_config.FRONTEND_URL = "http://localhost:5173"
        mock_config.ENV_TYPE = "DEV"
        mock_config.ACCESS_TOKEN_EXPIRE_MINUTES = 30
        mock_config.REFRESH_TOKEN_EXPIRE_MINUTES = 10080

        # Mock JWT and tokens
        mock_jwt.decode.return_value = {"state_val": "test_state_value"}
        mock_create_access.return_value = "mock_access_token"
        mock_create_refresh.return_value = "mock_refresh_token"

        # Mock request cookies
        mock_request.cookies = {"oauth_state_token": "mock_state_jwt"}

        # Mock HTTP client responses (properly await AsyncMock)
        mock_client_instance = AsyncMock()
        
        # Mock token response
        token_response_mock = Mock()
        token_response_mock.json = Mock(return_value={"access_token": "mock_google_access_token"})
        token_response_mock.raise_for_status = Mock()
        mock_client_instance.post = AsyncMock(return_value=token_response_mock)
        
        # Mock user data response
        user_response_mock = Mock()
        user_response_mock.json = Mock(return_value=mock_google_user_data)
        user_response_mock.raise_for_status = Mock()
        mock_client_instance.get = AsyncMock(return_value=user_response_mock)
        
        # Setup AsyncClient context manager
        mock_httpx.return_value.__aenter__.return_value = mock_client_instance
        mock_httpx.return_value.__aexit__.return_value = None

        # Mock database operations
        mock_users_collection = AsyncMock()
        mock_get_users_collection.return_value = mock_users_collection
        
        # User doesn't exist yet (new user)
        mock_users_collection.find_one.side_effect = [
            None,  # First call: check if user exists
            None,  # Second call: check username uniqueness
        ]
        
        # Mock user document after creation
        mock_user_doc = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "username": "testuser",
            "email": "testuser@gmail.com",
            "name": "Test User",
            "google_id": "123456789",
            "avatarUrl": "https://example.com/avatar.jpg",
            "is_admin": False,
            "createdAt": datetime.now(timezone.utc)
        }
        mock_users_collection.find_one_and_update.return_value = mock_user_doc

        # Execute
        response = await google_oauth_service.handle_google_callback(
            code="test_auth_code",
            state_from_query="test_state_value",
            request=mock_request
        )

        # Verify
        assert isinstance(response, RedirectResponse)
        assert response.status_code == 307
        assert "localhost:5173" in response.headers["location"]
        
        # Verify database operations were called
        assert mock_users_collection.find_one_and_update.called

    @pytest.mark.asyncio
    @patch('papers2code_app2.services.google_oauth_service.config_settings')
    @patch('papers2code_app2.services.google_oauth_service.get_users_collection_async')
    @patch('papers2code_app2.services.google_oauth_service.jwt')
    async def test_handle_google_callback_state_mismatch(
        self, mock_jwt, mock_get_users_collection, mock_config,
        google_oauth_service, mock_request
    ):
        """Test that callback fails with state mismatch"""
        mock_config.FRONTEND_URL = "http://localhost:5173"
        mock_config.ENV_TYPE = "DEV"
        mock_config.FLASK_SECRET_KEY = "test_secret_key"
        mock_config.ALGORITHM = "HS256"

        # Mock JWT decode with different state value
        mock_jwt.decode.return_value = {"state_val": "expected_state"}
        mock_request.cookies = {"oauth_state_token": "mock_state_jwt"}

        # Mock database
        mock_users_collection = AsyncMock()
        mock_get_users_collection.return_value = mock_users_collection

        # Execute with mismatched state
        response = await google_oauth_service.handle_google_callback(
            code="test_auth_code",
            state_from_query="wrong_state",  # Different from expected_state
            request=mock_request
        )

        # Verify error redirect
        assert isinstance(response, RedirectResponse)
        assert "login_error=state_mismatch" in response.headers["location"]

    @pytest.mark.asyncio
    @patch('papers2code_app2.services.google_oauth_service.config_settings')
    @patch('papers2code_app2.services.google_oauth_service.get_users_collection_async')
    async def test_handle_google_callback_missing_state_cookie(
        self, mock_get_users_collection, mock_config,
        google_oauth_service, mock_request
    ):
        """Test that callback fails when state cookie is missing"""
        mock_config.FRONTEND_URL = "http://localhost:5173"
        mock_config.ENV_TYPE = "DEV"

        # Mock database
        mock_users_collection = AsyncMock()
        mock_get_users_collection.return_value = mock_users_collection

        # No state cookie
        mock_request.cookies = {}

        # Execute
        response = await google_oauth_service.handle_google_callback(
            code="test_auth_code",
            state_from_query="test_state",
            request=mock_request
        )

        # Verify error redirect
        assert isinstance(response, RedirectResponse)
        assert "login_error=state_cookie_missing" in response.headers["location"]

    @pytest.mark.asyncio
    @patch('papers2code_app2.services.google_oauth_service.config_settings')
    @patch('papers2code_app2.services.google_oauth_service.get_users_collection_async')
    @patch('papers2code_app2.services.google_oauth_service.httpx.AsyncClient')
    @patch('papers2code_app2.services.google_oauth_service.jwt')
    @patch('papers2code_app2.services.google_oauth_service.create_access_token')
    @patch('papers2code_app2.services.google_oauth_service.create_refresh_token')
    async def test_handle_google_callback_linking_to_github_user(
        self, mock_create_refresh, mock_create_access, mock_jwt, mock_httpx, 
        mock_get_users_collection, mock_config,
        google_oauth_service, mock_request, mock_google_user_data
    ):
        """Test linking Google account to existing GitHub user"""
        # Setup mocks
        mock_config.GOOGLE.CLIENT_ID = "test_client_id"
        mock_config.GOOGLE.CLIENT_SECRET = "test_client_secret"
        mock_config.GOOGLE.ACCESS_TOKEN_URL = "https://oauth2.googleapis.com/token"
        mock_config.GOOGLE.API_USER_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
        mock_config.FLASK_SECRET_KEY = "test_secret_key"
        mock_config.ALGORITHM = "HS256"
        mock_config.FRONTEND_URL = "http://localhost:5173"
        mock_config.ENV_TYPE = "DEV"
        mock_config.ACCESS_TOKEN_EXPIRE_MINUTES = 30
        mock_config.REFRESH_TOKEN_EXPIRE_MINUTES = 10080

        # Mock JWT and tokens
        mock_jwt.decode.return_value = {"state_val": "test_state_value"}
        mock_create_access.return_value = "mock_access_token"
        mock_create_refresh.return_value = "mock_refresh_token"
        mock_request.cookies = {"oauth_state_token": "mock_state_jwt"}

        # Mock HTTP client responses
        mock_client_instance = AsyncMock()
        
        token_response_mock = Mock()
        token_response_mock.json = Mock(return_value={"access_token": "mock_google_access_token"})
        token_response_mock.raise_for_status = Mock()
        mock_client_instance.post = AsyncMock(return_value=token_response_mock)
        
        user_response_mock = Mock()
        user_response_mock.json = Mock(return_value=mock_google_user_data)
        user_response_mock.raise_for_status = Mock()
        mock_client_instance.get = AsyncMock(return_value=user_response_mock)
        
        mock_httpx.return_value.__aenter__.return_value = mock_client_instance
        mock_httpx.return_value.__aexit__.return_value = None

        # Mock database operations - existing GitHub user
        mock_users_collection = AsyncMock()
        mock_get_users_collection.return_value = mock_users_collection
        
        existing_user = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "username": "testuser",
            "github_id": 987654321,
            "email": "testuser@gmail.com",
            "is_admin": False
        }
        mock_users_collection.find_one.return_value = existing_user
        
        # After linking, return updated user
        updated_user = existing_user.copy()
        updated_user["google_id"] = "123456789"
        mock_users_collection.find_one_and_update.return_value = updated_user

        # Execute
        response = await google_oauth_service.handle_google_callback(
            code="test_auth_code",
            state_from_query="test_state_value",
            request=mock_request
        )

        # Verify
        assert isinstance(response, RedirectResponse)
        assert response.status_code == 307
        
        # Verify that linking update was called
        assert mock_users_collection.find_one_and_update.called


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
