import os
import logging
from typing import Optional, Any
from datetime import datetime
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from .schemas.user_activity import LoggedActionTypes

logger = logging.getLogger(__name__)

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path, override=True)

# Implementability Status Constants (migrated to enum)
IMPL_STATUS_VOTING = LoggedActionTypes.VOTING.value
IMPL_STATUS_COMMUNITY_IMPLEMENTABLE = LoggedActionTypes.COMMUNITY_IMPLEMENTABLE.value
IMPL_STATUS_COMMUNITY_NOT_IMPLEMENTABLE = LoggedActionTypes.COMMUNITY_NOT_IMPLEMENTABLE.value
IMPL_STATUS_ADMIN_IMPLEMENTABLE = LoggedActionTypes.ADMIN_IMPLEMENTABLE.value
IMPL_STATUS_ADMIN_NOT_IMPLEMENTABLE = LoggedActionTypes.ADMIN_NOT_IMPLEMENTABLE.value

# Main Status Constants
MAIN_STATUS_NOT_IMPLEMENTABLE = "Not Implementable"
MAIN_STATUS_NOT_STARTED = "Not Started"
MAIN_STATUS_IN_PROGRESS = "In Progress"  # ADDED
MAIN_STATUS_COMPLETED = "Completed"    # ADDED
MAIN_STATUS_ABANDONED = "Abandoned"    # ADDED

# --- Nested Settings Models ---
class GitHubOAuthSettings(BaseSettings):
    CLIENT_ID: Optional[str] = Field(None, env="GITHUB_CLIENT_ID")
    CLIENT_SECRET: Optional[str] = Field(None, env="GITHUB_CLIENT_SECRET")
    AUTHORIZE_URL: str = Field("https://github.com/login/oauth/authorize", env="GITHUB_AUTHORIZE_URL")
    ACCESS_TOKEN_URL: str = Field("https://github.com/login/oauth/access_token", env="GITHUB_ACCESS_TOKEN_URL")
    API_USER_URL: str = Field("https://api.github.com/user", env="GITHUB_API_USER_URL")
    SCOPE: str = Field("user:email", env="GITHUB_SCOPE")
    model_config = SettingsConfigDict(
        extra="ignore",
        case_sensitive=False
    )
    def __init__(self, **data: Any):
        super().__init__(**data)
        if self.CLIENT_ID is None:
            self.CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
        if self.CLIENT_SECRET is None:
            self.CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

class VotingThresholdSettings(BaseSettings):
    NOT_IMPLEMENTABLE_CONFIRM_THRESHOLD: int = Field(3, env="NOT_IMPLEMENTABLE_CONFIRM_THRESHOLD")
    IMPLEMENTABLE_CONFIRM_THRESHOLD: int = Field(2, env="IMPLEMENTABLE_CONFIRM_THRESHOLD")
    model_config = SettingsConfigDict(extra="ignore")

class AppSettings(BaseSettings):    # Core settings
    ENV_TYPE: str = "DEV"
    MONGO_URI_DEV: Optional[str] = None
    MONGO_URI_DEVELOPMENT: Optional[str] = None
    MONGO_URI_PROD: Optional[str] = None
    MONGO_URI_PROD_TEST: Optional[str] = None
    FLASK_SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080
    OWNER_GITHUB_USERNAME: Optional[str] = None
    APP_LOG_LEVEL: str = "INFO"
    FRONTEND_URL: str = "http://localhost:5173"
    
    ATLAS_SEARCH_INDEX_NAME: str = Field("papers_index", env="ATLAS_SEARCH_INDEX_NAME")
    ATLAS_SEARCH_SCORE_THRESHOLD: float = Field(0.5, env="ATLAS_SEARCH_SCORE_THRESHOLD")
    ATLAS_SEARCH_OVERALL_LIMIT: int = Field(100, env="ATLAS_SEARCH_OVERALL_LIMIT")
    ATLAS_SEARCH_TITLE_BOOST: float = Field(3.0, env="ATLAS_SEARCH_TITLE_BOOST")

    STATUS_CONFIRMED_NOT_IMPLEMENTABLE_DB: str = Field(MAIN_STATUS_NOT_IMPLEMENTABLE, env="STATUS_CONFIRMED_NOT_IMPLEMENTABLE_DB")

    # Redis Cache Settings
    REDIS_URL: Optional[str] = Field(None, env="REDIS_URL")
    CACHE_TTL: int = Field(300, env="CACHE_TTL")  # 5 minutes default
    ENABLE_CACHE: bool = Field(True, env="ENABLE_CACHE")
    CACHE_KEY_PREFIX: str = Field("papers2code", env="CACHE_KEY_PREFIX")
    REDIS_MAX_CONNECTIONS: int = Field(20, env="REDIS_MAX_CONNECTIONS")
    REDIS_SOCKET_KEEPALIVE: bool = Field(True, env="REDIS_SOCKET_KEEPALIVE")
    
    # Database Performance Settings
    MONGO_MAX_POOL_SIZE: int = Field(50, env="MONGO_MAX_POOL_SIZE")
    MONGO_MIN_POOL_SIZE: int = Field(5, env="MONGO_MIN_POOL_SIZE")
    ENABLE_QUERY_HINTS: bool = Field(True, env="ENABLE_QUERY_HINTS")
    OPTIMIZE_COUNT_QUERIES: bool = Field(True, env="OPTIMIZE_COUNT_QUERIES")
    
    # Performance Settings for transformation
    PAPER_TRANSFORM_BATCH_SIZE: int = Field(20, env="PAPER_TRANSFORM_BATCH_SIZE")

    # Nested settings groups
    GITHUB: GitHubOAuthSettings = Field(default_factory=GitHubOAuthSettings)
    VOTING: VotingThresholdSettings = Field(default_factory=VotingThresholdSettings)

    model_config = SettingsConfigDict(
        env_file=env_path,
        extra="ignore",
        case_sensitive=False
    )

config_settings = AppSettings()

