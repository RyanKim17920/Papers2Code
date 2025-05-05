from pymongo import MongoClient, DESCENDING, ASCENDING
import traceback
from flask import current_app

_db = None

def init_db(app):
    """Initializes the database connection and ensures indexes."""
    global _db
    mongo_uri = app.config.get('MONGO_URI')
    if not mongo_uri:
        app.logger.error("MONGO_URI not configured.")
        raise ValueError("MONGO_URI not configured.")

    try:
        client = MongoClient(mongo_uri)
        # Ping the server
        client.admin.command('ping')
        app.logger.info("Successfully connected to MongoDB.")
        _db = client.get_database(app.config.get('MONGO_DB_NAME', 'papers2code')) # Use config for DB name

        # --- Ensure Indexes ---
        app.logger.info("Ensuring database indexes...")
        ensure_indexes(_db, app.logger)
        app.logger.info("Index check complete.")

    except Exception as e:
        app.logger.error(f"Failed to connect to MongoDB or ensure indexes: {e}")
        traceback.print_exc()
        raise # Re-raise the exception to prevent app startup with bad DB state

def get_db():
    """Returns the database instance."""
    if _db is None:
        raise ConnectionError("Database is not initialized. Call init_db first.")
    return _db

def get_papers_collection():
    """Returns the papers collection instance."""
    try:
        db = get_db()
        return db[current_app.config.get('PAPERS_COLLECTION_NAME', 'papers_without_code')]
    except ConnectionError:
        current_app.logger.error("Attempted to get papers collection before DB initialization.")
        return None
    except Exception as e:
        current_app.logger.error(f"Error getting papers collection: {e}")
        return None

def get_users_collection():
    """Returns the users collection instance."""
    try:
        db = get_db()
        return db[current_app.config.get('USERS_COLLECTION_NAME', 'users')]
    except ConnectionError:
        current_app.logger.error("Attempted to get users collection before DB initialization.")
        return None
    except Exception as e:
        current_app.logger.error(f"Error getting users collection: {e}")
        return None

def get_removed_papers_collection():
    """Returns the removed_papers collection instance."""
    try:
        db = get_db()
        return db[current_app.config.get('REMOVED_PAPERS_COLLECTION_NAME', 'removed_papers')]
    except ConnectionError:
        current_app.logger.error("Attempted to get removed_papers collection before DB initialization.")
        return None
    except Exception as e:
        current_app.logger.error(f"Error getting removed_papers collection: {e}")
        return None

def get_user_actions_collection():
    """Returns the user_actions collection instance."""
    try:
        db = get_db()
        return db[current_app.config.get('USER_ACTIONS_COLLECTION_NAME', 'user_actions')]
    except ConnectionError:
        current_app.logger.error("Attempted to get user_actions collection before DB initialization.")
        return None
    except Exception as e:
        current_app.logger.error(f"Error getting user_actions collection: {e}")
        return None

def ensure_indexes(db, logger):
    """Creates necessary indexes if they don't exist."""
    papers_collection_name = current_app.config.get('PAPERS_COLLECTION_NAME', 'papers_without_code')
    users_collection_name = current_app.config.get('USERS_COLLECTION_NAME', 'users')
    removed_papers_collection_name = current_app.config.get('REMOVED_PAPERS_COLLECTION_NAME', 'removed_papers')
    user_actions_collection_name = current_app.config.get('USER_ACTIONS_COLLECTION_NAME', 'user_actions')

    collections = {
        papers_collection_name: db[papers_collection_name],
        users_collection_name: db[users_collection_name],
        removed_papers_collection_name: db[removed_papers_collection_name],
        user_actions_collection_name: db[user_actions_collection_name]
    }

    index_definitions = {
        papers_collection_name: [
            {"keys": [("pwc_url", 1)], "name": "pwc_url_1", "unique": True, "background": True},
            {"keys": [("publication_date", DESCENDING)], "name": "publication_date_-1", "background": True},
            {"keys": [("upvoteCount", DESCENDING)], "name": "upvoteCount_-1", "background": True, "sparse": True},
            {"keys": [("nonImplementableStatus", 1)], "name": "nonImplementableStatus_1", "background": True, "sparse": True},
        ],
        users_collection_name: [
            {"keys": [("githubId", 1)], "name": "githubId_1", "unique": True, "background": True},
            {"keys": [("isAdmin", 1)], "name": "isAdmin_1", "background": True, "sparse": True},
        ],
        removed_papers_collection_name: [
            {"keys": [("removedAt", DESCENDING)], "name": "removedAt_-1", "background": True},
            {"keys": [("original_pwc_url", 1)], "name": "original_pwc_url_1", "background": True},
        ],
        user_actions_collection_name: [
            {"keys": [("userId", 1), ("paperId", 1), ("actionType", 1)], "name": "userId_1_paperId_1_actionType_1", "unique": True, "background": True},
            {"keys": [("paperId", 1)], "name": "paperId_1", "background": True},
        ]
    }

    for coll_name, collection in collections.items():
        if coll_name not in index_definitions:
            continue

        try:
            existing_indexes = collection.index_information()
            logger.info(f"Existing indexes for {coll_name}: {list(existing_indexes.keys())}")

            for index_def in index_definitions[coll_name]:
                index_name = index_def["name"]
                if index_name not in existing_indexes:
                    logger.info(f"Creating index '{index_name}' on collection '{coll_name}'...")
                    keys = index_def["keys"]
                    options = {k: v for k, v in index_def.items() if k not in ["keys", "name"]}
                    collection.create_index(keys, name=index_name, **options)
                    logger.info(f"Index '{index_name}' created successfully.")
                else:
                    logger.info(f"Index '{index_name}' already exists on collection '{coll_name}'.")
        except Exception as e:
            logger.error(f"Error ensuring indexes for collection {coll_name}: {e}")
            traceback.print_exc()