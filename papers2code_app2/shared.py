import os
import logging
from pathlib import Path
from typing import Optional, Any
from datetime import datetime
from urllib.parse import urlparse
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from .schemas.user_activity import LoggedActionTypes

logger = logging.getLogger(__name__)

MONGO_URI_PLACEHOLDER_TOKENS = (
    "your_username",
    "your_password",
    "your-cluster",
    "prod_user",
    "prod_pass",
    "test_user",
    "test_pass",
)

DEFAULT_LOCAL_MONGO_URI = "mongodb://localhost:27017/papers2codedev"

BASE_DIR = Path(__file__).resolve().parent.parent
PRIMARY_ENV_FILE = BASE_DIR / ".env"


def _load_environment_files() -> list[Path]:
    """Load the appropriate environment files with sensible fallbacks."""
    loaded_files: list[Path] = []

    if PRIMARY_ENV_FILE.exists():
        load_dotenv(PRIMARY_ENV_FILE, override=False)
        loaded_files.append(PRIMARY_ENV_FILE)
        logger.info("DEBUG: Loaded primary environment file (.env)")
    else:
        logger.warning(
            "DEBUG: No environment file was loaded. Create one by copying .env.example to .env."
        )

    for file in loaded_files:
        logger.info("DEBUG: Loaded environment file: %s", file)

    return loaded_files


_loaded_env_files = _load_environment_files()
env_path_candidate: Optional[Path] = PRIMARY_ENV_FILE if PRIMARY_ENV_FILE.exists() else None

env_path = str(env_path_candidate) if env_path_candidate else str(PRIMARY_ENV_FILE)

