import requests
import gzip
import json
import polars as pl
import logging
import io
import os
import glob
import subprocess
import shutil
from typing import List, Dict, Any, Optional
from pymongo import MongoClient
from pymongo.operations import ReplaceOne
from pymongo.errors import BulkWriteError
from dotenv import load_dotenv
import time # For timing operations
from tqdm import tqdm
import certifi  # Use certifi CA bundle for TLS
# --- Configuration ---
LINKS_URL = "https://production-media.paperswithcode.com/about/links-between-papers-and-code.json.gz"
ABSTRACTS_URL = "https://production-media.paperswithcode.com/about/papers-with-abstracts.json.gz"
PARQUET_ARCHIVE_DIR = os.path.join(os.path.dirname(__file__), "PwC-archive-old_data")  # Local fallback / primary source

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
MONGO_CONNECTION_STRING = os.environ.get("MONGO_URI_PROD")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---

def download_and_extract_json(url: str) -> Optional[List[Dict[str, Any]]]:
    """Download, decompress, and parse JSON data from a gzipped URL with TLS-hardened fallbacks."""
    logging.info("Downloading data from %s", url)
    headers = {"User-Agent": "papers2code/1.0 (+https://papers2code.app)"}

    # Check for local file first (manual download fallback)
    filename = url.split('/')[-1]
    local_path = os.path.join(os.path.dirname(__file__), filename)
    if os.path.exists(local_path):
        logging.info("Using local file: %s", local_path)
        try:
            with gzip.open(local_path, mode="rt") as f:
                data = json.load(f)
            if not isinstance(data, list):
                logging.warning("Data from local %s is not a list", local_path)
                return None
            return data
        except Exception as e:
            logging.warning("Failed to read local file %s: %s", local_path, e)

    # Attempt 1: default requests (already uses certifi in most envs)
    try:
        resp = requests.get(url, timeout=60, headers=headers)
        resp.raise_for_status()
        with gzip.open(io.BytesIO(resp.content), mode="rt") as f:
            data = json.load(f)
        if not isinstance(data, list):
            logging.warning("Data from %s is not a list", url)
            return None
        return data
    except requests.exceptions.SSLError as e:
        logging.warning("SSL error on first attempt: %s", e)
    except Exception as e:
        logging.warning("Primary download attempt failed: %s", e)

    # Attempt 2: requests with explicit certifi CA bundle
    try:
        resp = requests.get(url, timeout=60, headers=headers, verify=certifi.where())
        resp.raise_for_status()
        with gzip.open(io.BytesIO(resp.content), mode="rt") as f:
            data = json.load(f)
        if not isinstance(data, list):
            logging.warning("Data from %s is not a list", url)
            return None
        return data
    except Exception as e:
        logging.warning("Second attempt with explicit CA failed: %s", e)

    # Attempt 3: curl fallback if available
    try:
        if shutil.which("curl"):
            res = subprocess.run(["curl", "-fsSL", url], capture_output=True, check=True)
            with gzip.open(io.BytesIO(res.stdout), mode="rt") as f:
                data = json.load(f)
            if not isinstance(data, list):
                logging.warning("Data from %s is not a list (curl)", url)
                return None
            return data
        else:
            logging.error("curl not available for fallback download")
    except Exception as e:
        logging.error("curl fallback failed for %s: %s", url, e)

    # If all else fails, provide helpful instructions
    logging.error("Error processing %s after multiple attempts", url)
    logging.error("Manual download instructions:")
    logging.error("  1. Download %s manually (try a different browser/network)", url)
    logging.error("  2. Save as %s", local_path)
    logging.error("  3. Re-run this script")
    return None


