import os
import logging
from typing import Optional, Any, Dict
from pymongo import MongoClient, DESCENDING, ASCENDING
from pymongo.database import Database
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from datetime import datetime

# Explicitly load .env here if not relying solely on pydantic_settings for early access
# or if needing to debug raw os.getenv values before pydantic model instantiation.
# However, pydantic_settings with SettingsConfigDict(env_file=".env") should handle it.
# For robust debugging, let's ensure it's loaded if we want to print raw env vars.
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
loaded_env = load_dotenv(dotenv_path=env_path, override=True)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Log raw environment variables before Pydantic model instantiation for debugging
logger.info(f"Raw os.getenv('ENV_TYPE'): {os.getenv('ENV_TYPE')}")
logger.info(f"Raw os.getenv('MONGO_URI_DEV'): {os.getenv('MONGO_URI_DEV')}")
logger.info(f"Raw os.getenv('MONGO_URI_PROD'): {os.getenv('MONGO_URI_PROD')}")
logger.info(f"Raw os.getenv('MONGO_URI_PROD_TEST'): {os.getenv('MONGO_URI_PROD_TEST')}")
logger.info(f"Raw os.getenv('STATUS_CNI_DB_FASTAPI'): {os.getenv('STATUS_CNI_DB_FASTAPI')}")
logger.info(f"Raw os.getenv('ATLAS_SEARCH_INDEX_NAME'): {os.getenv('ATLAS_SEARCH_INDEX_NAME')}")
logger.info(f"Raw os.getenv('ATLAS_SEARCH_SCORE_THRESHOLD'): {os.getenv('ATLAS_SEARCH_SCORE_THRESHOLD')}")
logger.info(f"Raw os.getenv('ATLAS_SEARCH_OVERALL_LIMIT'): {os.getenv('ATLAS_SEARCH_OVERALL_LIMIT')}")
logger.info(f"Raw os.getenv('ATLAS_SEARCH_TITLE_BOOST'): {os.getenv('ATLAS_SEARCH_TITLE_BOOST')}")
logger.info(f"Raw os.getenv('FLASK_SECRET_KEY'): {os.getenv('FLASK_SECRET_KEY')}") # Log raw SECRET_KEY
logger.info(f"Raw os.getenv('ALGORITHM'): {os.getenv('ALGORITHM')}") # Log raw ALGORITHM
logger.info(f"Raw os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES'): {os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES')}") # Log raw ACCESS_TOKEN_EXPIRE_MINUTES
logger.info(f"Raw os.getenv('REFRESH_TOKEN_EXPIRE_MINUTES'): {os.getenv('REFRESH_TOKEN_EXPIRE_MINUTES')}") # Log raw REFRESH_TOKEN_EXPIRE_MINUTES
logger.info(f"Raw os.getenv('OWNER_GITHUB_USERNAME'): {os.getenv('OWNER_GITHUB_USERNAME')}") # Log raw OWNER_GITHUB_USERNAME
logger.info(f"Raw os.getenv('GITHUB_CLIENT_ID'): {os.getenv('GITHUB_CLIENT_ID')}") # Log raw GITHUB_CLIENT_ID
logger.info(f"Raw os.getenv('GITHUB_CLIENT_SECRET'): {os.getenv('GITHUB_CLIENT_SECRET')}") # Log raw GITHUB_CLIENT_SECRET
logger.info(f"Raw os.getenv('FRONTEND_URL'): {os.getenv('FRONTEND_URL')}") # Log raw FRONTEND_URL

