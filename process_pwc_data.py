import requests
import gzip
import json
import polars as pl
import logging
import io
import os  # For environment variables
from typing import List, Dict, Any, Optional
from pymongo import MongoClient, errors as pymongo_errors  # For MongoDB
from pymongo.operations import ReplaceOne  # For upserting
from dotenv import load_dotenv  # To load .env file

# --- Configuration ---
LINKS_URL = "https://production-media.paperswithcode.com/about/links-between-papers-and-code.json.gz"
ABSTRACTS_URL = "https://production-media.paperswithcode.com/about/papers-with-abstracts.json.gz"

# MongoDB Config (replace with your actual DB and Collection names)
DB_NAME = "papers2code"
COLLECTION_NAME = "papers_without_code"

# Load environment variables from .env file
load_dotenv()
MONGO_CONNECTION_STRING = os.environ.get("MONGO_URI")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


# --- Helper Functions ---

def download_and_extract_json(url: str) -> Optional[List[Dict[str, Any]]]:
    """
    Downloads a gzipped JSON file from a URL, extracts it in memory,
    and parses the JSON data.
    """
    logging.info(f"Attempting to download data from {url}...")
    try:
        response = requests.get(url, stream=True, timeout=120) # Increased timeout
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
    # (Error handling unchanged)
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
    """
    Establishes a connection to MongoDB using the provided connection string.
    """
    if not connection_string:
        logging.error("MongoDB connection string (MONGO_URI) not found.")
        return None
    try:
        logging.info("Connecting to MongoDB...")
        client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
        client.admin.command('ismaster')
        logging.info("Successfully connected to MongoDB.")
        return client
    # (Error handling unchanged)
    except pymongo_errors.ConnectionFailure as e:
        logging.error(f"Failed to connect to MongoDB: {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred during MongoDB connection: {e}")
        return None


def save_to_mongodb(client: MongoClient, db_name: str, collection_name: str, data_df: pl.DataFrame):
    """
    Saves the data from a Polars DataFrame to a MongoDB collection using upserts.
    """
    if data_df.is_empty():
        logging.info("DataFrame is empty, nothing to save to MongoDB.")
        return

    try:
        db = client[db_name]
        collection = db[collection_name]
        logging.info(f"Preparing to save/update {data_df.height} records in MongoDB ({db_name}.{collection_name})...")

        records = data_df.to_dicts()

        bulk_ops = [
            ReplaceOne(
                {"pwc_url": record["pwc_url"]}, # Filter: match unique URL
                record,                        # New document data
                upsert=True                    # Upsert: insert if not found
            )
            for record in records
        ]

        if not bulk_ops:
            logging.info("No operations generated for MongoDB bulk write.")
            return

        result = collection.bulk_write(bulk_ops)
        logging.info(f"MongoDB bulk write completed. Matched: {result.matched_count}, "
                     f"Upserted: {result.upserted_count}, Modified: {result.modified_count}")

    # (Error handling unchanged)
    except pymongo_errors.BulkWriteError as bwe:
        logging.error(f"MongoDB bulk write error: {bwe.details}")
    except Exception as e:
        logging.error(f"An error occurred while saving data to MongoDB: {e}")


# --- Core Logic (Eager) ---

