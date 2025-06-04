import requests
import gzip
import json
import polars as pl
import logging
import io
import os
from typing import List, Dict, Any, Optional
from pymongo import MongoClient
from pymongo.operations import ReplaceOne
from pymongo.errors import BulkWriteError
from dotenv import load_dotenv
import time # For timing operations
from tqdm import tqdm
# --- Configuration ---
LINKS_URL = "https://production-media.paperswithcode.com/about/links-between-papers-and-code.json.gz"
ABSTRACTS_URL = "https://production-media.paperswithcode.com/about/papers-with-abstracts.json.gz"

# MongoDB Config
DB_NAME = "papers2code"
COLLECTION_NAME = "papers_without_code"
# Adjust based on testing, RAM, network, and Mongo instance size.
# Larger batches reduce network round trips but increase memory per batch & Mongo load.
MONGO_WRITE_BATCH_SIZE = 10000 # Increased, test what works best (e.g., 5k, 10k, 20k)
# Polars batch size for streaming from lazy frame
# Can be same as Mongo batch size or different
POLARS_STREAMING_BATCH_SIZE = 10000

# Load environment variables
load_dotenv()
MONGO_CONNECTION_STRING = os.environ.get("MONGO_URI")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---

def download_and_extract_json(url: str) -> Optional[List[Dict[str, Any]]]:
    """Downloads, decompresses, and parses JSON data from a gzipped URL.
    Streamlined by opening the gzip file in text mode and reducing nested error handling.
    """
    logging.info("Downloading data from %s", url)
    try:
        response = requests.get(url, timeout=300)
        response.raise_for_status()
        # Open in text mode ('rt') to read the JSON directly without extra buffering.
        with gzip.open(io.BytesIO(response.content), mode='rt') as f:
            data = json.load(f)
        if not isinstance(data, list):
            logging.warning("Data from %s is not a list", url)
            return None
        return data
    except Exception as e:
        logging.error("Error processing %s: %s", url, e)
        return None


def get_mongo_client(connection_string: Optional[str]) -> Optional[MongoClient]:
    """Establishes a connection to MongoDB with a simplified error handling."""
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