class AppSettings(BaseSettings):
    ENV_TYPE: str = "DEV"
    MONGO_URI_DEV: Optional[str] = None
    MONGO_URI_PROD: Optional[str] = None
    MONGO_URI_PROD_TEST: Optional[str] = None
    FLASK_SECRET_KEY: Optional[str] = None # Add SECRET_KEY field
    ALGORITHM: str = "HS256" # Add ALGORITHM field with a default
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 # Add ACCESS_TOKEN_EXPIRE_MINUTES with a default
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080 # Add REFRESH_TOKEN_EXPIRE_MINUTES, default 7 days
    OWNER_GITHUB_USERNAME: Optional[str] = None # Add OWNER_GITHUB_USERNAME
    APP_LOG_LEVEL: str = "INFO" # Default log level

    # GitHub OAuth Settings
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_AUTHORIZE_URL: str = "https://github.com/login/oauth/authorize"
    GITHUB_ACCESS_TOKEN_URL: str = "https://github.com/login/oauth/access_token"
    GITHUB_API_USER_URL: str = "https://api.github.com/user"
    GITHUB_SCOPE: str = "user:email"
    FRONTEND_URL: str = "http://localhost:5173" # Default for Vite, adjust if your UI runs elsewhere
    
    STATUS_CNI_DB_FASTAPI: str = "implementable" # Default DB value if env var not set

    # Status constants
    STATUS_IMPLEMENTABLE: str = "implementable"
    STATUS_FLAGGED_NON_IMPLEMENTABLE: str = "flagged_non_implementable"
    STATUS_CONFIRMED_IMPLEMENTABLE_DB: str = "confirmed_implementable"
    # STATUS_CNI_DB_FASTAPI is already present and used for STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB
    
    # Voting Thresholds
    NON_IMPLEMENTABLE_CONFIRM_THRESHOLD: int = 3 
    IMPLEMENTABLE_CONFIRM_THRESHOLD: int = 2

    # This will use the value of STATUS_CNI_DB_FASTAPI from .env or the default above
    STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB: str = Field(default_factory=lambda: os.getenv("STATUS_CNI_DB_FASTAPI", "confirmed_non_implementable"))

    # Atlas Search settings with defaults
    ATLAS_SEARCH_INDEX_NAME: str = "default" # Default index name
    ATLAS_SEARCH_SCORE_THRESHOLD: float = 0.5 # Default score threshold
    ATLAS_SEARCH_OVERALL_LIMIT: int = 1000 # Default overall limit for search results
    ATLAS_SEARCH_TITLE_BOOST: float = 3.0 # Default boost for title field

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

config_settings = AppSettings()

# Log the settings loaded by Pydantic
logger.info(f"Loaded config_settings.ENV_TYPE: {config_settings.ENV_TYPE}")
logger.info(f"Loaded config_settings.MONGO_URI_DEV: {config_settings.MONGO_URI_DEV}")
logger.info(f"Loaded config_settings.MONGO_URI_PROD: {config_settings.MONGO_URI_PROD}")
logger.info(f"Loaded config_settings.MONGO_URI_PROD_TEST: {config_settings.MONGO_URI_PROD_TEST}")
logger.info(f"Loaded config_settings.STATUS_CNI_DB_FASTAPI: {config_settings.STATUS_CNI_DB_FASTAPI}")
logger.info(f"Loaded config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB: {config_settings.STATUS_CONFIRMED_NON_IMPLEMENTABLE_DB}")
logger.info(f"Loaded config_settings.ATLAS_SEARCH_INDEX_NAME: {config_settings.ATLAS_SEARCH_INDEX_NAME}")
logger.info(f"Loaded config_settings.ATLAS_SEARCH_SCORE_THRESHOLD: {config_settings.ATLAS_SEARCH_SCORE_THRESHOLD}")
logger.info(f"Loaded config_settings.ATLAS_SEARCH_OVERALL_LIMIT: {config_settings.ATLAS_SEARCH_OVERALL_LIMIT}")
logger.info(f"Loaded config_settings.ATLAS_SEARCH_TITLE_BOOST: {config_settings.ATLAS_SEARCH_TITLE_BOOST}")
logger.info(f"Loaded config_settings.SECRET_KEY: {config_settings.FLASK_SECRET_KEY}") # Log loaded SECRET_KEY
logger.info(f"Loaded config_settings.ALGORITHM: {config_settings.ALGORITHM}") # Log loaded ALGORITHM
logger.info(f"Loaded config_settings.ACCESS_TOKEN_EXPIRE_MINUTES: {config_settings.ACCESS_TOKEN_EXPIRE_MINUTES}") # Log loaded ACCESS_TOKEN_EXPIRE_MINUTES
logger.info(f"Loaded config_settings.REFRESH_TOKEN_EXPIRE_MINUTES: {config_settings.REFRESH_TOKEN_EXPIRE_MINUTES}") # Log loaded REFRESH_TOKEN_EXPIRE_MINUTES
logger.info(f"Loaded config_settings.OWNER_GITHUB_USERNAME: {config_settings.OWNER_GITHUB_USERNAME}") # Log loaded OWNER_GITHUB_USERNAME
logger.info(f"Loaded config_settings.GITHUB_CLIENT_ID: {config_settings.GITHUB_CLIENT_ID}") # Log loaded GITHUB_CLIENT_ID
logger.info(f"Loaded config_settings.GITHUB_CLIENT_SECRET: {'********' if config_settings.GITHUB_CLIENT_SECRET else None}") # Log loaded GITHUB_CLIENT_SECRET (masked)
logger.info(f"Loaded config_settings.FRONTEND_URL: {config_settings.FRONTEND_URL}") # Log loaded FRONTEND_URL

