\
# filepath: /media/ryankim17920/01DBCEABB99AC8E0/Users/ilove/CODING/Papers-2-code/papers2code_app2/database.py
import logging
from typing import Optional, Any, Tuple
from pymongo import MongoClient, ASCENDING, DESCENDING # For sync client and indexes
from pymongo import AsyncMongoClient # Changed from motor.motor_asyncio
from pymongo.database import Database as SyncDatabase # Alias for clarity
from pymongo.database import Database as AsyncDatabase # For type hinting with AsyncMongoClient
from pymongo.collection import Collection as AsyncCollection # For type hinting with AsyncMongoClient
from bson import ObjectId

from .shared import config_settings

logger = logging.getLogger(__name__)

# --- Synchronous Database Connection Initialization ---
sync_client: Optional[MongoClient] = None
sync_db: Optional[SyncDatabase] = None
# Sync collection variables (can be phased out or kept for specific sync tasks if any)
db_papers_sync: Any = None
db_user_actions_sync: Any = None
db_removed_papers_sync: Any = None
db_users_sync: Any = None

# --- Asynchronous Database Connection Initialization ---
async_client: Optional[AsyncMongoClient] = None # Changed type
async_db: Optional[AsyncDatabase] = None # Changed type
# Async collection variables
db_papers_async: Optional[AsyncCollection] = None # Changed type
db_user_actions_async: Optional[AsyncCollection] = None # Changed type
db_removed_papers_async: Optional[AsyncCollection] = None # Changed type
db_users_async: Optional[AsyncCollection] = None # Changed type
db_paper_links_async: Optional[AsyncCollection] = None # ADDED: For paper_links collection


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

async def initialize_async_db():
    """Initializes the asynchronous database connection and collections using PyMongo Async API."""
    global async_client, async_db, db_papers_async, db_user_actions_async, db_removed_papers_async, db_users_async, db_paper_links_async # MODIFIED: Added db_paper_links_async
    
    if async_client and async_db:
        logger.info("Asynchronous database connection already initialized.")
        return

    actual_mongo_uri, actual_db_name = get_mongo_uri_and_db_name()
    
    try:
        logger.info(f"Attempting to connect to MongoDB asynchronously using PyMongo. Database: {actual_db_name}")
        async_client = AsyncMongoClient(actual_mongo_uri) # Changed from AsyncIOMotorClient
        
        # Ping the server to confirm connection
        await async_client.admin.command('ping')
        logger.info("Async MongoDB server ping successful (PyMongo Async). Connection established.")
        
        async_db = async_client[actual_db_name]
        logger.info(f"Successfully connected to async MongoDB database (PyMongo Async): '{actual_db_name}'.")
        
        db_papers_async = async_db["papers"]
        db_user_actions_async = async_db["user_actions"]
        db_removed_papers_async = async_db["removed_papers"]
        db_users_async = async_db["users"]
        db_paper_links_async = async_db["paper_links"] # ADDED: Initialize paper_links collection
        logger.info("Async database collections initialized (PyMongo Async): papers, user_actions, removed_papers, users, paper_links.") # MODIFIED: Updated log message

    except Exception as e:
        logger.critical(f"CRITICAL: Failed to connect to MongoDB asynchronously. URI attempted: {globals().get('actual_mongo_uri', 'Not determined')}, DB Name attempted: {globals().get('actual_db_name', 'Not determined')}. Error: {e}", exc_info=True)

def initialize_sync_db():
    """Initializes the synchronous database connection and collections."""
    global sync_client, sync_db, db_papers_sync, db_user_actions_sync, db_removed_papers_sync, db_users_sync
    
    if sync_client and sync_db:
        logger.info("Synchronous database connection already initialized.")
        return

    actual_mongo_uri, actual_db_name = get_mongo_uri_and_db_name()
    
    try:
        logger.info(f"Attempting to connect to MongoDB. Database: {actual_db_name}")
        sync_client = MongoClient(actual_mongo_uri)
        sync_client.admin.command('ping') 
        logger.info("MongoDB server ping successful. Connection established.")
        sync_db = sync_client[actual_db_name]
        logger.info(f"Successfully connected to MongoDB database: '{actual_db_name}'.")
        
        db_papers_sync = sync_db["papers"]
        db_user_actions_sync = sync_db["user_actions"]
        db_removed_papers_sync = sync_db["removed_papers"]
        db_users_sync = sync_db["users"]
        logger.info("Database collections initialized: papers, user_actions, removed_papers, users.")

    except Exception as e:
        logger.critical(f"CRITICAL: Failed to connect to MongoDB. URI attempted: {globals().get('actual_mongo_uri', 'Not determined')}, DB Name attempted: {globals().get('actual_db_name', 'Not determined')}. Error: {e}", exc_info=True)

# --- Collection Accessor Functions ---
def get_papers_collection_sync():
    return db_papers_sync

def get_user_actions_collection_sync():
    return db_user_actions_sync

def get_removed_papers_collection_sync():
    return db_removed_papers_sync

def get_users_collection_sync():
    return db_users_sync

# --- Async Collection Accessor Functions ---
async def get_papers_collection_async() -> AsyncCollection: # Return type updated
    # Ensure db_papers_async is compared with None
    if db_papers_async is None: 
        await initialize_async_db()
    # Second check after potential initialization
    if db_papers_async is None: 
        raise Exception("Asynchronous papers collection not initialized after attempt.")
    return db_papers_async

