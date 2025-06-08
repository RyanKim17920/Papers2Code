# filepath: /media/ryankim17920/01DBCEABB99AC8E0/Users/ilove/CODING/Papers-2-code/papers2code_app2/database.py
import logging
from typing import Optional, Any, Tuple
from pymongo import MongoClient, ASCENDING, DESCENDING # For sync client and indexes
from pymongo import AsyncMongoClient 
from pymongo.database import Database as SyncDatabase # Alias for clarity
from pymongo.database import Database as AsyncDatabase # For type hinting with AsyncMongoClient
from pymongo.collection import Collection as AsyncCollection # For type hinting with AsyncMongoClient

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
db_implementation_progress_sync: Any = None # Ensure it's declared global if not already

# --- Asynchronous Database Connection Initialization ---
async_client: Optional[AsyncMongoClient] = None # Changed type
async_db: Optional[AsyncDatabase] = None # Changed type
# Async collection variables
db_papers_async: Optional[AsyncCollection] = None # Changed type
db_user_actions_async: Optional[AsyncCollection] = None # Changed type
db_removed_papers_async: Optional[AsyncCollection] = None # Changed type
db_users_async: Optional[AsyncCollection] = None # Changed type
db_implementation_progress_async: Optional[AsyncCollection] = None 


def get_mongo_uri_and_db_name() -> Tuple[str, str]:
    env_type = config_settings.ENV_TYPE.upper()
    uri: Optional[str] = None
    db_name = "papers2code" # Default DB name

    #logger.info(f"Determining MongoDB URI for ENV_TYPE: {env_type}, DB Name: {db_name}")

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
    
    #logger.info(f"Using MongoDB URI for ENV_TYPE: {env_type}") # URI value itself is sensitive, not logged.
    #logger.info(f"Using Database Name: {db_name} for ENV_TYPE: {env_type}")
    return uri, db_name

async def initialize_async_db():
    """Initializes the asynchronous database connection and collections using PyMongo Async API."""
    global async_client, async_db, db_papers_async, db_user_actions_async, db_removed_papers_async, db_users_async, db_implementation_progress_async
    
    if async_client and async_db:
        #logger.info("Asynchronous database connection already initialized.")
        return

    actual_mongo_uri, actual_db_name = get_mongo_uri_and_db_name()
    
    try:
        #logger.info(f"Attempting to connect to MongoDB asynchronously using PyMongo. Database: {actual_db_name}")
        async_client = AsyncMongoClient(actual_mongo_uri) 
        
        # Ping the server to confirm connection
        await async_client.admin.command('ping')
        #logger.info("Async MongoDB server ping successful (PyMongo Async). Connection established.")
        
        async_db = async_client[actual_db_name]
        #logger.info(f"Successfully connected to async MongoDB database (PyMongo Async): '{actual_db_name}'.")
        
        db_papers_async = async_db["papers"]
        db_user_actions_async = async_db["user_actions"]
        db_removed_papers_async = async_db["removed_papers"]
        db_users_async = async_db["users"]
        db_implementation_progress_async = async_db["implementation_progress"] # ADDED: Initialize implementation_progress collection
        #logger.info("Async database collections initialized (PyMongo Async): papers, user_actions, removed_papers, users, implementation_progress.") : Updated log message

    except Exception as e:
        logger.critical(f"CRITICAL: Failed to connect to MongoDB asynchronously. URI attempted: {globals().get('actual_mongo_uri', 'Not determined')}, DB Name attempted: {globals().get('actual_db_name', 'Not determined')}. Error: {e}", exc_info=True)

def initialize_sync_db():
    """Initializes the synchronous database connection and collections."""
    global sync_client, sync_db, db_papers_sync, db_user_actions_sync, db_removed_papers_sync, db_users_sync, db_implementation_progress_sync 
    
    if sync_client and sync_db:
        #logger.info("Synchronous database connection already initialized.")
        return

    actual_mongo_uri, actual_db_name = get_mongo_uri_and_db_name()
    
    try:
        #logger.info(f"Attempting to connect to MongoDB. Database: {actual_db_name}")
        sync_client = MongoClient(actual_mongo_uri)
        sync_client.admin.command('ping') 
        #logger.info("MongoDB server ping successful. Connection established.")
        sync_db = sync_client[actual_db_name]
        #logger.info(f"Successfully connected to MongoDB database: '{actual_db_name}'.")
        
        db_papers_sync = sync_db["papers"]
        db_user_actions_sync = sync_db["user_actions"]
        db_removed_papers_sync = sync_db["removed_papers"]
        db_users_sync = sync_db["users"]
        db_implementation_progress_sync = sync_db["implementation_progress"]
        #logger.info("Sync database collections initialized: papers, user_actions, removed_papers, users, implementation_progress.") : Updated log message

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

