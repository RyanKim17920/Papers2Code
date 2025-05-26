# check_db_content.py
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import logging

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def main():
    # Load environment variables from .env file in the current directory
    # Assumes this script is run from the root of the Papers-2-code project
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    if not os.path.exists(dotenv_path):
        logging.error(f".env file not found at {dotenv_path}")
        logging.error("Please ensure your .env file is in the root of your project (c:\\Users\\ilove\\CODING\\Papers-2-code\\.env).")
        return

    load_dotenv(dotenv_path=dotenv_path, override=True)
    logging.info(f"Loaded environment variables from: {dotenv_path}")

    mongo_uri = os.getenv("MONGO_URI_PROD_TEST")
    # Explicitly checking the database name your FastAPI app is configured to use for PROD_TEST
    db_name_to_check = "PROD_TEST" 
    collection_name = "papers"

    if not mongo_uri:
        logging.error("MONGO_URI_PROD_TEST is not set in your .env file.")
        return

    logging.info(f"Attempting to connect to MongoDB URI: {mongo_uri}")
    logging.info(f"Will try to access database: '{db_name_to_check}', collection: '{collection_name}'")

    client = None
    try:
        client = MongoClient(mongo_uri)
        # Ping the server to verify connection
        client.admin.command('ping')
        logging.info("MongoDB server ping successful.")

        db = client[db_name_to_check]
        logging.info(f"Successfully accessed database object for name: '{db_name_to_check}'. Actual DB name from object: '{db.name}'.")

        collection_names_in_db = db.list_collection_names()
        logging.info(f"Collections available in database '{db.name}': {collection_names_in_db}")

        if collection_name not in collection_names_in_db:
            logging.warning(f"Collection '{collection_name}' does NOT exist in database '{db.name}'.")
            return

        papers_collection = db[collection_name]
        logging.info(f"Successfully accessed collection: '{papers_collection.name}'.")

        count = papers_collection.count_documents({})
        logging.info(f"Total documents in '{db.name}.{papers_collection.name}': {count}")

        if count > 0:
            logging.info(f"\nFetching up to 3 sample documents from '{papers_collection.name}':")
            sample_docs = papers_collection.find().limit(3)
            for i, doc in enumerate(sample_docs):
                logging.info(f"\n--- Document {i+1} ---")
                # Print only a few fields for brevity, especially _id and title
                logging.info(f"  _id: {doc.get('_id')}")
                logging.info(f"  title: {doc.get('title', 'N/A')}")
                logging.info(f"  arxiv_id: {doc.get('arxiv_id', 'N/A')}")
                logging.info(f"  nonImplementableStatus: {doc.get('nonImplementableStatus', 'N/A')}")
            if count > 3:
                logging.info("\n...")
        elif count == 0:
            logging.warning(f"The collection '{db.name}.{papers_collection.name}' is empty.")

    except Exception as e:
        logging.error(f"An error occurred: {e}", exc_info=True)
    finally:
        if client:
            client.close()
            logging.info("MongoDB connection closed.")

if __name__ == "__main__":
    main()