def get_mongo_client(connection_string: Optional[str]) -> Optional[MongoClient]:
    """Establishes a connection to MongoDB with a simplified error handling."""
    if not connection_string:
        logging.error("MongoDB URI not found in environment variables.")
        return None
    try:
        # Explicitly provide CA bundle to avoid macOS trust-store issues
        client = MongoClient(
            connection_string,
            serverSelectionTimeoutMS=15000,
            tls=True,
            tlsCAFile=certifi.where(),
        )
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

    logging.info("Ensuring index on 'pwcUrl' exists (or create it manually)...")
    # It's good practice to ensure the index exists before a large batch job
    # Do this once outside the script or uncomment below if needed:
    try:
        collection.create_index([("pwcUrl", 1)], unique=True, background=True)
        logging.info("Index on 'pwcUrl' ensured.")
    except Exception as e:
        logging.warning("Could not ensure index on 'pwcUrl': %s. Performance may suffer.", e)


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
            def snake_to_camel(s: str) -> str:
                parts = s.split('_')
                return parts[0] + ''.join(p.title() for p in parts[1:]) if parts else s

            for record in batch_df.to_dicts():
                # Transform keys from snake_case to camelCase for MongoDB
                transformed = {snake_to_camel(k): v for k, v in record.items()}
                # Basic validation - ensure we have pwcUrl
                if transformed.get("pwcUrl"):
                    ops_to_add.append(
                        ReplaceOne({"pwcUrl": transformed["pwcUrl"]}, transformed, upsert=True)
                    )
                else:
                    logging.warning("Skipping record due to missing or invalid 'pwcUrl': %s", record.get('id', 'N/A'))
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
            # Use camelCase for DB fields
            "pwcUrl": pl.Utf8,
            "title": pl.Utf8,
            "abstract": pl.Utf8,
            "authors": pl.List(pl.Utf8),
            "urlAbs": pl.Utf8,
            # Deprecated fields removed: url_pdf, venue
            "arxivId": pl.Utf8,
            "publicationDate": pl.Datetime,
            "tasks": pl.List(pl.Utf8),
            "status": pl.Utf8,
            "isImplementable": pl.Boolean,
            # New optional GitHub URL field
            "urlGithub": pl.Utf8,
        }
        return pl.DataFrame(schema=schema).lazy()

    abstracts_lf = (
        pl.LazyFrame(papers_with_abstracts_data)
        .filter(pl.col("title").is_not_null() & (pl.col("title") != "")) # Title must exist and not be empty
        .filter(pl.col("authors").is_not_null() & pl.col("authors").list.len() > 0) # Authors must exist and list not empty
        .select([
            pl.col("paper_url"),
            pl.col("paper_url").alias("pwcUrl"),
            pl.col("title").fill_null("").cast(pl.Utf8).alias("title"),
            pl.col("abstract").fill_null("").cast(pl.Utf8).alias("abstract"),
            pl.col("authors").cast(pl.List(pl.Utf8), strict=False).fill_null([]).alias("authors"),
            pl.col("url_abs").fill_null("").cast(pl.Utf8).alias("urlAbs"),
            pl.col("arxiv_id").fill_null("").cast(pl.Utf8).alias("arxivId"),
            pl.col("date").str.strptime(pl.Datetime, "%Y-%m-%d", strict=False, exact=True).alias("publicationDate"),
            pl.col("tasks").cast(pl.List(pl.Utf8), strict=False).fill_null([]).alias("tasks")
        ])
        .filter(pl.col("publicationDate").is_not_null())
    )

    # Build links LazyFrame to attach a single GitHub URL per paper (top 1 by first occurrence)
    # Some papers have multiple implementations; per request, take the first one for simplicity.
    if links_data:
        mapped_links = []
        for rec in links_data:
            try:
                paper_url = rec.get("paper_url")
                repo_url = rec.get("repo_url") or rec.get("url") or rec.get("repo")
                if paper_url and repo_url:
                    mapped_links.append({"paper_url": paper_url, "repo_url": repo_url})
            except Exception:
                continue
        if mapped_links:
            links_lf = (
                pl.LazyFrame(mapped_links)
                .filter(pl.col("paper_url").is_not_null() & pl.col("repo_url").is_not_null())
                .group_by("paper_url")
                .agg(pl.col("repo_url").first().alias("urlGithub"))
            )
            papers_lf = abstracts_lf.join(links_lf, on="paper_url", how="left")
        else:
            papers_lf = abstracts_lf.with_columns([pl.lit(None).alias("urlGithub")])
    else:
        papers_lf = abstracts_lf.with_columns([pl.lit(None).alias("urlGithub")])

    return (
        papers_lf
        .with_columns([
            pl.lit("Needs Code").alias("status"),
            pl.lit(True).alias("isImplementable"),
            pl.when(pl.col("urlGithub").is_not_null()).then(pl.lit(True)).otherwise(pl.lit(False)).alias("hasCode")
        ])
        .drop("paper_url")
    )

# --- Main Execution ---

