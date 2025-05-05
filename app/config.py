import os
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

class Config:
    MONGO_URI = os.getenv('MONGO_URI')
    GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID')
    GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET')
    FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY')
    OWNER_GITHUB_USERNAME = os.getenv('OWNER_GITHUB_USERNAME')
    NON_IMPLEMENTABLE_CONFIRM_THRESHOLD = int(os.getenv('NON_IMPLEMENTABLE_CONFIRM_THRESHOLD', 3))
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

    # Define status strings as constants
    STATUS_CONFIRMED_NON_IMPLEMENTABLE = "Confirmed Non-Implementable"
    STATUS_NOT_STARTED = "Not Started"
    STATUS_IMPLEMENTABLE = "implementable" # Added for consistency
    STATUS_FLAGGED = "flagged_non_implementable" # Added for consistency
    STATUS_CONFIRMED_COMMUNITY = "community" # Added for consistency
    STATUS_CONFIRMED_OWNER = "owner" # Added for consistency

    # Validate essential configuration
    if not MONGO_URI: raise ValueError("No MONGO_URI found in environment variables")
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET: raise ValueError("GitHub Client ID or Secret not found in environment variables")
    if not FLASK_SECRET_KEY: raise ValueError("FLASK_SECRET_KEY not found in environment variables")
    if not OWNER_GITHUB_USERNAME:
        print("Warning: OWNER_GITHUB_USERNAME is not set in the environment. Owner-specific functionality might be limited.")

    # Flask-specific configs often derived or set here
    SECRET_KEY = FLASK_SECRET_KEY
    SESSION_COOKIE_SECURE = True # Set to False if not using HTTPS locally for testing
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # GitHub OAuth URLs and Scope
    GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
    GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
    GITHUB_API_USER_URL = "https://api.github.com/user"
    GITHUB_SCOPE = "read:user"

    # Rate Limiter Defaults
    RATELIMIT_DEFAULT = os.getenv('RATELIMIT_DEFAULT', '200 per day;50 per hour')
    RATELIMIT_STORAGE_URI = os.getenv('RATELIMIT_STORAGE_URI', 'memory://') # Consider redis for production
    RATELIMIT_STRATEGY = os.getenv('RATELIMIT_STRATEGY', 'fixed-window')
    RATELIMIT_ENABLED = os.getenv('RATELIMIT_ENABLED', 'True').lower() == 'true'

    # CORS Origins
    CORS_ORIGINS = "http://localhost:5173" # Adjust for production

    # Atlas Search Config
    ATLAS_SEARCH_INDEX_NAME = os.getenv('ATLAS_SEARCH_INDEX_NAME', 'default')
    ATLAS_SEARCH_SCORE_THRESHOLD = float(os.getenv('ATLAS_SEARCH_SCORE_THRESHOLD', 0))
    ATLAS_SEARCH_OVERALL_LIMIT = 2400

    # Default Pagination
    DEFAULT_PAGE_LIMIT = int(os.getenv('DEFAULT_PAGE_LIMIT', 12))

    # Collection Names (allow override via env vars)
    PAPERS_COLLECTION_NAME = os.getenv('PAPERS_COLLECTION_NAME', 'papers_without_code')
    USERS_COLLECTION_NAME = os.getenv('USERS_COLLECTION_NAME', 'users')
    REMOVED_PAPERS_COLLECTION_NAME = os.getenv('REMOVED_PAPERS_COLLECTION_NAME', 'removed_papers')
    USER_ACTIONS_COLLECTION_NAME = os.getenv('USER_ACTIONS_COLLECTION_NAME', 'user_actions')
    MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'papers2code') # Added for db connection
