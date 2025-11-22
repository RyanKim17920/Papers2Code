import pytest
from fastapi.testclient import TestClient
from papers2code_app2.main import app
from papers2code_app2.services.mock_idp_service import mock_idp_service

client = TestClient(app)

def test_discovery_endpoint():
    response = client.get("/mock-idp/.well-known/openid-configuration")
    assert response.status_code == 200
    data = response.json()
    assert "issuer" in data
    assert "authorization_endpoint" in data
    assert data["issuer"].endswith("/mock-idp")

def test_jwks_endpoint():
    response = client.get("/mock-idp/jwks")
    assert response.status_code == 200
    data = response.json()
    assert "keys" in data
    assert len(data["keys"]) > 0
    assert data["keys"][0]["kty"] == "RSA"

def test_authorize_page():
    response = client.get("/mock-idp/authorize?client_id=test&redirect_uri=http://localhost&state=123")
    assert response.status_code == 200
    assert "Choose a Persona" in response.text
    assert "Alice Dev" in response.text

def test_login_flow():
    # 1. Submit login form
    response = client.post(
        "/mock-idp/authorize/submit",
        data={
            "client_id": "test-client",
            "redirect_uri": "http://localhost/callback",
            "state": "xyz",
            "user_id": "gh-alice",
            "nonce": "nonce123"
        },
        follow_redirects=False
    )
    assert response.status_code == 302
    location = response.headers["location"]
    assert "code=" in location
    assert "state=xyz" in location
    
    # Extract code
    import urllib.parse
    parsed = urllib.parse.urlparse(location)
    params = urllib.parse.parse_qs(parsed.query)
    code = params["code"][0]
    
    # 2. Exchange code for token
    response = client.post(
        "/mock-idp/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "http://localhost/callback",
            "client_id": "test-client"
        }
    )
    assert response.status_code == 200
    token_data = response.json()
    assert "access_token" in token_data
    assert "id_token" in token_data
    
    # 3. Get user info
    access_token = token_data["access_token"]
    response = client.get(
        "/mock-idp/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert response.status_code == 200
    user_info = response.json()
    assert user_info["sub"] == "gh-alice"
    assert user_info["name"] == "Alice Dev"

def test_dynamic_persona():
    # Create new persona
    new_persona = {
        "username": "testuser",
        "email": "test@example.com",
        "displayName": "Test User",
        "provider": "github"
    }
    
    response = client.post("/mock-idp/api/personas", json=new_persona)
    assert response.status_code == 200
    created = response.json()
    assert "id" in created
    assert len(created["id"]) > 0
    
    # Verify it appears in list
    response = client.get("/mock-idp/authorize?client_id=test&redirect_uri=http://localhost&state=123")
    assert "Test User" in response.text
