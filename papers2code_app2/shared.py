from pymongo import MongoClient, DESCENDING, ASCENDING
from bson import ObjectId
from typing import Dict, Any, Optional
from datetime import datetime
import os

# --- Configuration Settings ---
# In a production FastAPI application, Pydantic's BaseSettings would be used here
# to load configuration from environment variables and .env files.
# For simplicity in this migration, we are using a class and os.getenv directly.

class AppConfig:
    # --- Environment Configuration ---
    ENV_TYPE: str = os.getenv("ENV_TYPE", "development") # e.g., "development", "production", "testing"

    # --- Status Constants ---
    STATUS_IMPLEMENTABLE: str = "implementable"
    STATUS_FLAGGED_NON_IMPLEMENTABLE: str = "flagged_non_implementable"
    # Using distinct DB status values for FastAPI to avoid conflicts if sharing DB during transition
    STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB: str = os.getenv("STATUS_CNI_DB_FASTAPI", "confirmed_non_implementable_fastapi")
    STATUS_CONFIRMED_IMPLEMENTABLE_DB: str = os.getenv("STATUS_CI_DB_FASTAPI", "confirmed_implementable_fastapi")
    
    # Display statuses (consistent with Flask app)
    STATUS_CONFIRMED_NON_IMPLEMENTABLE: str = "Confirmed Non-Implementable"
    STATUS_CONFIRMED_IMPLEMENTABLE: str = "Confirmed Implementable"
    STATUS_NOT_STARTED: str = "Not Started"

    # --- Thresholds ---
    NON_IMPLEMENTABLE_CONFIRM_THRESHOLD: int = int(os.getenv('NON_IMPLEMENTABLE_CONFIRM_THRESHOLD', 3))
    IMPLEMENTABLE_CONFIRM_THRESHOLD: int = int(os.getenv('IMPLEMENTABLE_CONFIRM_THRESHOLD', 3))

    # --- JWT Settings ---
    # It's crucial to set FASTAPI_SECRET_KEY in your environment for production.
    SECRET_KEY: str = os.getenv('FASTAPI_SECRET_KEY', "your-development-secret-key-please-change") 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', 30))
    REFRESH_TOKEN_EXPIRE_MINUTES: int = int(os.getenv('REFRESH_TOKEN_EXPIRE_MINUTES', 60 * 24 * 7)) # Default to 7 days
    STATE_TOKEN_EXPIRE_MINUTES: int = int(os.getenv('STATE_TOKEN_EXPIRE_MINUTES', 5)) # For OAuth state CSRF protection

    # --- GitHub OAuth ---
    GITHUB_CLIENT_ID: Optional[str] = os.getenv('GITHUB_CLIENT_ID')
    GITHUB_CLIENT_SECRET: Optional[str] = os.getenv('GITHUB_CLIENT_SECRET')
    GITHUB_SCOPE: str = "read:user" # Standard scope for reading user profile
    GITHUB_AUTHORIZE_URL: str = "https://github.com/login/oauth/authorize"
    GITHUB_ACCESS_TOKEN_URL: str = "https://github.com/login/oauth/access_token"
    GITHUB_API_USER_URL: str = "https://api.github.com/user"
    # GITHUB_CALLBACK_URL is typically constructed dynamically in the auth router
    # using request.url_for('github_callback'). If a fixed URL is needed due to proxy,
    # it could be configured here e.g. os.getenv('GITHUB_CALLBACK_URL_FULL_PATH')

    # --- Application Specific ---
    OWNER_GITHUB_USERNAME: Optional[str] = os.getenv('OWNER_GITHUB_USERNAME')
    FRONTEND_URL: str = os.getenv('FRONTEND_URL', 'http://localhost:5173') # Default for local dev
    
    # --- Search (e.g., MongoDB Atlas Search) ---
    ATLAS_SEARCH_INDEX_NAME: str = os.getenv('ATLAS_SEARCH_INDEX_NAME', 'default')

    # --- Database Configuration ---
    MONGO_URI: str = os.getenv('MONGO_URI', "mongodb://localhost:27017/")
    DB_NAME: str = os.getenv('DB_NAME', "papers2code_db_fastapi_dev") # Use a distinct DB name for FastAPI dev

    # --- Rate Limiting (NEW) ---
    # Example: "100/minute,2000/day" - loaded as a string, then parsed in main.py or wherever Limiter is initialized.
    # For simplicity here, we'll define it as a list of strings directly, assuming it's set correctly in ENV.
    # If set as a single string in ENV like "100/minute;50/hour", it would need parsing.
    DEFAULT_RATE_LIMITS_STR: Optional[str] = os.getenv("DEFAULT_RATE_LIMITS", "200 per day;50 per hour")
    
    @property
    def DEFAULT_RATE_LIMITS(self) -> list[str]:
        if self.DEFAULT_RATE_LIMITS_STR:
            return [limit.strip() for limit in self.DEFAULT_RATE_LIMITS_STR.split(';')]
        return ["200 per day", "50 per hour"] # Fallback default

    def __init__(self):
        # Basic validation on instantiation
        if not self.MONGO_URI:
            raise ValueError("No MONGO_URI found. Please set the MONGO_URI environment variable.")
        if not self.GITHUB_CLIENT_ID or not self.GITHUB_CLIENT_SECRET:
            print("Warning: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not found. GitHub OAuth will not function.")
        if self.SECRET_KEY == "your-development-secret-key-please-change" and self.ENV_TYPE == 'production':
            print("CRITICAL: Using default FASTAPI_SECRET_KEY in a production environment. Please set a strong secret.")
        if not self.OWNER_GITHUB_USERNAME:
            print("Warning: OWNER_GITHUB_USERNAME is not set. Owner-specific functionalities might be limited.")