def build_unified_lazy_from_parquet(archive_dir: str) -> Optional[pl.LazyFrame]:
    """Unified lazy concat of all abstract parquet shards + optional links join.

    Keeps all papers (with or without code). Adds:
      - url_github (first repo if exists)
      - has_code (bool)
      - status, is_implementable
    """
    if not os.path.isdir(archive_dir):
        logging.error("Parquet archive directory not found: %s", archive_dir)
        return None

    links_file = os.path.join(archive_dir, "papers_with_code.parquet")
    abstract_files = [
        f for f in glob.glob(os.path.join(archive_dir, "papers*.parquet")) if not f.endswith("papers_with_code.parquet")
    ]
    if not abstract_files:
        logging.error("No abstract shards found in %s", archive_dir)
        return None

    # Build list of scans; allow missing columns (diagonal concat fills nulls)
    scans: List[pl.LazyFrame] = []
    for path in abstract_files:
        try:
            scans.append(pl.scan_parquet(path))
        except Exception as e:
            logging.warning("Skipping shard %s due to error: %s", path, e)
    if not scans:
        logging.error("All shard scans failed.")
        return None

    abstracts_lf = pl.concat(scans, how="diagonal_relaxed")

    # Transform
    abstracts_lf = (
        abstracts_lf
        .filter(pl.col("title").is_not_null() & (pl.col("title") != ""))
        .with_columns([
            pl.col("abstract").fill_null("").cast(pl.Utf8),
            pl.when(pl.col("authors").is_not_null()).then(
                pl.col("authors").cast(pl.List(pl.Utf8), strict=False)
            ).otherwise(pl.lit([])).alias("authors"),
            pl.col("url_abs").fill_null("").cast(pl.Utf8),
            pl.col("arxiv_id").fill_null("").cast(pl.Utf8),
            pl.col("date").cast(pl.Datetime, strict=False).alias("publicationDate"),
            pl.when(pl.col("tasks").is_not_null()).then(
                pl.col("tasks").cast(pl.List(pl.Utf8), strict=False)
            ).otherwise(pl.lit([])).alias("tasks"),
        ])
        .filter(pl.col("publicationDate").is_not_null())
        .select([
            pl.col("paper_url"),
            pl.col("paper_url").alias("pwcUrl"),
            pl.col("title"),
            pl.col("abstract"),
            pl.col("authors"),
            pl.col("url_abs").alias("urlAbs"),
            pl.col("arxiv_id").alias("arxivId"),
            pl.col("publicationDate"),
            pl.col("tasks"),
        ])
    )

    # Links join lazily
    if os.path.isfile(links_file):
        try:
            links_scan = pl.scan_parquet(links_file)
            link_cols = links_scan.columns
            repo_col = next((c for c in ["repo_url", "repository_url", "url", "repo"] if c in link_cols), None)
            if repo_col and "paper_url" in link_cols:
                links_clean = (
                    links_scan
                    .select([pl.col("paper_url"), pl.col(repo_col).alias("repo_url")])
                    .filter(pl.col("repo_url").is_not_null())
                    .group_by("paper_url")
                    .agg(pl.col("repo_url").first().alias("urlGithub"))
                )
                abstracts_lf = abstracts_lf.join(links_clean, on="paper_url", how="left")
            else:
                abstracts_lf = abstracts_lf.with_columns(pl.lit(None).alias("urlGithub"))
        except Exception as e:
            logging.warning("Links join failed: %s", e)
            abstracts_lf = abstracts_lf.with_columns(pl.lit(None).alias("urlGithub"))
    else:
        abstracts_lf = abstracts_lf.with_columns(pl.lit(None).alias("url_github"))

    final = (
        abstracts_lf
        .with_columns([
            pl.lit("Needs Code").alias("status"),
            pl.lit(True).alias("isImplementable"),
            pl.when(pl.col("urlGithub").is_not_null()).then(pl.lit(True)).otherwise(pl.lit(False)).alias("hasCode"),
        ])
        .drop("paper_url")
    )
    return final

## Removed per-shard processing in favor of unified lazy approach
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
    # Prefer unified parquet lazy path if local archive exists; else fallback to remote JSON
    if os.path.isdir(PARQUET_ARCHIVE_DIR):
        logging.info("Local Parquet archive detected at %s. Building unified lazy frame.", PARQUET_ARCHIVE_DIR)
        lazy_result_df = build_unified_lazy_from_parquet(PARQUET_ARCHIVE_DIR)
        if lazy_result_df is None:
            logging.error("Failed to build unified parquet LazyFrame.")
            mongo_client.close()
            return
    else:
        logging.info("Parquet archive not found. Falling back to remote JSON download (slower).")
        links_data = download_and_extract_json(LINKS_URL)
        abstracts_data = download_and_extract_json(ABSTRACTS_URL)
        if links_data is None or abstracts_data is None:
            logging.error("Failed to retrieve one or both data files. Exiting.")
            mongo_client.close()
            return
        lazy_result_df = find_papers_without_code_polars_lazy(abstracts_data, links_data)
        if lazy_result_df is None:
            logging.error("Failed to define LazyFrame from downloaded JSON.")
            mongo_client.close()
            return
    logging.info("Unified LazyFrame constructed. Beginning batched write.")

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