def find_papers_without_code_polars(
    papers_with_abstracts_data: List[Dict[str, Any]],
    links_data: List[Dict[str, Any]]
) -> Optional[pl.DataFrame]:
    """
    Identifies papers that do not have associated code using Polars DataFrames (Eager).
    Includes necessary data type casting (using Datetime for dates) and default fields for DB insertion.
    """
    if papers_with_abstracts_data is None or links_data is None:
         logging.error("Input data lists cannot be None.")
         return None
    if not papers_with_abstracts_data:
        logging.warning("Papers with abstracts data is empty.")
        return pl.DataFrame() # Return empty DataFrame

    abstracts_df = pl.DataFrame(papers_with_abstracts_data)

    if not links_data:
         logging.warning("Links data is empty. Assuming all papers need code.")
         papers_without_code_df = abstracts_df # Start with all abstracts
    else:
        try:
            links_df = pl.DataFrame(links_data)
            if links_df.height == 0:
                 logging.warning("Links DataFrame is empty after creation.")
                 papers_without_code_df = abstracts_df
            else:
                papers_with_code_urls_df = links_df.select("paper_url").unique()
                logging.info(f"Found {papers_with_code_urls_df.height} unique paper URLs with associated code.")

                logging.info("Filtering papers (eager) to find those without code...")
                papers_without_code_df = abstracts_df.filter(
                    ~pl.col("paper_url").is_in(papers_with_code_urls_df["paper_url"])
                )
                logging.info(f"Identified {papers_without_code_df.height} papers without associated code.")
        except Exception as e:
             logging.error(f"Error processing links data, assuming all papers need code: {e}")
             papers_without_code_df = abstracts_df # Fallback

    try:
        # --- Select, Cast, Rename, and Add Default Columns ---
        papers_without_code_df = papers_without_code_df.select([
            pl.col("paper_url").alias("pwc_url"),
            pl.col("title").fill_null("").cast(pl.Utf8),
            pl.col("abstract").fill_null("").cast(pl.Utf8),
            pl.col("authors"), # Keep as list
            pl.col("url_abs").fill_null("").cast(pl.Utf8),
            pl.col("url_pdf").fill_null("").cast(pl.Utf8),
            pl.col("arxiv_id").fill_null("").cast(pl.Utf8),
            # CHANGE HERE: Use pl.Datetime for MongoDB compatibility
            pl.col("date").str.strptime(pl.Datetime, "%Y-%m-%d", strict=False).alias("publication_date"),
            pl.col("proceeding").alias("venue").fill_null("").cast(pl.Utf8),
            pl.col("tasks"), # Keep as list
            # Add default status fields needed for the database
            pl.lit("Needs Code").alias("status"),
            pl.lit(True).alias("is_implementable")
        ])
        return papers_without_code_df

    except pl.exceptions.PolarsError as e:
        logging.error(f"A Polars error occurred during select/cast: {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred during Polars select/cast processing: {e}")
        return None


# --- Main Execution ---

def main():
    """
    Main function to orchestrate download, processing, and saving to MongoDB.
    """
    logging.info("Starting the PapersWithCode data processing job...")

    mongo_client = get_mongo_client(MONGO_CONNECTION_STRING)
    # Decide if you want to proceed if DB connection fails
    # if mongo_client is None:
    #     logging.warning("Could not establish MongoDB connection. Proceeding without DB saving.")

    # 1. Download and process data
    links_data = download_and_extract_json(LINKS_URL)
    abstracts_data = download_and_extract_json(ABSTRACTS_URL)

    if links_data is None or abstracts_data is None:
        logging.error("Failed to retrieve or parse one or both data files. Exiting.")
        if mongo_client: mongo_client.close()
        return

    # 2. Find papers without code using EAGER Polars
    papers_needing_code_df = find_papers_without_code_polars(abstracts_data, links_data)

    if papers_needing_code_df is not None:
        logging.info(f"Successfully identified {papers_needing_code_df.height} papers potentially needing code.")

        # --- Print Sample ---
        print("\n--- Sample of Papers Found Without Code ---")
        # Use shape check before head() if df could be empty
        if papers_needing_code_df.height > 0:
             print(papers_needing_code_df.head())
        else:
             print("(No papers found without code)")

        # --- Save to MongoDB (if client available) ---
        if mongo_client:
            save_to_mongodb(mongo_client, DB_NAME, COLLECTION_NAME, papers_needing_code_df)
        else:
            logging.warning("MongoDB client not available. Skipping database save.")

    else:
        logging.error("Failed to process data to find papers without code.")

    # Close MongoDB connection if it was opened
    if mongo_client:
        logging.info("Closing MongoDB connection.")
        mongo_client.close()

    logging.info("Data processing job finished.")


if __name__ == "__main__":
    main()