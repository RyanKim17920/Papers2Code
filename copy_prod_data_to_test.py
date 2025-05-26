import os
import random
from pymongo import MongoClient, errors

def get_env_variable(var_name, default=None):
    value = os.getenv(var_name)
    if value is None and default is None:
        raise ValueError(f"Environment variable {var_name} not set and no default provided.")
    elif value is None:
        return default
    return value

def connect_to_db(uri, db_name, connection_type="Source"):
    print(f"Attempting to connect to {connection_type} MongoDB: {uri}, DB: {db_name}")
    try:
        client = MongoClient(uri)
        client.admin.command('ping')  # Verify connection
        print(f"{connection_type} MongoDB server ping successful.")
        db = client[db_name]
        print(f"Successfully connected to {connection_type} MongoDB database: '{db_name}'.")
        return db
    except errors.ConnectionFailure as e:
        print(f"CRITICAL: Failed to connect to {connection_type} MongoDB at {uri} (DB: {db_name}). Error: {e}")
        raise
    except Exception as e:
        print(f"CRITICAL: An unexpected error occurred while connecting to {connection_type} MongoDB. Error: {e}")
        raise

def copy_random_papers(source_db, target_db, num_papers_to_copy):
    source_collection_name = "papers_without_code"
    target_collection_name = "papers_without_code" # Assuming same collection name

    source_collection = source_db[source_collection_name]
    target_collection = target_db[target_collection_name]

    print(f"Fetching {num_papers_to_copy} random papers from source collection '{source_collection_name}'...")

    # MongoDB's $sample is efficient for getting random documents
    # Ensure the collection is not empty to avoid errors with $sample
    if source_collection.count_documents({}) == 0:
        print(f"Source collection '{source_collection_name}' is empty. No papers to copy.")
        return

    try:
        random_papers = list(source_collection.aggregate([
            {"$sample": {"size": num_papers_to_copy}}
        ]))
    except errors.OperationFailure as e:
        # This can happen if num_papers_to_copy is larger than the collection size with $sample
        # or other aggregation errors.
        print(f"Error during $sample aggregation: {e}. Fetching all available papers if less than requested.")
        all_papers = list(source_collection.find())
        if len(all_papers) <= num_papers_to_copy:
            random_papers = all_papers
            print(f"Fetched all {len(all_papers)} papers from source as it's less than or equal to requested {num_papers_to_copy}.")
        else:
            # Fallback to random.sample if $sample fails and we have more papers than requested
            random_papers = random.sample(all_papers, num_papers_to_copy)
            print(f"Fetched {num_papers_to_copy} papers using random.sample as a fallback.")


    if not random_papers:
        print("No papers found in the source collection to copy.")
        return

    print(f"Found {len(random_papers)} papers to copy.")

    # Optional: Clear the target collection before inserting if you want a fresh copy each time
    # print(f"Clearing existing documents from target collection '{target_collection_name}'...")
    # target_collection.delete_many({})
    # print("Target collection cleared.")

    print(f"Inserting {len(random_papers)} papers into target collection '{target_collection_name}'...")
    try:
        result = target_collection.insert_many(random_papers, ordered=False) # ordered=False allows to continue if one doc fails
        print(f"Successfully inserted {len(result.inserted_ids)} papers into '{target_collection_name}'.")
    except errors.BulkWriteError as bwe:
        print(f"Bulk write error during insertion. {len(bwe.details.get('insertedDocs', []))} papers were inserted.")
        print(f"Details: {bwe.details}")
    except Exception as e:
        print(f"An error occurred during insertion: {e}")

if __name__ == "__main__":
    print("Starting script to copy production data to test environment...")

    try:
        # --- Configuration ---
        SOURCE_MONGO_URI = get_env_variable("SOURCE_MONGO_URI")
        
        SOURCE_DB_NAME = get_env_variable("SOURCE_DB_NAME")
        TARGET_MONGO_URI = get_env_variable("TARGET_MONGO_URI")
        TARGET_DB_NAME = get_env_variable("TARGET_DB_NAME")
        NUM_PAPERS_TO_COPY = int(get_env_variable("NUM_PAPERS_TO_COPY", "100"))

        print("\\n--- Source Database ---")
        source_db = connect_to_db(SOURCE_MONGO_URI, SOURCE_DB_NAME, "Source")

        print("\\n--- Target Database ---")
        target_db = connect_to_db(TARGET_MONGO_URI, TARGET_DB_NAME, "Target")

        print("\\n--- Data Copying ---")
        copy_random_papers(source_db, target_db, NUM_PAPERS_TO_COPY)

        print("\\nScript finished successfully.")

    except ValueError as ve:
        print(f"Configuration Error: {ve}")
    except errors.ConnectionFailure:
        print("Database connection failed. Please check your MONGO_URI and network settings.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