def get_mongo_uri_and_db_name(settings: AppSettings) -> tuple[str, str]:
    env_type = settings.ENV_TYPE.upper()
    uri: Optional[str] = None
    db_name = "papers2code" # Use "papers2code" as the database name convention

    logger.info(f"Determining MongoDB URI for ENV_TYPE: {env_type}, DB Name will be: {db_name}")

    if env_type == "PROD":
        uri = settings.MONGO_URI_PROD
    elif env_type == "PROD_TEST":
        uri = settings.MONGO_URI_PROD_TEST
    elif env_type == "DEV":
        uri = settings.MONGO_URI_DEV
    else:
        logger.warning(f"Unknown ENV_TYPE: '{settings.ENV_TYPE}'. Defaulting to DEV URI if available.")
        uri = settings.MONGO_URI_DEV # Fallback to DEV URI
        # db_name remains "papers2code"

    if not uri:
        logger.critical(f"CRITICAL: MongoDB URI for ENV_TYPE '{env_type}' is not set or resolved. Please check .env file for MONGO_URI_{env_type.upper()} or MONGO_URI_DEV as fallback.")
        raise ValueError(f"MongoDB URI for ENV_TYPE '{env_type}' is not configured.")
    
    logger.info(f"Selected URI: {uri} for ENV_TYPE: {env_type}")
    logger.info(f"Selected DB Name: {db_name} (overridden) for ENV_TYPE: {env_type}")
    return uri, db_name

# --- Database Connection ---
client: Optional[MongoClient] = None
db: Optional[Database] = None
db_papers: Any = None
db_user_actions: Any = None
db_removed_papers: Any = None
db_users: Any = None

try:
    actual_mongo_uri, actual_db_name = get_mongo_uri_and_db_name(config_settings)
    
    logger.info(f"Attempting to connect to MongoDB URI: {actual_mongo_uri}, Database: {actual_db_name}")
    client = MongoClient(actual_mongo_uri)
    # Ping the server to verify connection before proceeding
    client.admin.command('ping') 
    logger.info("MongoDB server ping successful.")
    db = client[actual_db_name]
    logger.info(f"Successfully connected to MongoDB database: '{actual_db_name}'.")
    
    # Initialize collections after successful connection
    db_papers = db["papers"]
    db_user_actions = db["user_actions"]
    db_removed_papers = db["removed_papers"]
    db_users = db["users"]

