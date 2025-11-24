"""
Mock IDP Service
Provides OIDC provider functionality for development and testing.
Manages personas and dynamic account creation.
"""

import json
import logging
import time
import uuid
from typing import Dict, List, Optional, Any
from pathlib import Path
from datetime import datetime, timedelta

from jose import jwt, jwk
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

from ..shared import config_settings

logger = logging.getLogger(__name__)

class MockIDPService:
    def __init__(self):
        self.personas: List[Dict[str, Any]] = []
        self.codes: Dict[str, Dict[str, Any]] = {}  # auth_code -> token_data
        self.tokens: Dict[str, Dict[str, Any]] = {} # access_token -> user_data
        
        # Load initial personas
        self._load_personas()
        
        # Generate signing keys
        self._generate_keys()
        
        self.issuer = f"{config_settings.API_URL}/mock-idp"
        
    def _load_personas(self):
        """Load personas from the shared JSON config"""
        try:
            persona_path = Path("dev-config/dex_personas.json")
            if not persona_path.exists():
                persona_path = Path("../dev-config/dex_personas.json")
            
            if persona_path.exists():
                with open(persona_path, "r") as f:
                    data = json.load(f)
                    self.personas = data.get("personas", [])
            else:
                logger.warning("dex_personas.json not found, using defaults")
                self.personas = [
                    {
                        "id": "gh-alice",
                        "provider": "github",
                        "email": "alice.dev@test.local",
                        "username": "alice-gh",
                        "displayName": "Alice Dev",
                        "avatarUrl": "https://avatars.githubusercontent.com/u/110001?v=4",
                    }
                ]
        except Exception as e:
            logger.error(f"Failed to load personas: {e}")
            self.personas = []

    def _generate_keys(self):
        """Generate RSA keys for signing tokens"""
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        self.public_key = self.private_key.public_key()
        

        self.kid = "mock-idp-key-1"

    def get_jwks(self) -> Dict[str, Any]:
        """Return JWKS (JSON Web Key Set)"""
        pn = self.public_key.public_numbers()
        
        def to_base64url_uint(val):
            import base64
            bytes_val = val.to_bytes((val.bit_length() + 7) // 8, byteorder='big')
            return base64.urlsafe_b64encode(bytes_val).decode('utf-8').rstrip('=')

        return {
            "keys": [
                {
                    "kty": "RSA",
                    "use": "sig",
                    "kid": self.kid,
                    "alg": "RS256",
                    "n": to_base64url_uint(pn.n),
                    "e": to_base64url_uint(pn.e),
                }
            ]
        }

    def get_discovery_doc(self) -> Dict[str, Any]:
        """Return OIDC Discovery Document"""

        # We hardcode these for the dev environment as they are specific to the docker-compose setup.
        # 'internal_host' is used for server-to-server communication within the Docker network.
        # 'external_host' is used for browser redirects.
        internal_host = "http://papers2code_dev_backend:5000"
        external_host = "http://localhost:5000"
        
        issuer = f"{internal_host}/mock-idp"
        
        return {
            "issuer": issuer,
            "authorization_endpoint": f"{external_host}/mock-idp/authorize",
            "token_endpoint": f"{internal_host}/mock-idp/token",
            "userinfo_endpoint": f"{internal_host}/mock-idp/userinfo",
            "jwks_uri": f"{internal_host}/mock-idp/jwks",
            "response_types_supported": ["code"],
            "subject_types_supported": ["public"],
            "id_token_signing_alg_values_supported": ["RS256"],
            "scopes_supported": ["openid", "email", "profile", "groups"],
            "claims_supported": ["sub", "iss", "name", "email", "picture", "preferred_username"]
        }

    def create_auth_code(self, client_id: str, redirect_uri: str, nonce: str, user_id: str) -> str:
        """Create an authorization code for a logged-in user"""
        code = str(uuid.uuid4())
        self.codes[code] = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "nonce": nonce,
            "user_id": user_id,
            "expires_at": time.time() + 600  # 10 mins
        }
        return code

    def exchange_code(self, code: str) -> Dict[str, Any]:
        """Exchange auth code for tokens"""
        data = self.codes.get(code)
        if not data:
            raise ValueError("Invalid code")
        
        if time.time() > data["expires_at"]:
            raise ValueError("Code expired")
            
        # Find user
        user = next((p for p in self.personas if p["id"] == data["user_id"]), None)
        if not user:
            raise ValueError("User not found")
            
        # Create ID Token
        now = datetime.utcnow()
        
        # Issuer must match the discovery doc issuer (internal host)
        internal_host = "http://papers2code_dev_backend:5000"
        issuer = f"{internal_host}/mock-idp"
        
        id_token_payload = {
            "iss": issuer,
            "sub": user["id"],
            "aud": data["client_id"],
            "exp": now + timedelta(hours=1),
            "iat": now,
            "nonce": data.get("nonce"),
            "name": user.get("displayName"),
            "email": user.get("email"),
            "email_verified": True,
            "picture": user.get("avatarUrl"),
            "preferred_username": user.get("username")
        }
        
        # Sign ID Token
        # We need to convert our private key to PEM for jose, or use a different method
        pem_private = self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        id_token = jwt.encode(
            id_token_payload,
            pem_private.decode('utf-8'),
            algorithm="RS256",
            headers={"kid": self.kid}
        )
        
        # Access Token (opaque)
        access_token = str(uuid.uuid4())
        self.tokens[access_token] = user
        
        # Clean up code
        del self.codes[code]
        
        return {
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": 3600,
            "id_token": id_token
        }

    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user info for access token"""
        user = self.tokens.get(access_token)
        if not user:
            raise ValueError("Invalid token")
            
        return {
            "sub": user["id"],
            "name": user.get("displayName"),
            "email": user.get("email"),
            "email_verified": True,
            "picture": user.get("avatarUrl"),
            "preferred_username": user.get("username")
        }

    def add_persona(self, persona: Dict[str, Any]) -> Dict[str, Any]:
        """Add a new persona dynamically"""
        if not persona.get("id"):
            persona["id"] = str(uuid.uuid4())
        
        self.personas.append(persona)
        return persona

# Singleton
mock_idp_service = MockIDPService()
