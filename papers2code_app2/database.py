\
# filepath: /media/ryankim17920/01DBCEABB99AC8E0/Users/ilove/CODING/Papers-2-code/papers2code_app2/database.py
import logging
from typing import Optional, Any, Tuple
from pymongo import MongoClient, ASCENDING, DESCENDING # Added ASCENDING, DESCENDING
from pymongo.database import Database
from bson import ObjectId # Keep ObjectId here if MockCollection uses it, or if it's conceptually part of DB interaction

from .shared import config_settings # Import config_settings, AppSettings will be resolved via this

logger = logging.getLogger(__name__)

# --- Database Connection Initialization ---
client: Optional[MongoClient] = None
db: Optional[Database] = None
db_papers: Any = None
db_user_actions: Any = None
db_removed_papers: Any = None
db_users: Any = None

def get_mongo_uri_and_db_name() -> Tuple[str, str]:
    env_type = config_settings.ENV_TYPE.upper()
    uri: Optional[str] = None
    db_name = "papers2code" # Default DB name

    logger.info(f"Determining MongoDB URI for ENV_TYPE: {env_type}, DB Name: {db_name}")

    if env_type == "PROD":
        uri = config_settings.MONGO_URI_PROD
    elif env_type == "PROD_TEST":
        uri = config_settings.MONGO_URI_PROD_TEST
    elif env_type == "DEV":
        uri = config_settings.MONGO_URI_DEV
    else:
        logger.warning(f"Unknown ENV_TYPE: '{config_settings.ENV_TYPE}'. Defaulting to DEV URI if available.")
        uri = config_settings.MONGO_URI_DEV

    if not uri:
        logger.critical(f"CRITICAL: MongoDB URI for ENV_TYPE '{env_type}' is not set. Check .env file for MONGO_URI_{env_type} or MONGO_URI_DEV.")
        raise ValueError(f"MongoDB URI for ENV_TYPE '{env_type}' is not configured.")
    
    logger.info(f"Using MongoDB URI for ENV_TYPE: {env_type}") # URI value itself is sensitive, not logged.
    logger.info(f"Using Database Name: {db_name} for ENV_TYPE: {env_type}")
    return uri, db_name

try:
    actual_mongo_uri, actual_db_name = get_mongo_uri_and_db_name()
    
    logger.info(f"Attempting to connect to MongoDB. Database: {actual_db_name}")
    client = MongoClient(actual_mongo_uri)
    client.admin.command('ping') 
    logger.info("MongoDB server ping successful. Connection established.")
    db = client[actual_db_name]
    logger.info(f"Successfully connected to MongoDB database: '{actual_db_name}'.")
    
    db_papers = db["papers"]
    db_user_actions = db["user_actions"]
    db_removed_papers = db["removed_papers"]
    db_users = db["users"]
    logger.info("Database collections initialized: papers, user_actions, removed_papers, users.")

except Exception as e:
    logger.critical(f"CRITICAL: Failed to connect to MongoDB. URI attempted: {globals().get('actual_mongo_uri', 'Not determined')}, DB Name attempted: {globals().get('actual_db_name', 'Not determined')}. Error: {e}", exc_info=True)

# --- Collection Accessor Functions ---
def get_papers_collection_sync():
    return db_papers

def get_user_actions_collection_sync():
    return db_user_actions

def get_removed_papers_collection_sync():
    return db_removed_papers

def get_users_collection_sync():
    return db_users

# --- Database Index Creation ---
def ensure_db_indexes():
    """
    Ensures that the necessary indexes are created in the MongoDB collections.
    This function should be called at application startup.
    """
    if client is None or db is None: 
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

            if "status_1" not in current_indexes_papers:
                db_papers.create_index([("status", ASCENDING)], name="status_1", sparse=True)
                logger.info("Created sparse index on 'status' in 'papers' collection.")
            else:
                logger.info("Index 'status_1' already exists in 'papers' collection.")

        # Indexes for user_actions collection
        if db_user_actions is not None:
            current_indexes_actions = db_user_actions.index_information()
            if "userId_1_paperId_1_actionType_1" not in current_indexes_actions:
                db_user_actions.create_index(
                    [("userId", ASCENDING), ("paperId", ASCENDING), ("actionType", ASCENDING)],
                    unique=True,
                    name="userId_1_paperId_1_actionType_1"
                )
                logger.info("Created unique compound index on 'userId', 'paperId', 'actionType' in 'user_actions' collection.")
            else:
                logger.info("Index 'userId_1_paperId_1_actionType_1' already exists in 'user_actions' collection.")
            
            if "paperId_1_actionType_1" not in current_indexes_actions:
                db_user_actions.create_index(
                    [("paperId", ASCENDING), ("actionType", ASCENDING)],
                    name="paperId_1_actionType_1"
                )
                logger.info("Created compound index on 'paperId', 'actionType' in 'user_actions' collection.")
            else:
                logger.info("Index 'paperId_1_actionType_1' already exists in 'user_actions' collection.")

        logger.info("Database index check/creation process complete.")

    except Exception as e:
        logger.error(f"Error during database index creation: {e}", exc_info=True)
