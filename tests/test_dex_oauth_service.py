import pytest
from unittest.mock import Mock, patch

from fastapi import Request


@pytest.fixture
def mock_request():
    request = Mock(spec=Request)
    request.url_for = Mock(return_value="http://localhost:5001/api/auth/github/callback")
    request.base_url = Mock(return_value="http://localhost:5001")
    request.url = Mock()
    request.url.path = "/api/auth/github/callback"
    request.cookies = {}
    return request


def test_dex_defaults_for_missing_config(monkeypatch, mock_request):
    """If DEX values are not provided, the DexOAuthService should fall back to sensible defaults."""

    with patch('papers2code_app2.services.dex_oauth_service.config_settings') as mock_config:
        mock_config.DEX_ISSUER_URL = None
        mock_config.DEX_CLIENT_ID = None
        mock_config.DEX_CLIENT_SECRET = None
        mock_config.FLASK_SECRET_KEY = 'test_secret'
        mock_config.ALGORITHM = 'HS256'
        mock_config.ENV_TYPE = 'DEV'

        from papers2code_app2.services.dex_oauth_service import DexOAuthService

        dex = DexOAuthService()

        # Defaults should be applied
        assert dex.dex_issuer == 'http://localhost:5556/dex'
        assert dex.client_id == 'papers2code-backend'
        assert dex.client_secret == 'dev-client-secret'

        # Check that the authorize URL is constructed with these defaults
        response = dex.prepare_github_login_redirect(mock_request)
        assert 'http://localhost:5556/dex/auth' in response.headers['location']
        assert 'client_id=papers2code-backend' in response.headers['location']


def test_dex_uses_custom_config(monkeypatch, mock_request):
    """If DEX values are provided, they should be used."""
    with patch('papers2code_app2.services.dex_oauth_service.config_settings') as mock_config:
        mock_config.DEX_ISSUER_URL = 'http://custom-dex:1234/dex'
        mock_config.DEX_CLIENT_ID = 'custom-client'
        mock_config.DEX_CLIENT_SECRET = 'custom-secret'
        mock_config.FLASK_SECRET_KEY = 'test_secret'
        mock_config.ALGORITHM = 'HS256'
        mock_config.ENV_TYPE = 'DEV'

        from papers2code_app2.services.dex_oauth_service import DexOAuthService

        dex = DexOAuthService()

        assert dex.dex_issuer == 'http://custom-dex:1234/dex'
        assert dex.client_id == 'custom-client'
        assert dex.client_secret == 'custom-secret'

        response = dex.prepare_github_login_redirect(mock_request)
        assert 'http://custom-dex:1234/dex/auth' in response.headers['location']
        assert 'client_id=custom-client' in response.headers['location']