async def get_implementation_progress_collection_async() -> AsyncCollection:
    # Ensure db_implementation_progress_async is compared with None
    if db_implementation_progress_async is None: 
        await initialize_async_db()
    if db_implementation_progress_async is None: 
        raise Exception("Asynchronous implementation_progress collection not initialized after attempt.") # FIXED: Added missing raise Exception
    return db_implementation_progress_async

async def ensure_db_indexes_async():
    """
    Ensures that the necessary indexes are created asynchronously in the MongoDB collections.
    This function should be called at application startup.
    Field names are based on Pydantic schema aliases where applicable (which should match DB fields).
    """
    global async_db, db_papers_async, db_users_async, db_removed_papers_async, db_user_actions_async, db_implementation_progress_async

    if async_db is None:
        logger.info("Async database not initialized. Attempting to initialize for index creation.")
        await initialize_async_db()
        if async_db is None:
            logger.critical("CRITICAL: Async database (async_db) is still not initialized after attempt. Cannot ensure indexes.")
            return
    
    # Ensure all collection objects are available
    # Assign from global scope to local dictionary for easier access
    collections_to_check = {
        "papers": db_papers_async,
        "users": db_users_async,
        "removed_papers": db_removed_papers_async,
        "user_actions": db_user_actions_async,
        "implementation_progress": db_implementation_progress_async
    }
    
    # Check and re-initialize if any collection is None
    for col_name in list(collections_to_check.keys()): # Iterate over keys if dict is modified
        if collections_to_check[col_name] is None:
            logger.warning(f"Async collection '{col_name}' is not initialized. Attempting to re-initialize all async DB components.")
            await initialize_async_db()
            # Update local references from potentially changed global ones
            collections_to_check["papers"] = db_papers_async
            collections_to_check["users"] = db_users_async
            collections_to_check["removed_papers"] = db_removed_papers_async
            collections_to_check["user_actions"] = db_user_actions_async
            collections_to_check["implementation_progress"] = db_implementation_progress_async
            
            if collections_to_check[col_name] is None:
                logger.critical(f"CRITICAL: Async collection '{col_name}' still not initialized after re-attempt. Aborting index creation.")
                return 

    logger.info("Ensuring asynchronous MongoDB indexes...")

    try:
        all_index_definitions = [
            (collections_to_check["papers"], [
                ([("pwcUrl", ASCENDING)], {"name": "pwcUrl_1_papers_async", "unique": True, "sparse": True}),
                ([("publicationDate", DESCENDING)], {"name": "publicationDate_-1_papers_async"}),
                ([("upvoteCount", DESCENDING)], {"name": "upvoteCount_-1_papers_async", "sparse": True}),
                ([("arxivId", ASCENDING)], {"name": "arxivId_1_papers_async", "sparse": True}),
                ([("status", ASCENDING), ("publicationDate", DESCENDING)], {"name": "status_1_publicationDate_-1_papers_async"}),
                ([("status", ASCENDING), ("upvoteCount", DESCENDING)], {"name": "status_1_upvoteCount_-1_papers_async", "sparse": True}),
                ([("title", ASCENDING)], {"name": "title_1_papers_async", "collation": {"locale": "en", "strength": 5}, "sparse": True}), # strength:5 for case-insensitivity
                ([("implementabilityStatus", ASCENDING)], {"name": "implementabilityStatus_1_papers_async"}),
            ]),
            (collections_to_check["users"], [
                ([("githubId", ASCENDING)], {"name": "githubId_1_users_async", "unique": True, "sparse": True}),
                ([("username", ASCENDING)], {"name": "username_1_users_async", "unique": True, "sparse":True}), # Made sparse as username might not always be present initially
            ]),
            (collections_to_check["removed_papers"], [
                ([("removedAt", DESCENDING)], {"name": "removedAt_-1_removed_papers_async"}),
                ([("pwcUrl", ASCENDING)], {"name": "pwcUrl_1_removed_papers_async", "sparse": True}),
            ]),
            (collections_to_check["user_actions"], [
                ([("userId", ASCENDING), ("paperId", ASCENDING), ("actionType", ASCENDING)], {"name": "userId_1_paperId_1_actionType_1_user_actions_async", "unique": True}),
                ([("paperId", ASCENDING)], {"name": "paperId_1_user_actions_async"}), # For querying actions by paper
                ([("userId", ASCENDING)], {"name": "userId_1_user_actions_async"}),   # For querying actions by user
                ([("paperId", ASCENDING), ("actionType", ASCENDING)], {"name": "paperId_1_actionType_1_user_actions_async"}), # For specific action on a paper
            ]),
            (collections_to_check["implementation_progress"], [
                ([("paperId", ASCENDING)], {"name": "paperId_1_impl_progress_async", "unique": True}),
                ([("status", ASCENDING)], {"name": "status_1_impl_progress_async"}),
            ])
        ]

        for collection_obj, index_list_for_collection in all_index_definitions:
            if collection_obj is None: # Corrected condition
                logger.warning("Collection object is None during index definition loop. Skipping. This indicates an issue with db initialization.")
                continue

            collection_name = collection_obj.name
            logger.info(f"Processing indexes for collection: {collection_name}")
            try:
                existing_indexes_info = await collection_obj.index_information()
                existing_indexes_names_in_db = list(existing_indexes_info.keys())
                
                # Get a set of index names that are defined in our Python code for this collection
                defined_index_names_in_code = {opts['name'] for _, opts in index_list_for_collection}

                # Log the defined and existing indexes for easier debugging
                logger.info(f"Collection '{collection_name}': Defined index names in code: {sorted(list(defined_index_names_in_code))}")
                logger.info(f"Collection '{collection_name}': Existing index names in DB: {sorted(existing_indexes_names_in_db)}")

                # Deletion phase: Drop indexes that exist in DB but not in our Python definitions
                for existing_name in existing_indexes_names_in_db:
                    if existing_name == "_id_": # Never attempt to drop the default _id index
                        continue
                    if existing_name not in defined_index_names_in_code:
                        logger.info(f"Index '{existing_name}' in collection '{collection_name}' is in DB but not in code definitions. Attempting to drop.")
                        try:
                            await collection_obj.drop_index(existing_name)
                            logger.info(f"Successfully dropped index '{existing_name}' from collection '{collection_name}'.")
                        except Exception as e_drop:
                            logger.error(f"Failed to drop index '{existing_name}' from collection '{collection_name}': {e_drop}", exc_info=True)
                    # else: # Optional: log that the index is defined and kept
                    #    logger.debug(f"Index '{existing_name}' in collection '{collection_name}' is defined in code. No deletion action.")

                # Creation phase: Create indexes defined in Python code if they don't exist in DB
                # Re-fetch index information after potential drops to ensure we check against the current state
                current_db_indexes_info = await collection_obj.index_information()
                current_db_indexes_names = list(current_db_indexes_info.keys())
                
                for keys_spec, options_dict in index_list_for_collection:
                    index_name_to_ensure = options_dict['name']
                    
                    if index_name_to_ensure not in current_db_indexes_names:
                        logger.info(f"Creating index '{index_name_to_ensure}' on collection '{collection_name}' with keys {keys_spec} and options {options_dict}...")
                        await collection_obj.create_index(keys_spec, **options_dict)
                        logger.info(f"Index '{index_name_to_ensure}' created on '{collection_name}'.")
                    else:
                        # Corrected f-string
                        logger.info(f"Index '{index_name_to_ensure}' already exists on collection '{collection_name}'.")
            except Exception as e_col:
                logger.error(f"Error processing indexes for collection '{collection_name}': {e_col}", exc_info=True)
        
        logger.info("Asynchronous MongoDB index check/creation/deletion process complete.")

    except Exception as e:
        logger.error(f"An unexpected error occurred during asynchronous MongoDB indexing: {e}", exc_info=True)

