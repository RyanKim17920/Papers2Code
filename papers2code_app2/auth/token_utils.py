from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import uuid
import hashlib

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
    
    # If no session ID exists, generate one based on IP and user agent
    if not session_id:
        ip_address = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Create a deterministic session ID based on IP and user agent
        session_data = f"{ip_address}:{user_agent}"
        session_id = hashlib.md5(session_data.encode()).hexdigest()
    
    return session_id
   