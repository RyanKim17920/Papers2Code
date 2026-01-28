from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import uuid
import secrets

from jose import jwt
from fastapi import Request

from ..shared import config_settings

SECRET_KEY = config_settings.FLASK_SECRET_KEY
ALGORITHM = config_settings.ALGORITHM


def create_token(data: Dict, token_type: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT token of a specific type."""
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta())
    payload.update({"exp": expire, "token_type": token_type})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create an access token with a default expiration of 15 minutes."""
    return create_token(data, "access", expires_delta or timedelta(minutes=15))

def create_refresh_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a refresh token with a default expiration of 30 days."""
    return create_token(data, "refresh", expires_delta or timedelta(days=30))


def get_session_id(request: Request) -> str:
    """Generate or retrieve a session ID for anonymous users."""
    # Try to get existing session ID from headers or cookies
    session_id = request.headers.get("x-session-id")
    if not session_id:
        session_id = request.cookies.get("session_id")

    # If no session ID exists, generate a cryptographically secure random session ID
    if not session_id:
        # Generate 32 bytes of entropy (256 bits) for secure session ID
        # This produces a URL-safe base64-encoded string
        session_id = secrets.token_urlsafe(32)

    return session_id
   