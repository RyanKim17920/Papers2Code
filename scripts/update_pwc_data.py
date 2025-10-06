# update_pwc_data.py

import requests
import gzip
import json
import polars as pl
import logging
import io
import os
import math
from typing import List, Dict, Any, Optional, Set
from pymongo import MongoClient, UpdateOne, InsertOne  # <-- Import UpdateOne, InsertOne
from pymongo.errors import BulkWriteError
from dotenv import load_dotenv
from scripts.utils_dbkeys import get_pwc_url, snake_to_camel
import time # For timing operations
from tqdm import tqdm
from datetime import datetime, timezone # <-- Import datetime

# --- Configuration ---
# Reuse constants from process_pwc_data.py
LINKS_URL = "https://production-media.paperswithcode.com/about/links-between-papers-and-code.json.gz"
ABSTRACTS_URL = "https://production-media.paperswithcode.com/about/papers-with-abstracts.json.gz"
DB_NAME = "papers2code"
# NOTE: Your main collection seems to be 'papers_without_code' based on app.py and process_pwc_data.py
# It might be better named 'papers' if it will eventually hold papers *with* code too.
# We'll use the existing name for now.
COLLECTION_NAME = "papers_without_code"
REMOVED_COLLECTION_NAME = "removed_papers"
MONGO_WRITE_BATCH_SIZE = 10000  # Adjust batch size as needed
POLARS_PROCESSING_BATCH_SIZE = 10000 # How many rows Polars processes at once for new papers

# Load environment variables
load_dotenv()
MONGO_CONNECTION_STRING = os.environ.get("MONGO_URI")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions (Copied/Adapted from process_pwc_data.py) ---

def download_and_extract_json(url: str) -> Optional[List[Dict[str, Any]]]:
    """Downloads, decompresses, and parses JSON data from a gzipped URL."""
    logging.info("Downloading data from %s", url)
    try:
        response = requests.get(url, timeout=300)
        response.raise_for_status()
        with gzip.open(io.BytesIO(response.content), mode='rt', encoding='utf-8') as f: # Specify encoding
            data = json.load(f)
        if not isinstance(data, list):
            logging.warning("Data from %s is not a list", url)
            return None
        logging.info("Successfully downloaded and parsed %d records from %s", len(data), url)
        return data
    except Exception as e:
        logging.error("Error processing %s: %s", url, e)
        return None

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

def batch_mongo_updates(collection, operations: List[UpdateOne], batch_size: int):
    """Executes MongoDB UpdateOne operations in batches."""
    if not operations:
        return 0

    total_modified = 0
    num_batches = math.ceil(len(operations) / batch_size)
    logging.info(f"Executing {len(operations)} update operations in {num_batches} batches.")

    for i in tqdm(range(0, len(operations), batch_size), desc="Updating Docs"):
        batch = operations[i:i + batch_size]
        try:
            result = collection.bulk_write(batch, ordered=False)
            modified_count = result.modified_count
            total_modified += modified_count
            logging.debug(f"Update Batch {i//batch_size + 1}: Matched={result.matched_count}, Modified={modified_count}")
        except BulkWriteError as bwe:
            logging.error(f"Update BulkWriteError in batch {i//batch_size + 1}: {bwe.details}")
        except Exception as e:
            logging.error(f"Generic update error in batch {i//batch_size + 1}: {e}")

    logging.info(f"Finished updates. Total documents modified: {total_modified}")
    return total_modified

def insert_new_papers_batched(
    client: MongoClient,
    db_name: str,
    collection_name: str,
    new_papers_lf: pl.LazyFrame,
    polars_batch_size: int = 50000,
    mongo_batch_size: int = 5000
):
    """
    Collects a LazyFrame of NEW papers and inserts them into MongoDB using InsertOne.
    """
    if new_papers_lf is None:
        logging.warning("No LazyFrame provided for new papers insertion.")
        return 0

    db = client[db_name]
    collection = db[collection_name]

    # --- Collect the LazyFrame ---
    # This step still requires memory for the *new* papers data.
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

    # --- Prepare and Execute Inserts ---
    total_inserted = 0
    mongo_ops_buffer = []
    num_batches = math.ceil(new_papers_df.height / polars_batch_size)
    logging.info(f"Processing {new_papers_df.height} new papers for insertion...")

    for batch_df in tqdm(new_papers_df.iter_slices(n_rows=polars_batch_size), total=num_batches, desc="Inserting New"):
        if batch_df.height == 0:
            continue

        ops_to_add = []
        try:
            for record in batch_df.to_dicts():
                # Normalize incoming record keys to camelCase for storage
                record = snake_to_camel(record)
                if get_pwc_url(record): # Basic validation
                    # Use InsertOne for new documents
                    ops_to_add.append(InsertOne(record))
                else:
                    logging.warning("Skipping new record due to missing 'pwcUrl': %s", record.get('title', 'N/A'))
        except Exception as e:
             logging.error(f"Error converting new papers batch to dicts: {e}")
             continue # Skip this batch

        mongo_ops_buffer.extend(ops_to_add)

        # Write to MongoDB when buffer is full
        while len(mongo_ops_buffer) >= mongo_batch_size:
            ops_to_write = mongo_ops_buffer[:mongo_batch_size]
            mongo_ops_buffer = mongo_ops_buffer[mongo_batch_size:]
            try:
                result = collection.bulk_write(ops_to_write, ordered=False)
                inserted_count = result.inserted_count
                total_inserted += inserted_count
                logging.debug(f"Insert Batch: Inserted {inserted_count} new papers.")
            except BulkWriteError as bwe:
                logging.error(f"Insert BulkWriteError: {bwe.details}")
                # Optionally log which documents failed if needed
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
            logging.error(f"Final Insert BulkWriteError: {bwe.details}")
        except Exception as e:
            logging.error(f"Final generic insert error: {e}")

    logging.info(f"Finished insertion. Total new documents inserted: {total_inserted}")
    return total_inserted

