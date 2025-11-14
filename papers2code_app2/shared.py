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
logger.info(f"DEBUG: Loading .env from: {env_path}")
logger.info(f"DEBUG: .env exists: {os.path.exists(env_path)}")
load_dotenv(dotenv_path=env_path, override=True)
logger.info(f"DEBUG: GITHUB_TEMPLATE_REPO from os.environ: '{os.environ.get('GITHUB_TEMPLATE_REPO', 'NOT SET')}'")
logger.info(f"DEBUG: GITHUB_TEMPLATE_REPO from os.getenv: '{os.getenv('GITHUB_TEMPLATE_REPO', 'NOT SET')}')")

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
    SCOPE: str = Field("user:email public_repo", env="GITHUB_SCOPE")  # Added public_repo for creating repositories
    TEMPLATE_REPO: str = Field("", env="GITHUB_TEMPLATE_REPO")  # Optional: organization/template-repo-name
    model_config = SettingsConfigDict(
        extra="ignore",
        case_sensitive=False
    )
    def __init__(self, **data: Any):
        super().__init__(**data)
        logger.info(f"DEBUG: GitHubOAuthSettings __init__ called with data: {data}")
        logger.info(f"DEBUG: After super().__init__, TEMPLATE_REPO is: '{self.TEMPLATE_REPO}'")
        
        # Auto-select credentials based on ENV_TYPE
        env_type = os.getenv("ENV_TYPE", "DEV").strip().lower()
        is_dev = env_type in ("dev", "development")
        
        if self.CLIENT_ID is None:
            if is_dev:
                # Use dev credentials in development
                self.CLIENT_ID = os.getenv("GITHUB_CLIENT_ID_DEV") or os.getenv("GITHUB_CLIENT_ID")
                logger.info("Using GITHUB_CLIENT_ID_DEV for development")
            else:
                self.CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
                
        if self.CLIENT_SECRET is None:
            if is_dev:
                # Use dev credentials in development
                self.CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET_DEV") or os.getenv("GITHUB_CLIENT_SECRET")
                logger.info("Using GITHUB_CLIENT_SECRET_DEV for development")
            else:
                self.CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
                
        logger.info(f"DEBUG: After __init__, TEMPLATE_REPO is: '{self.TEMPLATE_REPO}'")

class GoogleOAuthSettings(BaseSettings):
    CLIENT_ID: Optional[str] = Field(None, env="GOOGLE_CLIENT_ID")
    CLIENT_SECRET: Optional[str] = Field(None, env="GOOGLE_CLIENT_SECRET")
    AUTHORIZE_URL: str = Field("https://accounts.google.com/o/oauth2/v2/auth", env="GOOGLE_AUTHORIZE_URL")
    ACCESS_TOKEN_URL: str = Field("https://oauth2.googleapis.com/token", env="GOOGLE_ACCESS_TOKEN_URL")
    API_USER_URL: str = Field("https://www.googleapis.com/oauth2/v2/userinfo", env="GOOGLE_API_USER_URL")
    SCOPE: str = Field("openid email profile", env="GOOGLE_SCOPE")
    model_config = SettingsConfigDict(
        extra="ignore",
        case_sensitive=False
    )
    def __init__(self, **data: Any):
        super().__init__(**data)
        if self.CLIENT_ID is None:
            self.CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
        if self.CLIENT_SECRET is None:
            self.CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

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
    
    # Dex OAuth Configuration (for development/testing)
    USE_DEX_OAUTH: bool = Field(False, env="USE_DEX_OAUTH")
    DEX_ISSUER_URL: Optional[str] = Field(None, env="DEX_ISSUER_URL")
    DEX_CLIENT_ID: Optional[str] = Field(None, env="DEX_CLIENT_ID")
    DEX_CLIENT_SECRET: Optional[str] = Field(None, env="DEX_CLIENT_SECRET")
    
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
    GOOGLE: GoogleOAuthSettings = Field(default_factory=GoogleOAuthSettings)
    VOTING: VotingThresholdSettings = Field(default_factory=VotingThresholdSettings)

    model_config = SettingsConfigDict(
        env_file=env_path,
        extra="ignore",
        case_sensitive=False
    )

config_settings = AppSettings()
logger.info(f"DEBUG: config_settings.GITHUB.TEMPLATE_REPO after initialization: '{config_settings.GITHUB.TEMPLATE_REPO}'")

# Normalize ENV_TYPE to a canonical value so other modules can reliably check for production
# Accept common variants like 'prod' or 'production' set in environment files.
try:
    env_val = getattr(config_settings, "ENV_TYPE", "").strip().lower()
    if env_val in ("prod", "production", "prod_test"):
        # Treat 'prod', 'production', and 'prod_test' all as production mode
        config_settings.ENV_TYPE = "production"
    elif env_val in ("dev", "development"):
        config_settings.ENV_TYPE = "development"
    else:
        # Keep the original value but normalize casing for consistency
        config_settings.ENV_TYPE = env_val or config_settings.ENV_TYPE
    logger.info(f"DEBUG: Normalized ENV_TYPE -> '{config_settings.ENV_TYPE}'")
except Exception:
    # If normalization fails for any reason, leave settings untouched but log
    logger.exception("Failed to normalize ENV_TYPE; leaving as-is.")

# Auto-configure USE_DEX_OAUTH based on ENV_TYPE if not explicitly set
# DEV/DEVELOPMENT → Use Dex (mock OAuth)
# PROD_TEST/PRODUCTION → Use real OAuth
try:
    # Only auto-configure if USE_DEX_OAUTH wasn't explicitly set in environment
    if "USE_DEX_OAUTH" not in os.environ:
        normalized_env = config_settings.ENV_TYPE.lower()
        if normalized_env in ("dev", "development"):
            config_settings.USE_DEX_OAUTH = True
            logger.info("AUTO-CONFIG: USE_DEX_OAUTH=True (ENV_TYPE=DEV)")
        else:
            config_settings.USE_DEX_OAUTH = False
            logger.info(f"AUTO-CONFIG: USE_DEX_OAUTH=False (ENV_TYPE={config_settings.ENV_TYPE})")
    else:
        logger.info(f"USE_DEX_OAUTH explicitly set to {config_settings.USE_DEX_OAUTH}")
except Exception as e:
    logger.exception(f"Failed to auto-configure USE_DEX_OAUTH: {e}")

# Helper function to get MongoDB URI based on ENV_TYPE
def get_mongo_uri() -> str:
    """
    Get MongoDB connection string based on ENV_TYPE.
    Single source of truth - just change ENV_TYPE to switch environments.
    """
    env_type = config_settings.ENV_TYPE.lower()
    
    # Select URI based on environment type
    if env_type in ("dev", "development"):
        uri = config_settings.MONGO_URI_DEV or config_settings.MONGO_URI_DEVELOPMENT
    elif env_type == "prod_test":
        uri = config_settings.MONGO_URI_PROD_TEST
    elif env_type == "production":
        uri = config_settings.MONGO_URI_PROD
    else:
        uri = None
    
    if uri:
        logger.info(f"Selected MongoDB URI for ENV_TYPE={env_type}")
        return uri
    
    # Final fallback
    logger.warning(f"No MongoDB URI found for ENV_TYPE={config_settings.ENV_TYPE}")
    return "mongodb://localhost:27017/papers2code_dev"
