import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from papers2code_app2.services.auth_service import AuthService
from papers2code_app2.services.exceptions import InvalidTokenException, UserNotFoundException
from fastapi import Response

@pytest.mark.asyncio
async def test_link_accounts_success():
    service = AuthService()
    mock_response = MagicMock(spec=Response)
    
    # Mock JWT decode
    with patch("jose.jwt.decode") as mock_jwt_decode:
        mock_jwt_decode.return_value = {
            "existing_user_id": "507f1f77bcf86cd799439011",
            "google_id": "google123",
            "google_avatar": "http://avatar",
            "google_email": "test@gmail.com",
            "exp": 9999999999
        }
        
        # Mock DB
        mock_collection = AsyncMock()
        mock_collection.find_one.return_value = {"_id": "507f1f77bcf86cd799439011", "githubAvatarUrl": "http://gh_avatar", "username": "testuser"}
        mock_collection.find_one_and_update.return_value = {"_id": "507f1f77bcf86cd799439011", "username": "testuser"}
        
        with patch("papers2code_app2.services.auth_service.get_users_collection_async", return_value=mock_collection):
            # Mock create_access_token and create_refresh_token
            with patch("papers2code_app2.services.auth_service.create_access_token", return_value="access_token"):
                with patch("papers2code_app2.services.auth_service.create_refresh_token", return_value="refresh_token"):
                    result = await service.link_accounts("valid_token", mock_response)
            
            assert result == {"detail": "Accounts linked successfully"}
            # Verify cookies are set
            assert mock_response.set_cookie.call_count == 2

@pytest.mark.asyncio
async def test_link_accounts_expired_token():
    service = AuthService()
    mock_response = MagicMock(spec=Response)
    
    with patch("jose.jwt.decode") as mock_jwt_decode:
        # Expired token
        mock_jwt_decode.return_value = {
            "exp": 0 
        }
        
        with pytest.raises(InvalidTokenException) as excinfo:
            await service.link_accounts("expired_token", mock_response)
        
        assert "Link token expired" in str(excinfo.value)

@pytest.mark.asyncio
async def test_link_accounts_user_not_found():
    service = AuthService()
    mock_response = MagicMock(spec=Response)
    
    with patch("jose.jwt.decode") as mock_jwt_decode:
        mock_jwt_decode.return_value = {
            "existing_user_id": "507f1f77bcf86cd799439011",
            "google_id": "google123",
            "google_avatar": "http://avatar",
            "google_email": "test@gmail.com",
            "exp": 9999999999
        }
        
        mock_collection = AsyncMock()
        mock_collection.find_one.return_value = None # User not found
        
        with patch("papers2code_app2.services.auth_service.get_users_collection_async", return_value=mock_collection):
             with pytest.raises(UserNotFoundException):
                await service.link_accounts("valid_token", mock_response)
