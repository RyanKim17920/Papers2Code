import requests
import gzip
import json
import polars as pl
import logging
import io
import os
import math # For batch calculation
from typing import List, Dict, Any, Optional
from pymongo import MongoClient, errors as pymongo_errors
from pymongo.operations import ReplaceOne
from dotenv import load_dotenv

# --- Configuration ---
LINKS_URL = "https://production-media.paperswithcode.com/about/links-between-papers-and-code.json.gz"
ABSTRACTS_URL = "https://production-media.paperswithcode.com/about/papers-with-abstracts.json.gz"

# MongoDB Config
DB_NAME = "papers2code"
COLLECTION_NAME = "papers_without_code"
MONGO_WRITE_BATCH_SIZE = 5000 # Process N records per bulk write op

# Load environment variables
load_dotenv()
MONGO_CONNECTION_STRING = os.environ.get("MONGO_URI")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---

def download_and_extract_json(url: str) -> Optional[List[Dict[str, Any]]]:
    # (Same as previous version - include error handling, empty file check etc.)
    logging.info(f"Attempting to download data from {url}...")
    try:
        response = requests.get(url, stream=True, timeout=180) # Increased timeout further
        response.raise_for_status()
        logging.info(f"Decompressing and parsing JSON data...")
        with io.BytesIO(response.content) as bio:
            with gzip.GzipFile(fileobj=bio, mode='rb') as gz_file:
                json_bytes = gz_file.read()
                json_string = json_bytes.decode('utf-8')
                if not json_string.strip():
                     logging.warning(f"Downloaded file from {url} is empty.")
                     return []
                data = json.loads(json_string)
        logging.info(f"Successfully processed data from {url}")
        return data
    except requests.exceptions.RequestException as e:
        logging.error(f"Error downloading data from {url}: {e}")
        return None
    except gzip.BadGzipFile as e:
        logging.error(f"Error decompressing Gzip data from {url}: {e}")
        return None
    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON data from {url}: {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred while processing {url}: {e}")
        return None

def get_mongo_client(connection_string: Optional[str]) -> Optional[MongoClient]:
    # (Same as previous version)
    if not connection_string:
        logging.error("MongoDB connection string (MONGO_URI) not found.")
        return None
    try:
        logging.info("Connecting to MongoDB...")
        # Add retryWrites=true if not already in your URI for resilience
        client = MongoClient(connection_string, serverSelectionTimeoutMS=10000) # Increased timeout
        client.admin.command('ismaster')
        logging.info("Successfully connected to MongoDB.")
        return client
    except pymongo_errors.ConnectionFailure as e:
        logging.error(f"Failed to connect to MongoDB: {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred during MongoDB connection: {e}")
        return None

# --- OPTIMIZED MongoDB Saving ---
def save_to_mongodb_batched(client: MongoClient, db_name: str, collection_name: str, data_df: pl.DataFrame, batch_size: int = 5000):
    """
    Saves data from a Polars DataFrame to MongoDB using batched upserts.

    Args:
        client: Active MongoClient instance.
        db_name: Target database name.
        collection_name: Target collection name.
        data_df: Eager Polars DataFrame containing the papers to save/update.
        batch_size: Number of records per bulk write operation.
    """
    if data_df.is_empty():
        logging.info("DataFrame is empty, nothing to save to MongoDB.")
        return

    try:
        db = client[db_name]
        collection = db[collection_name]
        total_records = data_df.height
        num_batches = math.ceil(total_records / batch_size)
        logging.info(f"Preparing to save/update {total_records} records in {num_batches} batches "
                     f"to MongoDB ({db_name}.{collection_name})...")

        total_upserted = 0
        total_modified = 0

        for i in range(num_batches):
            start_index = i * batch_size
            end_index = min((i + 1) * batch_size, total_records)
            batch_df = data_df[start_index:end_index] # Slice the DataFrame

            if batch_df.is_empty():
                continue

            # Convert *only the batch* to dictionaries
            records = batch_df.to_dicts()

            # Prepare bulk operations for the current batch
            bulk_ops = [
                ReplaceOne(
                    {"pwc_url": record["pwc_url"]},
                    record,
                    upsert=True
                )
                for record in records
            ]

            if not bulk_ops:
                continue

            logging.info(f"Executing batch {i+1}/{num_batches} ({len(bulk_ops)} operations)...")
            try:
                result = collection.bulk_write(bulk_ops, ordered=False) # ordered=False can improve performance
                total_upserted += result.upserted_count
                total_modified += result.modified_count
                logging.info(f"Batch {i+1}/{num_batches} complete. "
                             f"Upserted: {result.upserted_count}, Modified: {result.modified_count}")
            except pymongo_errors.BulkWriteError as bwe:
                logging.error(f"MongoDB bulk write error during batch {i+1}: {bwe.details}")
                # Decide if you want to continue with next batch or stop
                # continue

        logging.info(f"MongoDB bulk writes finished. Total Upserted: {total_upserted}, Total Modified: {total_modified}")

    except Exception as e:
        logging.error(f"An error occurred during batched saving to MongoDB: {e}")


# --- OPTIMIZED Polars Logic (LazyFrames with Anti-Join) ---
def find_papers_without_code_polars_lazy(
    papers_with_abstracts_data: List[Dict[str, Any]],
    links_data: List[Dict[str, Any]]
) -> Optional[pl.LazyFrame]:
    """
    Identifies papers that do not have associated code using Polars LazyFrames
    with an anti-join and includes necessary casting/defaults.
    """
    if papers_with_abstracts_data is None or links_data is None:
         logging.error("Input data lists cannot be None.")
         return None
    if not papers_with_abstracts_data:
        logging.warning("Papers with abstracts data is empty.")
        return None # Or return empty lazy frame with schema

    # CORRECTED: Use pl.LazyFrame() to initialize from list of dicts
    abstracts_lf = pl.LazyFrame(papers_with_abstracts_data)

    if not links_data:
         logging.warning("Links data is empty. Assuming all papers need code.")
         papers_without_code_lf = abstracts_lf
    else:
        try:
            # CORRECTED: Use pl.LazyFrame() here too
            links_lf = pl.LazyFrame(links_data)

            # Check if links_lf is effectively empty after creation
            # This check is tricky without collecting, assume it's okay or handle downstream
            # A simple check might be if links_data itself was empty list or list of empty dicts

            papers_with_code_urls_lf = links_lf.select("paper_url").unique()
            logging.info("Defining Polars LazyFrame operations using anti-join...")

            papers_without_code_lf = abstracts_lf.join(
                papers_with_code_urls_lf,
                on="paper_url",
                how="anti"
            )
        except Exception as e:
             logging.error(f"Error processing links data with LazyFrame, assuming all papers need code: {e}")
             papers_without_code_lf = abstracts_lf # Fallback

    try:
        # --- Select, Cast, Rename, and Add Default Columns (Lazy) ---
        # (This part remains the same as the previous correction)
        papers_without_code_lf = papers_without_code_lf.select([
            pl.col("paper_url").alias("pwc_url"),
            pl.col("title").fill_null("").cast(pl.Utf8),
            pl.col("abstract").fill_null("").cast(pl.Utf8),
            pl.col("authors"), # Keep as list
            pl.col("url_abs").fill_null("").cast(pl.Utf8),
            pl.col("url_pdf").fill_null("").cast(pl.Utf8),
            pl.col("arxiv_id").fill_null("").cast(pl.Utf8),
            pl.col("date").str.strptime(pl.Datetime, "%Y-%m-%d", strict=False).alias("publication_date"), # Use Datetime
            pl.col("proceeding").alias("venue").fill_null("").cast(pl.Utf8),
            pl.col("tasks"), # Keep as list
            pl.lit("Needs Code").alias("status"),
            pl.lit(True).alias("is_implementable")
        ])

        logging.info("LazyFrame plan defined successfully.")
        return papers_without_code_lf

    except pl.exceptions.PolarsError as e:
        logging.error(f"A Polars error occurred during LazyFrame definition: {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred during LazyFrame processing: {e}")
        return None

# --- Main Execution ---

def main():
    """
    Main function: download, process lazily, collect, save batched to MongoDB.
    """
    logging.info("Starting the PapersWithCode data processing job (Optimized)...")
    print("IMPORTANT: Ensure you have created an index on 'pwc_url' in your MongoDB collection!")
    print("db.papers_without_code.createIndex({ pwc_url: 1 }, { unique: true })")


    mongo_client = get_mongo_client(MONGO_CONNECTION_STRING)

    # 1. Download data
    links_data = download_and_extract_json(LINKS_URL)
    abstracts_data = download_and_extract_json(ABSTRACTS_URL)

    if links_data is None or abstracts_data is None:
        logging.error("Failed to retrieve or parse one or both data files. Exiting.")
        if mongo_client: mongo_client.close()
        return

    # 2. Define the LazyFrame computation
    lazy_result_df = find_papers_without_code_polars_lazy(abstracts_data, links_data)

    if lazy_result_df is not None:
        try:
            # --- Execute Polars Computation ---
            logging.info("Executing Polars computation (collecting LazyFrame)...")
            # This still loads the final result into memory, but the computation
            # to get here should be more optimized by the lazy engine.
            papers_needing_code_df = lazy_result_df.collect()
            logging.info(f"Computation complete. Found {papers_needing_code_df.height} papers potentially needing code.")

            # --- Save Batched to MongoDB ---
            if mongo_client:
                save_to_mongodb_batched(
                    mongo_client,
                    DB_NAME,
                    COLLECTION_NAME,
                    papers_needing_code_df,
                    batch_size=MONGO_WRITE_BATCH_SIZE
                )
            else:
                logging.warning("MongoDB client not available. Skipping database save.")

        except pl.exceptions.ComputeError as e:
             # Catch errors during .collect()
             logging.error(f"A Polars error occurred during .collect(): {e}")
        except Exception as e:
             logging.error(f"An unexpected error occurred during result collection or saving: {e}")

    else:
        logging.error("Failed to define LazyFrame plan for papers without code.")

    # Close MongoDB connection
    if mongo_client:
        logging.info("Closing MongoDB connection.")
        mongo_client.close()

    logging.info("Data processing job finished.")


if __name__ == "__main__":
    main()