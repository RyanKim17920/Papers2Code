import os
from dotenv import load_dotenv # Make sure load_dotenv is imported

# --- Debugging for .env loading ---
print("Attempting to load .env file in config.py...")
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
print(f"Calculated .env path: {dotenv_path}")

# Load the .env file. override=True ensures .env takes precedence over existing env vars.
found_dotenv = load_dotenv(dotenv_path=dotenv_path, override=True)

if found_dotenv:
    print(f".env file loaded successfully from: {dotenv_path}")
else:
    print(f"Warning: .env file NOT loaded from {dotenv_path}.")
    print(f"Current working directory: {os.getcwd()}")
    # Check if the file exists at the expected path
    if os.path.exists(dotenv_path):
        print(f".env file DOES exist at {dotenv_path}, but load_dotenv() returned False.")
    else:
        print(f".env file DOES NOT exist at {dotenv_path}.")

raw_env_value = os.getenv('NON_IMPLEMENTABLE_CONFIRM_THRESHOLD')
print(f"Raw NON_IMPLEMENTABLE_CONFIRM_THRESHOLD from os.getenv: '{raw_env_value}' (type: {type(raw_env_value)})")
# --- End Debugging ---

class Config:
    # --- Core Configuration ---
    MONGO_URI = os.getenv('MONGO_URI_PROD_TEST')
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY')

    # --- GitHub OAuth ---
    GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID')
    GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET')
    GITHUB_SCOPE = "read:user"
    GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
    GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
    GITHUB_API_USER_URL = "https://api.github.com/user"

    # --- Application Specific ---
    OWNER_GITHUB_USERNAME = os.getenv('OWNER_GITHUB_USERNAME')
    NON_IMPLEMENTABLE_CONFIRM_THRESHOLD = int(os.getenv('NON_IMPLEMENTABLE_CONFIRM_THRESHOLD', 3)) 
    IMPLEMENTABLE_CONFIRM_THRESHOLD = int(os.getenv('IMPLEMENTABLE_CONFIRM_THRESHOLD', 3)) # New threshold
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

    # --- Status Constants ---
    STATUS_CONFIRMED_NON_IMPLEMENTABLE = "Confirmed Non-Implementable"
    STATUS_CONFIRMED_IMPLEMENTABLE = "Confirmed Implementable" # New display status
    STATUS_NOT_STARTED = "Not Started"
    STATUS_IMPLEMENTABLE = "implementable"
    STATUS_FLAGGED_NON_IMPLEMENTABLE = "flagged_non_implementable"
    STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB = "confirmed_non_implementable" # DB value
    STATUS_CONFIRMED_IMPLEMENTABLE_DB = "confirmed_implementable" # New DB value

    # --- Session Cookie Settings ---
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # --- Rate Limiter Settings ---
    RATELIMIT_STORAGE_URI = "memory://"
    RATELIMIT_STRATEGY = "fixed-window"
    RATELIMIT_DEFAULT_LIMITS = ["200 per day", "50 per hour"]

    # --- CORS Settings ---
    CORS_ORIGINS = "http://localhost:5173" # Or load from env var if needed

    # --- Validation ---
    @staticmethod
    def validate():
        if not Config.MONGO_URI:
            raise ValueError("No MONGO_URI found in environment variables")
        if not Config.GITHUB_CLIENT_ID or not Config.GITHUB_CLIENT_SECRET:
            raise ValueError("GitHub Client ID or Secret not found in environment variables")
        if not Config.SECRET_KEY:
            raise ValueError("FLASK_SECRET_KEY not found in environment variables")
        if not Config.OWNER_GITHUB_USERNAME:
            print("Warning: OWNER_GITHUB_USERNAME is not set in the environment. Owner-specific functionality might be limited.")

# Validate configuration on import
Config.validate()
