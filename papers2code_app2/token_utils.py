from datetime import datetime, timedelta, timezone
from typing import Optional, Dict

from jose import jwt

from .shared import config_settings

SECRET_KEY = config_settings.FLASK_SECRET_KEY
ALGORITHM = config_settings.ALGORITHM


def create_token(data: Dict, token_type: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT token of a specific type."""
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta())
    payload.update({"exp": expire, "token_type": token_type})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