logger.info(
    "DEBUG: GITHUB_TEMPLATE_REPO from os.environ: '%s'",
    os.environ.get('GITHUB_TEMPLATE_REPO', 'NOT SET'),
)
logger.info(
    "DEBUG: GITHUB_TEMPLATE_REPO from os.getenv: '%s'",
    os.getenv('GITHUB_TEMPLATE_REPO', 'NOT SET'),
)

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
    CLIENT_ID: Optional[str] = Field(None)  # Resolution handled in __init__, not by Pydantic
    CLIENT_SECRET: Optional[str] = Field(None)  # Resolution handled in __init__, not by Pydantic
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
        explicit_client_id = any(
            key in data and data[key] is not None for key in ("CLIENT_ID", "client_id")
        )
        explicit_client_secret = any(
            key in data and data[key] is not None for key in ("CLIENT_SECRET", "client_secret")
        )

        super().__init__(**data)

        logger.info("DEBUG: GitHubOAuthSettings __init__ called with data keys: %s", list(data.keys()))
        logger.info(
            "DEBUG: After super().__init__, TEMPLATE_REPO is: '%s'",
            self.TEMPLATE_REPO,
        )

        env_type_value = os.getenv("ENV_TYPE", "DEV").strip().lower()
        is_dev = env_type_value in ("dev", "development")

        def _resolve_credential(
            attr_name: str,
            explicit: bool,
            dev_key: str,
            prod_key: str,
        ) -> None:
            if explicit:
                logger.info(
                    "GitHubOAuthSettings: %s provided explicitly; skipping env override",
                    attr_name,
                )
                return

            preferred_keys = [prod_key]
            if is_dev:
                preferred_keys = [dev_key, prod_key]
            else:
                preferred_keys = [prod_key, dev_key]

            for key in preferred_keys:
                value = os.getenv(key)
                if value:
                    setattr(self, attr_name, value)
                    logger.info(
                        "Using %s for GitHub %s (%s mode)",
                        key,
                        attr_name.lower(),
                        "development" if is_dev else "production",
                    )
                    return

            if getattr(self, attr_name) is None:
                logger.warning(
                    "GitHubOAuthSettings: No value available for %s; GitHub OAuth may fail",
                    attr_name.lower(),
                )

        _resolve_credential("CLIENT_ID", explicit_client_id, "GITHUB_CLIENT_ID_DEV", "GITHUB_CLIENT_ID")
        _resolve_credential(
            "CLIENT_SECRET",
            explicit_client_secret,
            "GITHUB_CLIENT_SECRET_DEV",
            "GITHUB_CLIENT_SECRET",
        )

        logger.info(
            "DEBUG: After __init__, TEMPLATE_REPO is: '%s'",
            self.TEMPLATE_REPO,
        )

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
    MONGO_DB_NAME_DEV: Optional[str] = None
    MONGO_DB_NAME_DEVELOPMENT: Optional[str] = None
    MONGO_DB_NAME_PROD: Optional[str] = None
    MONGO_DB_NAME_PROD_TEST: Optional[str] = None
    FLASK_SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080
    OWNER_GITHUB_USERNAME: Optional[str] = None
    APP_LOG_LEVEL: str = "INFO"
    FRONTEND_URL: str = "http://localhost:5173"
    API_URL: str = "http://localhost:5001"
    
    # Mock OAuth Configuration (for development/testing with Keycloak)
    USE_DEX_OAUTH: bool = Field(False, env="USE_DEX_OAUTH")  # Enables Keycloak mock OAuth
    
    # Keycloak Mock GitHub OAuth
    KEYCLOAK_GITHUB_ISSUER_URL: Optional[str] = Field(None, env="KEYCLOAK_GITHUB_ISSUER_URL")
    KEYCLOAK_GITHUB_CLIENT_ID: Optional[str] = Field(None, env="KEYCLOAK_GITHUB_CLIENT_ID")
    KEYCLOAK_GITHUB_CLIENT_SECRET: Optional[str] = Field(None, env="KEYCLOAK_GITHUB_CLIENT_SECRET")
    
    # Keycloak Mock Google OAuth
    KEYCLOAK_GOOGLE_ISSUER_URL: Optional[str] = Field(None, env="KEYCLOAK_GOOGLE_ISSUER_URL")
    KEYCLOAK_GOOGLE_CLIENT_ID: Optional[str] = Field(None, env="KEYCLOAK_GOOGLE_CLIENT_ID")
    KEYCLOAK_GOOGLE_CLIENT_SECRET: Optional[str] = Field(None, env="KEYCLOAK_GOOGLE_CLIENT_SECRET")
    
    # Keycloak External URL (for browser redirects)
    KEYCLOAK_EXTERNAL_URL: Optional[str] = Field("http://localhost:8080", env="KEYCLOAK_EXTERNAL_URL")
    
    # Legacy Dex settings (deprecated, kept for backward compatibility)
    DEX_ISSUER_URL: Optional[str] = Field(None, env="DEX_ISSUER_URL")
    DEX_CLIENT_ID: Optional[str] = Field(None, env="DEX_CLIENT_ID")
    DEX_CLIENT_SECRET: Optional[str] = Field(None, env="DEX_CLIENT_SECRET")
    
    ATLAS_SEARCH_INDEX_NAME: str = Field("default", env="ATLAS_SEARCH_INDEX_NAME")
    ATLAS_SEARCH_SCORE_THRESHOLD: float = Field(0.5, env="ATLAS_SEARCH_SCORE_THRESHOLD")
    ATLAS_SEARCH_OVERALL_LIMIT: int = Field(100, env="ATLAS_SEARCH_OVERALL_LIMIT")
    ATLAS_SEARCH_TITLE_BOOST: float = Field(10.0, env="ATLAS_SEARCH_TITLE_BOOST")

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
    if env_val in ("prod", "production"):
        # Treat 'prod' and 'production' as production mode
        config_settings.ENV_TYPE = "production"
    elif env_val == "prod_test":
        # Preserve prod_test as a distinct environment allowing selection
        # of test-specific resources (e.g., MONGO_URI_PROD_TEST)
        config_settings.ENV_TYPE = "prod_test"
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

def ensure_valid_mongo_uri(uri: str, env_label: str = "Mongo URI") -> str:
    """Raise a descriptive error if the Mongo URI still contains template placeholders."""
    if not uri:
        message = f"{env_label} is empty. Provide a valid MongoDB connection string in .env."
        logger.critical(message)
        raise RuntimeError(message)

    normalized = uri.strip().lower()

    # Local instances are always acceptable, even without credentials
    if normalized.startswith("mongodb://localhost"):
        return uri

    for token in MONGO_URI_PLACEHOLDER_TOKENS:
        if token in normalized:
            message = (
                f"{env_label} still contains placeholder token '{token}'. "
                "Update .env with a real MongoDB Atlas or local connection string. "
                "See DOCKER-DEV-SETUP.md for instructions or run scripts/init_dev_db.sh after configuring credentials."
            )
            logger.critical(message)
            raise RuntimeError(message)

    return uri