async def get_user_actions_collection_async() -> AsyncCollection: # Return type updated
    # Ensure db_user_actions_async is compared with None
    if db_user_actions_async is None: 
        await initialize_async_db()
    if db_user_actions_async is None: 
        raise Exception("Asynchronous user_actions collection not initialized after attempt.")
    return db_user_actions_async

async def get_removed_papers_collection_async() -> AsyncCollection: # Return type updated
    # Ensure db_removed_papers_async is compared with None
    if db_removed_papers_async is None: 
        await initialize_async_db()
    if db_removed_papers_async is None: 
        raise Exception("Asynchronous removed_papers collection not initialized after attempt.")
    return db_removed_papers_async

async def get_users_collection_async() -> AsyncCollection: # Return type updated
    # Ensure db_users_async is compared with None
    if db_users_async is None: 
        await initialize_async_db() 
    if db_users_async is None: 
        raise Exception("Asynchronous users collection not initialized after attempt.")
    return db_users_async

async def get_paper_links_collection_async() -> AsyncCollection:
    # Ensure db_paper_links_async is compared with None
    if db_paper_links_async is None: 
        await initialize_async_db()
    if db_paper_links_async is None: 
        raise Exception("Asynchronous paper_links collection not initialized after attempt.")
    return db_paper_links_async

# --- Database Index Creation (using sync client for now, can be adapted if needed) ---
def ensure_db_indexes():
    """
    Ensures that the necessary indexes are created in the MongoDB collections.
    This function should be called at application startup.
    """
    if sync_client is None or sync_db is None: 
        logger.error("Database client or db object not initialized. Skipping index creation.")
        return

    try:
        # Index for users collection
        if db_users_sync is not None: 
            current_indexes_users = db_users_sync.index_information()
            if "username_1" not in current_indexes_users:
                db_users_sync.create_index([("username", ASCENDING)], unique=True, name="username_1")
                logger.info("Created unique index on 'username' in 'users' collection.")
            else:
                logger.info("Index 'username_1' already exists in 'users' collection.")
            
            if "githubId_1" not in current_indexes_users:
                db_users_sync.create_index([("githubId", ASCENDING)], unique=True, sparse=True, name="githubId_1")
                logger.info("Created unique, sparse index on 'githubId' in 'users' collection.")
            else:
                logger.info("Index 'githubId_1' already exists in 'users' collection.")


        # Indexes for papers collection
        if db_papers_sync is not None:
            current_indexes_papers = db_papers_sync.index_information()
            if "primary_paper_id_1" not in current_indexes_papers:
                db_papers_sync.create_index([("primary_paper_id", ASCENDING)], name="primary_paper_id_1", sparse=True)
                logger.info("Created sparse index on 'primary_paper_id' in 'papers' collection.")
            else:
                logger.info("Index 'primary_paper_id_1' already exists in 'papers' collection.")

            if "arxivId_1" not in current_indexes_papers: # Changed from arxiv_id
                db_papers_sync.create_index([("arxivId", ASCENDING)], name="arxivId_1", sparse=True) # Changed from arxiv_id
                logger.info("Created sparse index on 'arxivId' in 'papers' collection.")
            else:
                logger.info("Index 'arxivId_1' already exists in 'papers' collection.")

            if "creationDate_-1" not in current_indexes_papers: # Changed from created_at
                db_papers_sync.create_index([("creationDate", DESCENDING)], name="creationDate_-1") # Changed from created_at
                logger.info("Created descending index on 'creationDate' in 'papers' collection.")
            else:
                logger.info("Index 'creationDate_-1' already exists in 'papers' collection.")
            
            if "lastUpdateDate_-1" not in current_indexes_papers: # Changed from updated_at
                db_papers_sync.create_index([("lastUpdateDate", DESCENDING)], name="lastUpdateDate_-1") # Changed from updated_at
                logger.info("Created descending index on 'lastUpdateDate' in 'papers' collection.")
            else:
                logger.info("Index 'lastUpdateDate_-1' already exists in 'papers' collection.")

            if "status_1" not in current_indexes_papers:
                db_papers_sync.create_index([("status", ASCENDING)], name="status_1", sparse=True)
                logger.info("Created sparse index on 'status' in 'papers' collection.")
            else:
                logger.info("Index 'status_1' already exists in 'papers' collection.")

        # Indexes for user_actions collection
        if db_user_actions_sync is not None:
            current_indexes_actions = db_user_actions_sync.index_information()
            if "userId_1_paperId_1_actionType_1" not in current_indexes_actions:
                db_user_actions_sync.create_index(
                    [("userId", ASCENDING), ("paperId", ASCENDING), ("actionType", ASCENDING)],
                    unique=True,
                    name="userId_1_paperId_1_actionType_1"
                )
                logger.info("Created unique compound index on 'userId', 'paperId', 'actionType' in 'user_actions' collection.")
            else:
                logger.info("Index 'userId_1_paperId_1_actionType_1' already exists in 'user_actions' collection.")
            
            if "paperId_1_actionType_1" not in current_indexes_actions:
                db_user_actions_sync.create_index(
                    [("paperId", ASCENDING), ("actionType", ASCENDING)],
                    name="paperId_1_actionType_1"
                )
                logger.info("Created compound index on 'paperId', 'actionType' in 'user_actions' collection.")
            else:
                logger.info("Index 'paperId_1_actionType_1' already exists in 'user_actions' collection.")

        logger.info("Database index check/creation process complete.")

    except Exception as e:
        logger.error(f"Error during database index creation: {e}", exc_info=True)