def save_lazyframe_to_mongodb_batched(
    client: MongoClient,
    db_name: str,
    collection_name: str,
    lazy_df: pl.LazyFrame,
    mongo_batch_size: int = 10000,
    polars_batch_size: int = 10000
):
    """
    Streams data from a Polars LazyFrame, processes it in batches,
    and saves the documents to MongoDB using batched upserts.

    Improvements:
    - Removes upfront .unique() call (relies on MongoDB index).
    - Avoids collecting the entire DataFrame upfront if possible (streaming collect).
    - Adds specific timing for conversion and DB writes.
    - Assumes a unique index exists on 'pwc_url' in MongoDB.
    """
    if lazy_df is None:
        logging.error("Input LazyFrame is None, cannot save.")
        return

    db = client[db_name]
    collection = db[collection_name]

    logging.info("Ensuring index on 'pwc_url' exists (or create it manually)...")
    # It's good practice to ensure the index exists before a large batch job
    # Do this once outside the script or uncomment below if needed:
    try:
        collection.create_index([("pwc_url", 1)], unique=True, background=True)
        logging.info("Index on 'pwc_url' ensured.")
    except Exception as e:
        logging.warning("Could not ensure index on 'pwc_url': %s. Performance may suffer.", e)


    # Collect the LazyFrame using streaming, WITHOUT .unique()
    # Note: This still collects into an eager frame, but avoids the costly .unique()
    # and allows out-of-core computation if needed via streaming=True.
    # For *very* large datasets exceeding RAM, a different approach like
    # processing parquet files chunk by chunk might be needed.
    try:
        start_collect = time.time()
        # Removed .unique() - rely on MongoDB index + upsert
        df = lazy_df.collect(engine="streaming")
        logging.info("Collected DataFrame (streaming) in %.2fs. Shape: %s",
                     time.time() - start_collect, df.shape)
    except Exception as e:
        # Catch potential MemoryError during collection too
        logging.error("Error collecting LazyFrame (check memory usage): %s", e)
        return

    if df.height == 0:
        logging.info("Collected DataFrame is empty. Nothing to save.")
        return

    total_processed = 0
    total_written = 0
    mongo_ops_buffer = []
    polars_batch_num = 0
    mongo_batch_num = 0

    logging.info("Starting iteration over DataFrame slices (polars_batch_size=%d)", polars_batch_size)
    # Use iter_slices to iterate over the collected DataFrame partitions.
    for batch_df in tqdm(df.iter_slices(n_rows=polars_batch_size), total= (df.height + polars_batch_size -1) // polars_batch_size ):
        polars_batch_num += 1
        if batch_df.height == 0:
            logging.debug("Polars Batch %d: Skipping empty slice.", polars_batch_num)
            continue

        logging.debug("Polars Batch %d: Processing %d rows.", polars_batch_num, batch_df.height)

        # Convert slice to dictionaries and prepare ops
        start_convert = time.time()
        ops_to_add = []
        try:
            for record in batch_df.to_dicts():
                # Basic validation - adjust if needed
                if record.get("pwc_url"): # Check if key exists and is not None/empty
                     ops_to_add.append(
                        ReplaceOne({"pwc_url": record["pwc_url"]}, record, upsert=True)
                    )
                else:
                     logging.warning("Skipping record due to missing or invalid 'pwc_url': %s", record.get('id', 'N/A')) # Log identifier if available
        except Exception as e:
             logging.error("Error during Polars batch %d to_dicts/op creation: %s", polars_batch_num, e)
             continue # Skip this Polars batch if conversion fails

        mongo_ops_buffer.extend(ops_to_add)
        convert_time = time.time() - start_convert
        logging.debug("Polars Batch %d: Converted %d rows to ops in %.2fs.", polars_batch_num, len(ops_to_add), convert_time)

        # Write to MongoDB if buffer is full enough
        while len(mongo_ops_buffer) >= mongo_batch_size:
            mongo_batch_num += 1
            ops_to_write = mongo_ops_buffer[:mongo_batch_size]
            mongo_ops_buffer = mongo_ops_buffer[mongo_batch_size:] # Prepare for next iteration

            start_write = time.time()
            try:
                result = collection.bulk_write(ops_to_write, ordered=False)
                write_time = time.time() - start_write
                written_count = result.upserted_count + result.matched_count # matched_count includes modified
                total_written += written_count
                logging.info("Mongo Batch %d: Wrote %d ops (upserted=%d, matched=%d, modified=%d) in %.2fs.",
                             mongo_batch_num, len(ops_to_write), result.upserted_count,
                             result.matched_count, result.modified_count, write_time)
            except BulkWriteError as bwe:
                write_time = time.time() - start_write
                # Log errors, but continue if possible
                logging.error("Mongo Batch %d: BulkWriteError after %.2fs. Details: %s",
                              mongo_batch_num, write_time, bwe.details)
                # You might want more sophisticated error handling here
            except Exception as e:
                write_time = time.time() - start_write
                logging.error("Mongo Batch %d: Generic write error after %.2fs: %s", mongo_batch_num, write_time, e)
                # Decide whether to break, continue, or retry

        # Update total processed count (rows prepared from Polars batch)
        total_processed += len(ops_to_add)


    # Write any remaining operations in the buffer
    if mongo_ops_buffer:
        mongo_batch_num += 1
        logging.info("Writing final remaining %d operations.", len(mongo_ops_buffer))
        start_write = time.time()
        try:
            result = collection.bulk_write(mongo_ops_buffer, ordered=False)
            write_time = time.time() - start_write
            written_count = result.upserted_count + result.matched_count
            total_written += written_count
            logging.info("Final Mongo Batch %d: Wrote %d ops (upserted=%d, matched=%d, modified=%d) in %.2fs.",
                         mongo_batch_num, len(mongo_ops_buffer), result.upserted_count,
                         result.matched_count, result.modified_count, write_time)
        except BulkWriteError as bwe:
            write_time = time.time() - start_write
            logging.error("Final Mongo Batch %d: BulkWriteError after %.2fs. Details: %s", mongo_batch_num, write_time, bwe.details)
        except Exception as e:
            write_time = time.time() - start_write
            logging.error("Final Mongo Batch %d: Generic write error after %.2fs: %s", mongo_batch_num, write_time, e)

    logging.info("Finished processing.")
    logging.info("Total valid records prepared from Polars: %d", total_processed)
    logging.info("Total documents potentially written/matched in MongoDB: %d", total_written) # Note: This counts matches even if unmodified



def find_papers_without_code_polars_lazy(
    papers_with_abstracts_data: List[Dict[str, Any]],
    links_data: List[Dict[str, Any]]
) -> Optional[pl.LazyFrame]:
    """
    Identifies papers that do not have associated code using Polars LazyFrames.
    Uses a clear chain of operations for selection, joining, and column transformations.
    """
    if not papers_with_abstracts_data:
        logging.warning("No abstracts data provided. Returning an empty LazyFrame.")
        schema = {
            "pwc_url": pl.Utf8, "title": pl.Utf8, "abstract": pl.Utf8,
            "authors": pl.List(pl.Utf8), "url_abs": pl.Utf8, "url_pdf": pl.Utf8,
            "arxiv_id": pl.Utf8, "publication_date": pl.Datetime,
            "venue": pl.Utf8, "tasks": pl.List(pl.Utf8), "status": pl.Utf8,
            "is_implementable": pl.Boolean
        }
        return pl.DataFrame(schema=schema).lazy()

    abstracts_lf = (
        pl.LazyFrame(papers_with_abstracts_data)
        .filter(pl.col("title").is_not_null() & (pl.col("title") != "")) # Title must exist and not be empty
        .filter(pl.col("authors").is_not_null() & pl.col("authors").list.len() > 0) # Authors must exist and list not empty
        .select([
            pl.col("paper_url"),
            pl.col("paper_url").alias("pwc_url"),
            pl.col("title").fill_null("").cast(pl.Utf8),
            pl.col("abstract").fill_null("").cast(pl.Utf8),
            pl.col("authors").cast(pl.List(pl.Utf8), strict=False).fill_null([]),
            pl.col("url_abs").fill_null("").cast(pl.Utf8),
            pl.col("url_pdf").fill_null("").cast(pl.Utf8),
            pl.col("arxiv_id").fill_null("").cast(pl.Utf8),
            pl.col("date").str.strptime(pl.Datetime, "%Y-%m-%d", strict=False, exact=True).alias("publication_date"),
            pl.col("proceeding").alias("venue").fill_null("").cast(pl.Utf8),
            pl.col("tasks").cast(pl.List(pl.Utf8), strict=False).fill_null([])
        ])
        .filter(pl.col("publication_date").is_not_null())
    )

    if links_data:
        links_lf = pl.LazyFrame(links_data).select("paper_url").unique()
        papers_without_code_lf = abstracts_lf.join(links_lf, on="paper_url", how="anti")
    else:
        papers_without_code_lf = abstracts_lf

    return (
        papers_without_code_lf
        .with_columns([
            pl.lit("Needs Code").alias("status"),
            pl.lit(True).alias("is_implementable")
        ])
        .drop("paper_url")
    )

# --- Main Execution ---

def main():
    """
    Main execution: download data, define the LazyFrame computation,
    and batch save the processed records to MongoDB.
    """
    start_total_time = time.time()
    logging.info("Starting the PapersWithCode data processing job.")

    # (Kept previous code for printing reminders about MongoDB index.)

    mongo_client = get_mongo_client(MONGO_CONNECTION_STRING)
    if not mongo_client:
        logging.error("Failed to connect to MongoDB. Exiting.")
        return

    # Download data.
    t1 = time.time()
    links_data = download_and_extract_json(LINKS_URL)
    t2 = time.time()
    abstracts_data = download_and_extract_json(ABSTRACTS_URL)
    if links_data is None or abstracts_data is None:
        logging.error("Failed to retrieve one or both data files. Exiting.")
        mongo_client.close()
        return
    logging.info("Downloads complete in %.2fs (links) and %.2fs (abstracts)", t2 - t1, time.time() - t2)

    # Define the LazyFrame computation.
    lazy_result_df = find_papers_without_code_polars_lazy(abstracts_data, links_data)
    if lazy_result_df is None:
        logging.error("Failed to define LazyFrame for papers without code. Exiting.")
        mongo_client.close()
        return
    logging.info("LazyFrame plan defined successfully.")

    # Stream results and save batched to MongoDB.
    save_lazyframe_to_mongodb_batched(
        mongo_client,
        DB_NAME,
        COLLECTION_NAME,
        lazy_result_df,
        mongo_batch_size=MONGO_WRITE_BATCH_SIZE,
        polars_batch_size=POLARS_STREAMING_BATCH_SIZE
    )

    mongo_client.close()
    logging.info("Job finished in %.2fs", time.time() - start_total_time)


if __name__ == "__main__":
    main()