def _fallback_to_local(reason: str) -> str:
    """Log a warning that we're falling back to a local MongoDB instance for development."""
    logger.warning(
        "Using default local MongoDB URI '%s'. Reason: %s",
        DEFAULT_LOCAL_MONGO_URI,
        reason,
    )
    return DEFAULT_LOCAL_MONGO_URI


def _parse_db_name_from_uri(uri: str) -> Optional[str]:
    """Extract the database name from a MongoDB URI if it is embedded within the path."""
    if not uri:
        return None

    try:
        parsed = urlparse(uri)
    except Exception as exc:
        logger.debug("Failed to parse Mongo URI '%s' for DB name: %s", uri, exc)
        return None

    path = parsed.path.lstrip("/")
    if not path:
        return None

    db_name = path.split("/", 1)[0]
    return db_name or None


def get_mongo_db_name(uri: Optional[str] = None) -> str:
    """Return the database name that should be used for the current environment."""

    def _select_db_name(*attr_names: str) -> tuple[Optional[str], str]:
        for attr in attr_names:
            value = getattr(config_settings, attr, None)
            if value:
                return value, attr
        return None, attr_names[0] if attr_names else "Mongo DB Name"

    env_type = (config_settings.ENV_TYPE or "development").lower()

    if env_type in ("dev", "development"):
        preferred_attrs = ("MONGO_DB_NAME_DEV", "MONGO_DB_NAME_DEVELOPMENT")
        fallback_name = "papers2codedev"
    elif env_type == "prod_test":
        preferred_attrs = ("MONGO_DB_NAME_PROD_TEST",)
        fallback_name = "papers2code_test"
    else:
        preferred_attrs = ("MONGO_DB_NAME_PROD",)
        fallback_name = "papers2code"

    selected_name, source_attr = _select_db_name(*preferred_attrs)
    if selected_name:
        logger.info(
            "Selected MongoDB DB name '%s' from %s for ENV_TYPE=%s",
            selected_name,
            source_attr,
            env_type,
        )
        return selected_name

    parsed_name = _parse_db_name_from_uri(uri) if uri else None
    if parsed_name:
        logger.info(
            "Derived MongoDB DB name '%s' from URI for ENV_TYPE=%s",
            parsed_name,
            env_type,
        )
        return parsed_name

    logger.warning(
        "Falling back to default MongoDB DB name '%s' for ENV_TYPE=%s",
        fallback_name,
        env_type,
    )
    return fallback_name


# Helper function to get MongoDB URI based on ENV_TYPE
def get_mongo_uri() -> str:
    """Get MongoDB connection string based on ENV_TYPE."""

    def _select_uri(*attr_names: str) -> tuple[Optional[str], str]:
        for attr in attr_names:
            value = getattr(config_settings, attr, None)
            if value:
                return value, attr
        # Return the first attr name for labeling, even if None
        return None, attr_names[0] if attr_names else "Mongo URI"

    env_type = (config_settings.ENV_TYPE or "development").lower()
    is_dev_like = env_type in ("dev", "development")
    uri: Optional[str] = None
    uri_label = "Mongo URI"

    if env_type in ("dev", "development"):
        uri, uri_label = _select_uri("MONGO_URI_DEV", "MONGO_URI_DEVELOPMENT")
    elif env_type == "prod_test":
        uri, uri_label = _select_uri("MONGO_URI_PROD_TEST")
    elif env_type == "production":
        uri, uri_label = _select_uri("MONGO_URI_PROD")

    if uri:
        try:
            ensure_valid_mongo_uri(uri, uri_label)
            logger.info(f"Selected MongoDB URI for ENV_TYPE={env_type}")
            return uri
        except RuntimeError as exc:
            if is_dev_like:
                return _fallback_to_local(
                    f"{uri_label} invalid for development environment: {exc}"
                )
            raise

    if is_dev_like:
        return _fallback_to_local(
            "No MongoDB URI configured for development environment."
        )

    # SECURITY: In production, fail hard if no MongoDB URI is configured
    # Never fall back to localhost in production - this would be a critical security issue
    error_msg = (
        f"CRITICAL: No MongoDB URI found for ENV_TYPE={config_settings.ENV_TYPE}. "
        "Production deployments require a properly configured MONGO_URI_PROD environment variable. "
        "Refusing to fall back to localhost for security reasons."
    )
    logger.critical(error_msg)
    raise RuntimeError(error_msg)