# --- Main Update Logic ---

def main_update():
    """
    Downloads latest PWC data and updates the MongoDB collection:
    1. Updates status of existing papers that now have code (excluding removed ones).
    2. Inserts new papers that don't have code and are not yet in the DB or removed list.
    """
    start_total_time = time.time()
    logging.info("Starting the PapersWithCode data UPDATE job.")

    mongo_client = get_mongo_client(MONGO_CONNECTION_STRING)
    if not mongo_client:
        logging.error("Failed to connect to MongoDB. Exiting.")
        return

    db = mongo_client[DB_NAME]
    papers_collection = db[COLLECTION_NAME]
    removed_papers_collection = db[REMOVED_COLLECTION_NAME] # <-- Get removed collection

    # Ensure essential indexes exist (prefer camelCase, keep compatibility)
    try:
        papers_collection.create_index([("pwcUrl", 1)], unique=True, background=True)
        logging.info("Index on 'pwcUrl' ensured.")
        try:
            papers_collection.create_index([("pwc_url", 1)], background=True)
            logging.info("Compatibility index on 'pwc_url' ensured.")
        except Exception:
            logging.debug("Skipping creation of compatibility index on 'pwc_url'.")

        # Ensure index on removed collection's URL field
        removed_papers_collection.create_index([("original_pwc_url", 1)], background=True)
        logging.info("Index on 'original_pwc_url' in removed_papers ensured.")
    except Exception as e:
        logging.warning("Could not ensure indexes: %s.", e)

    # --- Get Removed Paper URLs ---
    start_removed_check = time.time()
    try:
        removed_urls_cursor = removed_papers_collection.find({}, {"original_pwc_url": 1, "_id": 0})
        # Use original_pwc_url as this is what we store during removal
        removed_paper_urls: Set[str] = {doc['original_pwc_url'] for doc in removed_urls_cursor if doc.get('original_pwc_url')}
        logging.info(f"Found {len(removed_paper_urls)} removed paper URLs in {time.time()-start_removed_check:.2f}s.")
    except Exception as e:
        logging.error(f"Failed to fetch removed paper URLs: {e}. Proceeding without exclusion.")
        removed_paper_urls = set() # Continue without removed list if fetch fails

    # --- Download latest data ---
    t1 = time.time()
    links_data = download_and_extract_json(LINKS_URL)
    t2 = time.time()
    abstracts_data = download_and_extract_json(ABSTRACTS_URL)
    t3 = time.time()
    logging.info(f"Downloads complete: links ({t2-t1:.2f}s), abstracts ({t3-t2:.2f}s)")

    if links_data is None or abstracts_data is None:
        logging.error("Failed to retrieve one or both data files. Exiting update.")
        mongo_client.close()
        return

    # --- Step 1: Update papers that gained code ---
    logging.info("Step 1: Checking for existing papers that gained code...")
    papers_with_code_urls: Set[str] = {link['paper_url'] for link in links_data if link.get('paper_url')}
    logging.info(f"Found {len(papers_with_code_urls)} papers with code links in the latest data.")

    # Find papers currently marked as needing code. We'll fetch both key names for compatibility
    papers_needing_code_in_db_cursor = papers_collection.find(
        {"status": "Not Started"},
        {"_id": 1, "pwc_url": 1, "pwcUrl": 1}
    )

    update_operations = []
    ids_to_update = []
    check_count = 0
    start_update_check = time.time()

    for paper in papers_needing_code_in_db_cursor:
        check_count += 1
        paper_url = get_pwc_url(paper)
        # Skip missing urls or ones in removed list
        if not paper_url or paper_url in removed_paper_urls:
            continue
        if paper_url in papers_with_code_urls:
            logging.debug(f"Paper {paper_url} now has code. Preparing update.")
            ids_to_update.append(paper['_id'])
            update_op = UpdateOne(
                {"_id": paper['_id']},
                {"$set": {
                    "status": "Official Code Posted", # Or your preferred status
                    "lastUpdated": datetime.now(timezone.utc)
                 }
                }
            )
            update_operations.append(update_op)

    logging.info(f"Checked {check_count} non-removed papers marked 'Not Started' in DB in {time.time()-start_update_check:.2f}s.")
    if update_operations:
        logging.info(f"Found {len(update_operations)} papers to update to 'Code Available'.")
        batch_mongo_updates(papers_collection, update_operations, MONGO_WRITE_BATCH_SIZE)
    else:
        logging.info("No existing, non-removed papers needed status updates.")


    # --- Step 2: Add new papers without code ---
    logging.info("Step 2: Identifying and adding new papers without code...")

    # Get all pwc_urls already in the main database for efficient filtering
    start_existing_check = time.time()
    existing_db_urls_cursor = papers_collection.find({}, {"pwc_url": 1, "pwcUrl": 1, "_id": 0})
    existing_db_urls: Set[str] = set()
    for doc in existing_db_urls_cursor:
        url = get_pwc_url(doc)
        if url:
            existing_db_urls.add(url)
    logging.info(f"Found {len(existing_db_urls)} existing paper URLs in main DB in {time.time()-start_existing_check:.2f}s.")

    # Use Polars to find new papers without code
    try:
        abstracts_lf = pl.LazyFrame(abstracts_data)

        # Filter conditions:
        # 1. Must have a paper_url
        # 2. paper_url must NOT be in the set of papers that have code
        # 3. paper_url must NOT be in the set of papers already in our main DB
        # 4. paper_url must NOT be in the set of removed papers <-- NEW
        new_papers_lf = (
            abstracts_lf
            .filter(pl.col("title").is_not_null() & (pl.col("title") != "")) # Title must exist and not be empty
            .filter(pl.col("authors").is_not_null() & pl.col("authors").list.len() > 0) # Authors must exist and list not empty
            .filter(pl.col("paper_url").is_not_null()) # Ensure paper_url exists
            .filter(~pl.col("paper_url").is_in(papers_with_code_urls)) # Not in links (no code)
            .filter(~pl.col("paper_url").is_in(existing_db_urls)) # Not already in main DB
            .filter(~pl.col("paper_url").is_in(removed_paper_urls)) # <-- Exclude removed URLs
            # --- Apply transformations similar to find_papers_without_code_polars_lazy ---
            .select([
                pl.col("paper_url").alias("pwcUrl"),
                pl.col("title").fill_null("").cast(pl.Utf8).alias("title"),
                pl.col("abstract").fill_null("").cast(pl.Utf8).alias("abstract"),
                pl.col("authors").cast(pl.List(pl.Utf8), strict=False).fill_null([]).alias("authors"),
                pl.col("url_abs").fill_null("").cast(pl.Utf8).alias("urlAbs"),
                pl.col("url_pdf").fill_null("").cast(pl.Utf8).alias("urlPdf"),
                pl.col("arxiv_id").fill_null("").cast(pl.Utf8).alias("arxivId"),
                pl.col("date").str.strptime(pl.Datetime, "%Y-%m-%d", strict=False, exact=True).alias("publicationDate"),
                pl.col("proceeding").alias("venue").fill_null("").cast(pl.Utf8).alias("venue"),
                pl.col("tasks").cast(pl.List(pl.Utf8), strict=False).fill_null([]).alias("tasks"),
                # Add default fields for new papers without code (camelCase)
                pl.lit("Not Started").alias("status"),
                pl.lit(True).alias("isImplementable"),
                pl.lit(0).cast(pl.Int64).alias("upvoteCount"), # Assuming new papers start with 0 votes
                pl.lit(datetime.now(timezone.utc)).alias("createdAt"), # Add creation timestamp
                pl.lit(datetime.now(timezone.utc)).alias("lastUpdated")
            ])
            .filter(pl.col("publicationDate").is_not_null())
        )

        # Insert the newly identified papers
        insert_new_papers_batched(
            mongo_client,
            DB_NAME,
            COLLECTION_NAME,
            new_papers_lf,
            polars_batch_size=POLARS_PROCESSING_BATCH_SIZE,
            mongo_batch_size=MONGO_WRITE_BATCH_SIZE
        )

    except Exception as e:
        logging.error(f"Error processing or inserting new papers: {e}")


    # --- Finish ---
    mongo_client.close()
    logging.info("Update job finished in %.2fs", time.time() - start_total_time)

if __name__ == "__main__":
    main_update()
