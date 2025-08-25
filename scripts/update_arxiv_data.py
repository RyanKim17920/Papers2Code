#!/usr/bin/env python3
"""
ArXiv Data Update Script

This script replaces update_pwc_data.py and extracts new papers from ArXiv
instead of Papers with Code (which has been sunsetted).

The script:
1. Extracts new papers from ArXiv since the last update
2. Inserts them into the MongoDB collection
3. Sets all new papers to "Needs Code" status for community curation

Author: GitHub Copilot Assistant
"""

import polars as pl
import logging
import os
import math
import time
from typing import List, Dict, Any, Optional, Set
from pymongo import MongoClient, InsertOne
from pymongo.errors import BulkWriteError
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta
from tqdm import tqdm

# Import our new ArXiv extractor
from arxiv_extractor import extract_new_arxiv_papers, get_last_update_timestamp

# --- Configuration ---
DB_NAME = "papers2code"
COLLECTION_NAME = "papers_without_code"
REMOVED_COLLECTION_NAME = "removed_papers"
UPDATE_METADATA_COLLECTION = "update_metadata"  # Track last update timestamps
MONGO_WRITE_BATCH_SIZE = 10000
POLARS_PROCESSING_BATCH_SIZE = 10000

# Load environment variables
load_dotenv()
MONGO_CONNECTION_STRING = os.environ.get("MONGO_URI")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_mongo_client(connection_string: Optional[str]) -> Optional[MongoClient]:
    """Establishes a connection to MongoDB."""
    if not connection_string:
        logging.error("MongoDB URI not found in environment variables.")
        return None
    try:
        client = MongoClient(connection_string, serverSelectionTimeoutMS=15000)
        client.admin.command("ping")
        logging.info("Connected to MongoDB.")
        return client
    except Exception as e:
        logging.error("MongoDB connection error: %s", e)
        return None

def get_last_successful_update(client: MongoClient, db_name: str) -> Optional[datetime]:
    """
    Get the timestamp of the last successful ArXiv update from the database.
    
    Returns:
        Datetime of last update, or None if no previous update found
    """
    try:
        db = client[db_name]
        metadata_collection = db[UPDATE_METADATA_COLLECTION]
        
        # Find the most recent successful ArXiv update
        last_update_doc = metadata_collection.find_one(
            {"update_type": "arxiv_extraction", "status": "success"},
            sort=[("completed_at", -1)]
        )
        
        if last_update_doc:
            last_update = last_update_doc["completed_at"]
            logging.info(f"Found last successful update: {last_update.isoformat()}")
            return last_update
        else:
            logging.info("No previous successful ArXiv update found")
            return None
            
    except Exception as e:
        logging.error(f"Error retrieving last update timestamp: {e}")
        return None

def save_update_metadata(
    client: MongoClient, 
    db_name: str, 
    start_time: datetime,
    end_time: datetime,
    papers_added: int,
    status: str = "success",
    error_message: Optional[str] = None
):
    """Save metadata about this update run."""
    try:
        db = client[db_name]
        metadata_collection = db[UPDATE_METADATA_COLLECTION]
        
        metadata_doc = {
            "update_type": "arxiv_extraction",
            "started_at": start_time,
            "completed_at": end_time,
            "papers_added": papers_added,
            "status": status,
            "error_message": error_message,
            "duration_seconds": (end_time - start_time).total_seconds()
        }
        
        metadata_collection.insert_one(metadata_doc)
        logging.info(f"Saved update metadata: {papers_added} papers added, status: {status}")
        
    except Exception as e:
        logging.error(f"Error saving update metadata: {e}")

