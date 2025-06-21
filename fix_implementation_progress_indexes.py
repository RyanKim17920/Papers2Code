#!/usr/bin/env python3
"""
Script to drop the old paperId index from implementation_progress collection
and clean up any duplicate documents with null paperId values
"""

import asyncio
import logging
from pymongo import AsyncMongoClient
from bson import ObjectId
import sys
import os

# Add the project root to Python path so we can import settings
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from papers2code_app2.shared import config_settings

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def get_database():
    """Get the database connection"""
    env_type = config_settings.ENV_TYPE.upper()
    
    if env_type == "PROD":
        uri = config_settings.MONGO_URI_PROD
    elif env_type == "PROD_TEST":
        uri = config_settings.MONGO_URI_PROD_TEST
    elif env_type == "DEV":
        uri = config_settings.MONGO_URI_DEV
    else:
        logger.warning(f"Unknown ENV_TYPE: '{config_settings.ENV_TYPE}'. Defaulting to DEV URI.")
        uri = config_settings.MONGO_URI_DEV

    if not uri:
        raise ValueError(f"No MongoDB URI found for environment: {env_type}")

    client = AsyncMongoClient(uri)
    db = client["papers2code"]
    return client, db

async def fix_implementation_progress_indexes():
    """Drop old paperId index and clean up data"""
    client, db = await get_database()
    
    try:
        progress_collection = db["implementation_progress"]
        
        # First, check what indexes exist
        logger.info("Current indexes in implementation_progress collection:")
        indexes = await progress_collection.index_information()
        for name, info in indexes.items():
            logger.info(f"  {name}: {info}")
        
        # Drop the problematic paperId index if it exists
        if "paperId_1_impl_progress_async" in indexes:
            logger.info("Dropping old paperId_1_impl_progress_async index...")
            await progress_collection.drop_index("paperId_1_impl_progress_async")
            logger.info("Successfully dropped paperId_1_impl_progress_async index")
        else:
            logger.info("paperId_1_impl_progress_async index not found")
        
        # Check for documents with paperId field and remove them if they exist
        logger.info("Checking for documents with paperId field...")
        
        # Find documents that have a paperId field
        docs_with_paperid = await progress_collection.find({"paperId": {"$exists": True}}).to_list(None)
        logger.info(f"Found {len(docs_with_paperid)} documents with paperId field")
        
        if docs_with_paperid:
            logger.info("Sample documents with paperId:")
            for i, doc in enumerate(docs_with_paperid[:3]):  # Show first 3
                logger.info(f"  Doc {i+1}: _id={doc.get('_id')}, paperId={doc.get('paperId')}")
        
        # Remove documents with null paperId (these are likely causing the duplicate key error)
        null_paperid_docs = await progress_collection.find({"paperId": None}).to_list(None)
        logger.info(f"Found {len(null_paperid_docs)} documents with paperId: null")
        
        if null_paperid_docs:
            logger.info("Removing documents with paperId: null...")
            result = await progress_collection.delete_many({"paperId": None})
            logger.info(f"Deleted {result.deleted_count} documents with paperId: null")
        
        # Also remove any documents that have a paperId field but are using the old schema
        if docs_with_paperid:
            logger.info("Removing all documents with old paperId field...")
            result = await progress_collection.delete_many({"paperId": {"$exists": True}})
            logger.info(f"Deleted {result.deleted_count} documents with old paperId field")
        
        # Show final state
        total_docs = await progress_collection.count_documents({})
        logger.info(f"Total documents remaining in implementation_progress: {total_docs}")
        
        # Show remaining indexes
        logger.info("Final indexes in implementation_progress collection:")
        final_indexes = await progress_collection.index_information()
        for name, info in final_indexes.items():
            logger.info(f"  {name}: {info}")
            
    except Exception as e:
        logger.error(f"Error fixing implementation progress indexes: {e}")
        raise
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(fix_implementation_progress_indexes())