config_settings = AppConfig()

# --- Database Connection ---
try:
    print(f"Attempting to connect to MongoDB: {config_settings.MONGO_URI}, DB: {config_settings.DB_NAME}")
    client = MongoClient(config_settings.MONGO_URI)
    # Ping the server to verify connection before proceeding
    client.admin.command('ping') 
    print("MongoDB server ping successful.")
    db = client[config_settings.DB_NAME]
    print(f"Successfully connected to MongoDB database: '{config_settings.DB_NAME}'.")
except Exception as e:
    # This makes the error during initial DB connection very explicit.
    print(f"CRITICAL: Failed to connect to MongoDB at {config_settings.MONGO_URI} (DB: {config_settings.DB_NAME}). Error: {e}")
    print("Application will use mock collections. Some functionalities will be severely limited or non-operational.")
    # Fallback to mock collections if connection fails, to allow code to run for demo/dev without DB
    # This is primarily for development or CI environments where a DB might not be available.

    print(f"WARNING: Failed to connect to MongoDB: {e}. Using mock collections.")
    # Fallback to mock collections if connection fails, to allow code to run for demo
    class MockCollection:
        def find_one(self, *args, **kwargs) -> Optional[Dict[str, Any]]: return None
        def find_one_and_update(self, *args, **kwargs) -> Optional[Dict[str, Any]]: return None
        def update_one(self, *args, **kwargs): return type('UpdateResult', (), {'modified_count': 0})
        def insert_one(self, *args, **kwargs): return type('InsertOneResult', (), {'inserted_id': ObjectId()})
        def delete_one(self, *args, **kwargs): return type('DeleteResult', (), {'deleted_count': 0})
        def delete_many(self, *args, **kwargs): return type('DeleteResult', (), {'deleted_count': 0})
    
    db_papers = MockCollection()
    db_user_actions = MockCollection()
    db_removed_papers = MockCollection()
    db_users = MockCollection()
else:
    db_papers = db["papers"]
    db_user_actions = db["user_actions"]
    db_removed_papers = db["removed_papers"]
    db_users = db["users"]

def get_papers_collection_sync():
    return db_papers

def get_user_actions_collection_sync():
    return db_user_actions

def get_removed_papers_collection_sync():
    return db_removed_papers

def get_users_collection_sync():
    # Ensure db_users is defined in the fallback case as well
    if "client" not in globals() or client is None: # Check if MongoDB connection failed
        # Return a mock collection if real connection failed
        return MockCollection() 
    return db_users

# --- transform_paper Placeholder ---
# This function should mirror your existing Flask app's transform_paper.
def transform_paper_sync(paper_doc: Optional[Dict[str, Any]], user_id_str: Optional[str]) -> Dict[str, Any]:
    if not paper_doc:
        return {} # Or raise an error, depending on expected behavior
    
    transformed = paper_doc.copy()
    if "_id" in transformed:
        transformed["id"] = str(transformed["_id"])
        del transformed["_id"]
    
    # Add any other transformations your UI expects.
    # For example, converting datetime objects to ISO strings if not handled by FastAPI's encoder.
    for key, value in transformed.items():
        if isinstance(value, datetime):
            transformed[key] = value.isoformat()
            
    # Example: Add user-specific information if needed (though this is often handled client-side)
    # if user_id_str:
    # transformed['user_has_voted'] = ... # Logic based on user_id_str and paper_doc

    return transformed