except Exception as e:
    logger.critical(f"CRITICAL: Failed to connect to MongoDB. URI attempted: {globals().get('actual_mongo_uri', 'Not determined')}, DB Name attempted: {globals().get('actual_db_name', 'Not determined')}. Error: {e}", exc_info=True)
    logger.warning("Application will use mock collections. Some functionalities will be severely limited or non-operational.")
    
    class MockCollection:
        def __init__(self, name="mock"):
            self._name = name
            logger.info(f"MockCollection '{self._name}' initialized.")
        def find_one(self, *args, **kwargs) -> Optional[Dict[str, Any]]: return None
        def find(self, *args, **kwargs): return iter([]) # Ensure find returns an iterable
        def count_documents(self, *args, **kwargs) -> int: return 0
        def find_one_and_update(self, *args, **kwargs) -> Optional[Dict[str, Any]]: return None
        def update_one(self, *args, **kwargs): return type('UpdateResult', (), {'modified_count': 0})
        def insert_one(self, *args, **kwargs): return type('InsertOneResult', (), {'inserted_id': ObjectId()})
        def delete_one(self, *args, **kwargs): return type('DeleteResult', (), {'deleted_count': 0})
        def delete_many(self, *args, **kwargs): return type('DeleteResult', (), {'deleted_count': 0})
        def aggregate(self, *args, **kwargs): return iter([]) # Ensure aggregate returns an iterable
        def index_information(self, *args, **kwargs): return {} # Mock index_information
        def create_index(self, *args, **kwargs): pass # Mock create_index

    # Fallback to mock collections if connection fails
    db_papers = MockCollection("papers")
    db_user_actions = MockCollection("user_actions")
    db_removed_papers = MockCollection("removed_papers")
    db_users = MockCollection("users")

# Ensure collections are defined even if the 'else' block of the try-except was skipped
# This is mostly for type hinting and ensuring the names are always available.
if db_papers is None:
    db_papers = MockCollection("papers_fallback")

if db_user_actions is None:
    db_user_actions = MockCollection("user_actions_fallback")

if db_removed_papers is None:
    db_removed_papers = MockCollection("removed_papers_fallback")

if db_users is None:
    db_users = MockCollection("users_fallback")

def get_papers_collection_sync():
    return db_papers

def get_user_actions_collection_sync():
    return db_user_actions

def get_removed_papers_collection_sync():
    return db_removed_papers

def get_users_collection_sync():
    if "client" not in globals() or client is None:
        return MockCollection()
    return db_users