# --- Database Index Creation (using sync client for now, can be adapted if needed) ---
#def ensure_db_indexes():
#    \"\"\"
#    Ensures that the necessary indexes are created in the MongoDB collections.
#    This function should be called at application startup.
#    \"\"\"
#    if sync_client is None or sync_db is None: 
#        logger.error("Database client or db object not initialized. Skipping index creation.")
#        return
#
#    try:
#        # Index for users collection
#        if db_users_sync is not None: 
#            current_indexes_users = db_users_sync.index_information()
#            if "username_1" not in current_indexes_users:
#                db_users_sync.create_index([("username", ASCENDING)], unique=True, name="username_1")
#                #logger.info("Created unique index on 'username' in 'users' collection.")
#            #else:
#                #logger.info("Index 'username_1' already exists in 'users' collection.")
#            
#            if "githubId_1" not in current_indexes_users:
#                db_users_sync.create_index([("githubId", ASCENDING)], unique=True, sparse=True, name="githubId_1")
#                #logger.info("Created unique, sparse index on 'githubId' in 'users' collection.")
#            #else:
#                #logger.info("Index 'githubId_1' already exists in 'users' collection.")
#
#
#        # Indexes for papers collection
#        if db_papers_sync is not None:
#            current_indexes_papers = db_papers_sync.index_information()
#            if "primary_paper_id_1" not in current_indexes_papers:
#                db_papers_sync.create_index([("primary_paper_id", ASCENDING)], name="primary_paper_id_1", sparse=True)
#                #logger.info("Created sparse index on 'primary_paper_id' in 'papers' collection.")
#            #else:
#                #logger.info("Index 'primary_paper_id_1' already exists in 'papers' collection.")
#
#            if "arxivId_1" not in current_indexes_papers: # Changed from arxiv_id
#                db_papers_sync.create_index([("arxivId", ASCENDING)], name="arxivId_1", sparse=True) # Changed from arxiv_id
#                #logger.info("Created sparse index on 'arxivId' in 'papers' collection.")
#            #else:
#                #logger.info("Index 'arxivId_1' already exists in 'papers' collection.")
#
#            if "creationDate_-1" not in current_indexes_papers: # Changed from created_at
#                db_papers_sync.create_index([("creationDate", DESCENDING)], name="creationDate_-1") # Changed from created_at
#                #logger.info("Created descending index on 'creationDate' in 'papers' collection.")
#            #else:
#                #logger.info("Index 'creationDate_-1' already exists in 'papers' collection.")
#            
#            if "lastUpdateDate_-1" not in current_indexes_papers: # Changed from updated_at
#                db_papers_sync.create_index([("lastUpdateDate", DESCENDING)], name="lastUpdateDate_-1") # Changed from updated_at
#                #logger.info("Created descending index on 'lastUpdateDate' in 'papers' collection.")
#            #else:
#                #logger.info("Index 'lastUpdateDate_-1' already exists in 'papers' collection.")
#
#            if "status_1" not in current_indexes_papers:
#                db_papers_sync.create_index([("status", ASCENDING)], name="status_1", sparse=True)
#                #logger.info("Created sparse index on 'status' in 'papers' collection.")
#            #else:
#                #logger.info("Index 'status_1' already exists in 'papers' collection.")
#
#        # Indexes for user_actions collection
#        if db_user_actions_sync is not None:
#            current_indexes_actions = db_user_actions_sync.index_information()
#            if "userId_1_paperId_1_actionType_1" not in current_indexes_actions:
#                db_user_actions_sync.create_index(
#                    [("userId", ASCENDING), ("paperId", ASCENDING), ("actionType", ASCENDING)],
#                    unique=True,
#                    name="userId_1_paperId_1_actionType_1"
#                )
#                #logger.info("Created unique compound index on 'userId', 'paperId', 'actionType' in 'user_actions' collection.")
#            #else:
#                #logger.info("Index 'userId_1_paperId_1_actionType_1' already exists in 'user_actions' collection.")
#            
#            if "paperId_1_actionType_1" not in current_indexes_actions:
#                db_user_actions_sync.create_index(
#                    [("paperId", ASCENDING), ("actionType", ASCENDING)],
#                    name="paperId_1_actionType_1"
#                )
#                #logger.info("Created compound index on 'paperId', 'actionType' in 'user_actions' collection.")
#            #else:
#            #    logger.info("Index 'paperId_1_actionType_1' already exists in 'user_actions' collection.")
#
#        # Indexes for implementation_progress collection
#        if db_implementation_progress_sync is not None:
#            current_indexes_progress = db_implementation_progress_sync.index_information()
#            if "paper_id_1" not in current_indexes_progress:
#                # Assuming one progress document per paper_id, hence unique=True
#                db_implementation_progress_sync.create_index([("paper_id", ASCENDING)], name="paper_id_1", unique=True)
#                logger.info("Created unique index on 'paper_id' in 'implementation_progress' collection.")
#            #else:
#                #logger.info("Index 'paper_id_1' already exists in 'implementation_progress' collection.")
#
#        #logger.info("Database index check/creation process complete.")
#
#    except Exception as e:
#        logger.error(f"Error during database index creation: {e}", exc_info=True)
#
# Comment out or delete the old synchronous ensure_db_indexes function.
# The following is now handled by ensure_db_indexes_async.