def ensure_db_indexes():
    """
    Ensures that the required MongoDB indexes are created for all collections.
    This function should be called on application startup.
    """
    print("Ensuring MongoDB indexes...")
    try:
        papers_collection = get_papers_collection_sync()
        users_collection = get_users_collection_sync()
        user_actions_collection = get_user_actions_collection_sync()
        removed_papers_collection = get_removed_papers_collection_sync() # Ensure this getter is available and works

        # Index definitions: (keys, options)
        # Note: Atlas Search indexes are managed via Atlas UI/API, not here.
        index_definitions = {
            papers_collection: [
                (("pwc_url", ASCENDING), {"name": "pwc_url_1", "unique": True, "background": True}),
                (("publication_date", DESCENDING), {"name": "publication_date_-1", "background": True}),
                (("upvoteCount", DESCENDING), {"name": "upvoteCount_-1", "background": True, "sparse": True}),
            ],
            users_collection: [
                (("githubId", ASCENDING), {"name": "githubId_1", "unique": True, "background": True}),
                (("username", ASCENDING), {"name": "username_1", "unique": True, "background": True, "sparse": True}),
            ],
            user_actions_collection: [
                ([
                    ("userId", ASCENDING),
                    ("paperId", ASCENDING),
                    ("actionType", ASCENDING)
                ], {"name": "userId_1_paperId_1_actionType_1", "unique": True, "background": True}),
                (("paperId", ASCENDING), {"name": "paperId_1", "background": True}), # Changed name from paperId_1_actions to paperId_1
            ],
            removed_papers_collection: [
                (("removedAt", DESCENDING), {"name": "removedAt_-1", "background": True}),
                (("original_pwc_url", ASCENDING), {"name": "original_pwc_url_1", "background": True}),
            ]
        }

        for collection, indexes_to_create in index_definitions.items():
            if collection is None: # Skip if a collection getter returned None
                actual_collection_name = "unknown"
                if collection is papers_collection:
                    actual_collection_name = "papers"
                elif collection is users_collection:
                    actual_collection_name = "users"
                elif collection is user_actions_collection:
                    actual_collection_name = "user_actions"
                elif collection is removed_papers_collection:
                    actual_collection_name = "removed_papers"

                print(f"Skipping index creation for '{actual_collection_name}' collection as it was None.")
                continue
            
            # Ensure collection name is available for logging, even for mock collections
            collection_name = getattr(collection, 'name', 'mock_collection_without_name')

            existing_indexes = collection.index_information()
            for keys, options in indexes_to_create:
                index_name = options['name']
                if index_name not in existing_indexes:
                    print(f"Creating index '{index_name}' on collection '{collection_name}'...")
                    collection.create_index(keys, **options)
                    print(f"Index '{index_name}' created.")
                else:
                    print(f"Index '{index_name}' already exists on collection '{collection_name}'.")

        # Verify Atlas Search Index (Informational)
        atlas_search_index_name = getattr(config_settings, 'ATLAS_SEARCH_INDEX_NAME', 'default')
        # Ensure papers_collection is not None before trying to use it
        if papers_collection is not None:
            papers_collection_name = getattr(papers_collection, 'name', 'papers (mock or unnamed)')
            try:
                list(papers_collection.aggregate([
                    {"$search": {"index": atlas_search_index_name, "text": {"query": "test", "path": "title"}}},
                    {"$limit": 1}
                ]))
                print(f"Atlas Search index '{atlas_search_index_name}' seems accessible on '{papers_collection_name}'.")
            except Exception as search_err:
                if "index not found" in str(search_err).lower() or (hasattr(search_err, 'details') and isinstance(search_err.details, dict) and "codeName" in search_err.details and search_err.details["codeName"] == "IndexNotFound"):
                    print(f"Warning: Atlas Search index '{atlas_search_index_name}' not found or not configured correctly on '{papers_collection_name}'. Please create it in MongoDB Atlas.")
                elif "unrecognized pipeline stage" in str(search_err).lower() or (hasattr(search_err, 'details') and isinstance(search_err.details, dict) and search_err.details.get("code") == 51265) : # 51265 is $search stage error if not on Atlas
                    print(f"Info: $search stage for Atlas Search index '{atlas_search_index_name}' is likely unavailable (not running on Atlas or Search Nodes not provisioned) on '{papers_collection_name}'. This is expected if not using Atlas Search.")
                else:
                    print(f"Warning: Could not verify Atlas Search index '{atlas_search_index_name}' on '{papers_collection_name}': {search_err}")
        else:
            print("Skipping Atlas Search index check as papers_collection is None.")
        
        print("MongoDB index check complete.")

    except Exception as e:
        print(f"Error during MongoDB indexing: {e}")
        import traceback
        traceback.print_exc()