def insert_new_arxiv_papers_batched(
    client: MongoClient,
    db_name: str,
    collection_name: str,
    new_papers_lf: pl.LazyFrame,
    polars_batch_size: int = 50000,
    mongo_batch_size: int = 5000
) -> int:
    """
    Insert new papers from ArXiv into MongoDB using batched operations.
    
    Returns:
        Number of papers successfully inserted
    """
    if new_papers_lf is None:
        logging.warning("No LazyFrame provided for new papers insertion.")
        return 0

    db = client[db_name]
    collection = db[collection_name]

    # Collect the LazyFrame
    try:
        start_collect = time.time()
        new_papers_df = new_papers_lf.collect(engine="streaming")
        collect_time = time.time() - start_collect
        
        if new_papers_df.height == 0:
            logging.info("No new papers found to insert.")
            return 0
            
        logging.info(f"Collected {new_papers_df.height} new papers in {collect_time:.2f}s. Shape: {new_papers_df.shape}")
        
    except Exception as e:
        logging.error(f"Error collecting new papers LazyFrame: {e}")
        return 0

    # Prepare and execute inserts
    total_inserted = 0
    mongo_ops_buffer = []
    num_batches = math.ceil(new_papers_df.height / polars_batch_size)
    
    logging.info(f"Processing {new_papers_df.height} new papers for insertion...")

    for batch_df in tqdm(new_papers_df.iter_slices(n_rows=polars_batch_size), total=num_batches, desc="Inserting ArXiv Papers"):
        if batch_df.height == 0:
            continue

        ops_to_add = []
        try:
            for record in batch_df.to_dicts():
                # Validate required fields
                if record.get("paper_url") and record.get("title"):
                    # Add fields required by the schema
                    record.update({
                        "status": "Needs Code",
                        "is_implementable": True,
                        "upvoteCount": 0,
                        "createdAt": datetime.now(timezone.utc),
                        "lastUpdated": datetime.now(timezone.utc)
                    })
                    
                    # Use paper_url as unique identifier (replacing pwc_url)
                    record["pwc_url"] = record["paper_url"]
                    
                    ops_to_add.append(InsertOne(record))
                else:
                    logging.warning("Skipping record due to missing required fields: %s", 
                                  record.get('title', 'N/A'))
                                  
        except Exception as e:
            logging.error(f"Error converting ArXiv papers batch to dicts: {e}")
            continue

        mongo_ops_buffer.extend(ops_to_add)

        # Write to MongoDB when buffer is full
        while len(mongo_ops_buffer) >= mongo_batch_size:
            ops_to_write = mongo_ops_buffer[:mongo_batch_size]
            mongo_ops_buffer = mongo_ops_buffer[mongo_batch_size:]
            
            try:
                result = collection.bulk_write(ops_to_write, ordered=False)
                inserted_count = result.inserted_count
                total_inserted += inserted_count
                logging.debug(f"Insert Batch: Inserted {inserted_count} new ArXiv papers.")
                
            except BulkWriteError as bwe:
                # Handle duplicate key errors gracefully
                inserted_count = bwe.write_result.inserted_count
                total_inserted += inserted_count
                
                logging.warning(f"Insert BulkWriteError: {len(bwe.write_errors)} errors, {inserted_count} inserted")
                
                # Log some sample errors for debugging
                for error in bwe.write_errors[:3]:  # Log first 3 errors
                    if error.get('code') == 11000:  # Duplicate key error
                        logging.debug("Duplicate paper skipped (already exists)")
                    else:
                        logging.warning(f"Insert error: {error}")
                        
            except Exception as e:
                logging.error(f"Generic insert error: {e}")

    # Write any remaining operations
    if mongo_ops_buffer:
        try:
            result = collection.bulk_write(mongo_ops_buffer, ordered=False)
            inserted_count = result.inserted_count
            total_inserted += inserted_count
            logging.debug(f"Final Insert Batch: Inserted {inserted_count} new papers.")
            
        except BulkWriteError as bwe:
            inserted_count = bwe.write_result.inserted_count
            total_inserted += inserted_count
            logging.warning(f"Final Insert BulkWriteError: {len(bwe.write_errors)} errors, {inserted_count} inserted")
            
        except Exception as e:
            logging.error(f"Final generic insert error: {e}")

    logging.info(f"Finished insertion. Total new documents inserted: {total_inserted}")
    return total_inserted

def main_arxiv_update():
    """
    Main function to update the database with new ArXiv papers.
    """
    start_total_time = time.time()
    start_time = datetime.now(timezone.utc)
    papers_added = 0
    error_message = None
    
    logging.info("Starting ArXiv data update job.")

    mongo_client = get_mongo_client(MONGO_CONNECTION_STRING)
    if not mongo_client:
        logging.error("Failed to connect to MongoDB. Exiting.")
        return

    try:
        db = mongo_client[DB_NAME]
        papers_collection = db[COLLECTION_NAME]

        # Ensure essential indexes exist
        try:
            papers_collection.create_index([("pwc_url", 1)], unique=True, background=True)
            papers_collection.create_index([("arxiv_id", 1)], background=True)
            logging.info("Indexes ensured.")
        except Exception as e:
            logging.warning("Could not ensure indexes: %s.", e)

        # Determine the last update timestamp
        last_update = get_last_successful_update(mongo_client, DB_NAME)
        if last_update is None:
            # First run - go back 30 days to get a good initial dataset
            since_date = datetime.now(timezone.utc) - timedelta(days=30)
            logging.info(f"First run detected, extracting papers since {since_date.isoformat()}")
        else:
            # Regular update - get papers since last successful update
            since_date = last_update
            logging.info(f"Incremental update since {since_date.isoformat()}")

        # Extract new papers from ArXiv
        logging.info("Extracting new papers from ArXiv...")
        new_papers_lf = extract_new_arxiv_papers(since_date=since_date)

        if new_papers_lf is None:
            logging.warning("Failed to extract papers from ArXiv")
            error_message = "Failed to extract papers from ArXiv"
        else:
            # Check existing papers to avoid duplicates
            logging.info("Checking for existing papers to avoid duplicates...")
            existing_urls_cursor = papers_collection.find({}, {"pwc_url": 1, "_id": 0})
            existing_urls: Set[str] = {doc['pwc_url'] for doc in existing_urls_cursor if doc.get('pwc_url')}
            logging.info(f"Found {len(existing_urls)} existing paper URLs in database")

            # Filter out papers that already exist
            if existing_urls:
                new_papers_lf = new_papers_lf.filter(
                    ~pl.col("paper_url").is_in(list(existing_urls))
                )

            # Insert new papers
            papers_added = insert_new_arxiv_papers_batched(
                mongo_client,
                DB_NAME,
                COLLECTION_NAME,
                new_papers_lf,
                polars_batch_size=POLARS_PROCESSING_BATCH_SIZE,
                mongo_batch_size=MONGO_WRITE_BATCH_SIZE
            )

    except Exception as e:
        error_message = str(e)
        logging.error(f"Error during ArXiv update: {e}")
        
    finally:
        # Save metadata about this update
        end_time = datetime.now(timezone.utc)
        status = "success" if error_message is None else "error"
        
        save_update_metadata(
            mongo_client, 
            DB_NAME, 
            start_time, 
            end_time, 
            papers_added,
            status,
            error_message
        )
        
        mongo_client.close()
        
    total_time = time.time() - start_total_time
    logging.info(f"ArXiv update job finished in {total_time:.2f}s. Papers added: {papers_added}")

if __name__ == "__main__":
    main_arxiv_update()