def transform_paper_sync(paper_doc: Dict[str, Any], current_user_id_str: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Transforms a paper document from MongoDB to a dictionary suitable for PaperResponse,
    handling potential missing fields and converting types where necessary.
    Includes user-specific information like 'has_upvoted'.
    """
    if not paper_doc:
        return None

    # Ensure authors are a list of strings
    authors_data = paper_doc.get("authors", [])
    if authors_data and isinstance(authors_data, list) and all(isinstance(author, dict) for author in authors_data):
        authors_list = [author.get("name") for author in authors_data if author.get("name")]
    elif authors_data and isinstance(authors_data, list) and all(isinstance(author, str) for author in authors_data):
        authors_list = authors_data
    else:
        authors_list = [] # Default to empty list if format is unexpected

    # Convert ObjectId to string for id
    paper_id = str(paper_doc["_id"]) if "_id" in paper_doc else None
    if not paper_id:
        return None # Should not happen if doc is from DB

    # Handle potentially empty or invalid URL strings by converting them to None
    url_pdf_value = paper_doc.get("urlPdf") # Already camelCase from DB or previous Pydantic model
    url_abs_value = paper_doc.get("urlAbs")

    # Convert empty strings or non-string values for URLs to None so Pydantic HttpUrl handles them correctly
    transformed_url_pdf = str(url_pdf_value) if url_pdf_value and isinstance(url_pdf_value, str) and url_pdf_value.strip() else None
    transformed_url_abs = str(url_abs_value) if url_abs_value and isinstance(url_abs_value, str) and url_abs_value.strip() else None

    # so much random stuff added by copilot
    # TODO: Review and clean up the code below this line if necessary
    transformed_data = {
        "id": paper_id,
        "title": paper_doc.get("title"),
        "authors": authors_list,
        "publicationDate": paper_doc.get("publicationDate"),
        "abstract": paper_doc.get("abstract"),
        "arxivId": paper_doc.get("arxivId"),
        "urlPdf": transformed_url_pdf, # Use the processed value
        "urlAbs": transformed_url_abs, # Use the processed value
        "tags": paper_doc.get("tags", []),
        "publicationYear": paper_doc.get("publicationYear"),
        "venue": paper_doc.get("venue"),
        "citationsCount": paper_doc.get("citationsCount"),
        "addedDate": paper_doc.get("addedDate", datetime.now()), # Default if missing
        "lastModifiedDate": paper_doc.get("lastModifiedDate", datetime.now()), # Default if missing
        "upvoteCount": paper_doc.get("upvoteCount", 0),
        "viewCount": paper_doc.get("viewCount", 0),
        "isNonImplementable": paper_doc.get("isNonImplementable", False),
        "nonImplementableStatus": paper_doc.get("nonImplementableStatus", config_settings.STATUS_IMPLEMENTABLE),
        "nonImplementableReason": paper_doc.get("nonImplementableReason"),
        "hasUpvoted": False, # Default, will be updated below if user context is available
        "hasSaved": False, # Default for saved status
        "hasFlaggedNonImplementable": False, # Default for flagged status
        "hasConfirmedNonImplementable": False, # Default for confirmed status
        "hasDisputedNonImplementable": False, # Default for disputed status
        "score": paper_doc.get("score"), # For Atlas Search results
    }

    # If user context is provided, check for user-specific actions
    if current_user_id_str:
        try:
            user_obj_id = ObjectId(current_user_id_str)
            user_actions_collection = get_user_actions_collection_sync()

            # Check for upvote
            if user_actions_collection.count_documents({"userId": user_obj_id, "paperId": paper_doc["_id"], "actionType": "upvote"}) > 0:
                transformed_data["hasUpvoted"] = True
            
            # Check for saved (assuming 'save' is an actionType)
            if user_actions_collection.count_documents({"userId": user_obj_id, "paperId": paper_doc["_id"], "actionType": "save"}) > 0:
                transformed_data["hasSaved"] = True

            # Check for non-implementable flags by the current user
            # These action types are examples; adjust to your actual stored values
            if user_actions_collection.count_documents({"userId": user_obj_id, "paperId": paper_doc["_id"], "actionType": "flag_non_implementable"}) > 0:
                transformed_data["hasFlaggedNonImplementable"] = True
            if user_actions_collection.count_documents({"userId": user_obj_id, "paperId": paper_doc["_id"], "actionType": "confirm_non_implementable"}) > 0:
                transformed_data["hasConfirmedNonImplementable"] = True
            if user_actions_collection.count_documents({"userId": user_obj_id, "paperId": paper_doc["_id"], "actionType": "dispute_non_implementable"}) > 0:
                transformed_data["hasDisputedNonImplementable"] = True

        except InvalidId:
            logger.warning(f"Invalid current_user_id_str: {current_user_id_str} during transform_paper_sync for paper {paper_id}. Cannot determine user-specific actions.")
        except Exception as e:
            logger.error(f"Error checking user actions in transform_paper_sync for paper {paper_id}, user {current_user_id_str}: {e}", exc_info=True)

    return transformed_data


def ensure_db_indexes():
    """
    Ensures that the necessary indexes are created in the MongoDB collections.
    This function should be called at application startup.
    """
    if "client" not in globals() or client is None or db is None:
        logger.error("Database client or db object not initialized. Skipping index creation.")
        return

    try:
        # Index for users collection
        if db_users is not None:
            current_indexes_users = db_users.index_information()
            if "username_1" not in current_indexes_users:
                db_users.create_index([("username", ASCENDING)], unique=True, name="username_1")
                logger.info("Created unique index on 'username' in 'users' collection.")
            else:
                logger.info("Index 'username_1' already exists in 'users' collection.")
            
            if "githubId_1" not in current_indexes_users:
                db_users.create_index([("githubId", ASCENDING)], unique=True, sparse=True, name="githubId_1")
                logger.info("Created unique, sparse index on 'githubId' in 'users' collection.")
            else:
                logger.info("Index 'githubId_1' already exists in 'users' collection.")

        # Indexes for papers collection
        if db_papers is not None:
            current_indexes_papers = db_papers.index_information()
            if "primary_paper_id_1" not in current_indexes_papers:
                db_papers.create_index([("primary_paper_id", ASCENDING)], name="primary_paper_id_1", sparse=True)
                logger.info("Created sparse index on 'primary_paper_id' in 'papers' collection.")
            else:
                logger.info("Index 'primary_paper_id_1' already exists in 'papers' collection.")

            if "arxiv_id_1" not in current_indexes_papers:
                db_papers.create_index([("arxiv_id", ASCENDING)], name="arxiv_id_1", sparse=True)
                logger.info("Created sparse index on 'arxiv_id' in 'papers' collection.")
            else:
                logger.info("Index 'arxiv_id_1' already exists in 'papers' collection.")

            if "created_at_-1" not in current_indexes_papers:
                db_papers.create_index([("created_at", DESCENDING)], name="created_at_-1")
                logger.info("Created descending index on 'created_at' in 'papers' collection.")
            else:
                logger.info("Index 'created_at_-1' already exists in 'papers' collection.")
            
            if "updated_at_-1" not in current_indexes_papers:
                db_papers.create_index([("updated_at", DESCENDING)], name="updated_at_-1")
                logger.info("Created descending index on 'updated_at' in 'papers' collection.")
            else:
                logger.info("Index 'updated_at_-1' already exists in 'papers' collection.")

            if "internal_status_1" not in current_indexes_papers:
                db_papers.create_index([("internal_status", ASCENDING)], name="internal_status_1", sparse=True)
                logger.info("Created sparse index on 'internal_status' in 'papers' collection.")
            else:
                logger.info("Index 'internal_status_1' already exists in 'papers' collection.")
            
            if "is_public_1" not in current_indexes_papers:
                db_papers.create_index([("is_public", ASCENDING)], name="is_public_1")
                logger.info("Created index on 'is_public' in 'papers' collection.")
            else:
                logger.info("Index 'is_public_1' already exists in 'papers' collection.")        # Indexes for user_actions collection
        if db_user_actions is not None:
            current_indexes_actions = db_user_actions.index_information()
            if "user_id_1_paper_id_1_action_type_1" not in current_indexes_actions:
                db_user_actions.create_index(
                    [("user_id", ASCENDING), ("paper_id", ASCENDING), ("action_type", ASCENDING)],
                    unique=True,
                    name="user_id_1_paper_id_1_action_type_1"
                )
                logger.info("Created unique compound index on 'user_id', 'paper_id', 'action_type' in 'user_actions' collection.")
            else:
                logger.info("Index 'user_id_1_paper_id_1_action_type_1' already exists in 'user_actions' collection.")
            
            if "paper_id_1_action_type_1" not in current_indexes_actions:
                db_user_actions.create_index(
                    [("paper_id", ASCENDING), ("action_type", ASCENDING)],
                    name="paper_id_1_action_type_1"
                )
                logger.info("Created compound index on 'paper_id', 'action_type' in 'user_actions' collection.")
            else:
                logger.info("Index 'paper_id_1_action_type_1' already exists in 'user_actions' collection.")

        logger.info("Database index check/creation process complete.")

    except Exception as e:
        logger.error(f"Error during database index creation: {e}", exc_info=True)

