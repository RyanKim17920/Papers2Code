import pymongo
from pymongo import ReplaceOne

# --- Helper function to convert snake_case to camelCase ---
def to_camel(name: str) -> str:
    """
    Converts a snake_case string to camelCase.
    Handles leading underscores correctly (e.g., _id remains _id, _my_field becomes _myField).
    """
    # Handle leading underscores by removing them and adding them back later
    leading_underscores_count = 0
    temp_name = name
    while temp_name.startswith('_'):
        leading_underscores_count += 1
        temp_name = temp_name[1:]

    if not temp_name:  # if name was all underscores
        return '_' * leading_underscores_count

    words = temp_name.split('_')
    # Capitalize words except the first, filter out empty strings from multiple underscores
    camel_case_name_parts = []
    if words:
        camel_case_name_parts.append(words[0]) # First word as is (or empty if leading underscore was the only content before split)
        for word in words[1:]:
            if word: # Only capitalize non-empty words
                camel_case_name_parts.append(word.capitalize())
            # else: preserve multiple underscores by not adding an empty capitalized string
    
    camel_case_name = "".join(camel_case_name_parts)
    
    return '_' * leading_underscores_count + camel_case_name

# --- Recursive function to convert keys in a document ---
def convert_keys_to_camel_case(item):
    """
    Recursively traverses a Python object (dict, list, or other)
    and converts all dictionary keys from snake_case to camelCase.
    """
    if isinstance(item, dict):
        new_dict = {}
        for k, v in item.items():
            new_key = to_camel(k) # Convert the key
            new_dict[new_key] = convert_keys_to_camel_case(v) # Recursively convert values
        return new_dict
    elif isinstance(item, list):
        # Recursively convert items in a list
        return [convert_keys_to_camel_case(i) for i in item]
    else:
        # Return non-dict/list items as is
        return item

# --- Main migration function for a single collection ---
def migrate_collection_to_camel_case(db, collection_name):
    collection = db[collection_name]
    
    print(f"\nPreparing collection: {collection_name} for migration...")

    # Drop all indexes except _id_ before migration
    try:
        indexes = collection.list_indexes()
        indexes_dropped_count = 0
        print(f"  Found indexes in '{collection_name}':")
        for index in indexes:
            index_name = index["name"]
            if index_name == "_id_":
                print(f"    - Skipping default index: {index_name}")
                continue
            print(f"    - Dropping index: {index_name} (keys: {index['key']})")
            collection.drop_index(index_name)
            indexes_dropped_count += 1
        if indexes_dropped_count > 0:
            print(f"  Successfully dropped {indexes_dropped_count} custom index(es) from '{collection_name}'.")
        else:
            print(f"  No custom indexes found or dropped in '{collection_name}'.")
    except Exception as e:
        print(f"  Error dropping indexes for collection '{collection_name}': {e}")
        print("  Skipping migration for this collection due to error during index removal.")
        return

    documents_cursor = None
    updated_count = 0
    processed_count = 0
    batch_size = 500  # Configure batch size for bulk operations
    operations = []

    print(f"\nProcessing collection: {collection_name}...")
    try:
        # documents_cursor = collection.find(no_cursor_timeout=True) # Removed due to Atlas tier restrictions
        documents_cursor = collection.find()
        
        for doc in documents_cursor:
            processed_count += 1
            original_id = doc["_id"]
            
            new_doc_with_camel_keys = convert_keys_to_camel_case(doc)
            
            if doc != new_doc_with_camel_keys:
                operations.append(ReplaceOne({"_id": original_id}, new_doc_with_camel_keys))
                updated_count += 1 # Increment here, assuming op will succeed. bulk_write result can confirm.
            
            if len(operations) >= batch_size:
                if operations:
                    result = collection.bulk_write(operations)
                    print(f"  Processed {processed_count} documents, Batch written (matched: {result.matched_count}, modified: {result.modified_count}) in '{collection_name}'...")
                    operations = []
            elif processed_count % (batch_size * 2) == 0: # Log progress even if not writing a batch
                 print(f"  Processed {processed_count} documents so far in '{collection_name}' (updated {updated_count})...")


        # Write any remaining operations in the last batch
        if operations:
            result = collection.bulk_write(operations)
            print(f"  Processed {processed_count} documents, Final batch written (matched: {result.matched_count}, modified: {result.modified_count}) in '{collection_name}'...")

    except pymongo.errors.PyMongoError as e:
        print(f"  A MongoDB error occurred while processing collection '{collection_name}': {e}")
    finally:
        if documents_cursor:
            documents_cursor.close()
            print(f"  Cursor for '{collection_name}' closed.")
        
    print(f"Finished migrating collection: '{collection_name}'.")
    print(f"  Total documents processed: {processed_count}")
    print(f"  Total documents updated: {updated_count}")

# --- Main execution block ---
def main():
    # ----------------------------------------------------------------------
    # IMPORTANT: CONFIGURE YOUR MONGODB CONNECTION DETAILS BELOW
    # ----------------------------------------------------------------------
    MONGO_URI = "mongodb+srv://ryankim17920:ZmAlQpWoEi@papers2code.5hipn0o.mongodb.net/?retryWrites=true&w=majority&appName=papers2code"  # <--- REPLACE with your MongoDB connection URI
    DB_NAME = "papers2code"                  # <--- REPLACE with your database name
    # ----------------------------------------------------------------------

    # Collections to migrate (as identified in previous discussions)
    COLLECTIONS_TO_MIGRATE = ["papers", "user_actions", "users",  "removed_papers"] # need to do removed_papers as well oops

    print("Starting MongoDB field name migration from snake_case to camelCase.")
    print(f"Target MongoDB URI (ensure this is correct): {MONGO_URI}")
    print(f"Target Database: {DB_NAME}")
    print(f"Target Collections: {', '.join(COLLECTIONS_TO_MIGRATE)}")
    
    print("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("!!! CRITICAL WARNING:                                            !!!")
    print("!!! This script will modify your database data IN PLACE.         !!!")
    print("!!! ENSURE YOU HAVE A RELIABLE BACKUP of the database          !!!")
    print("!!! before proceeding.                                           !!!")
    print("!!! It is STRONGLY recommended to test this script on a        !!!")
    print("!!! staging or development environment with a copy of your     !!!")
    print("!!! production data first.                                       !!!")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n")

    proceed = input(f"Have you backed up the '{DB_NAME}' database and want to proceed with the migration? (yes/no): ")
    if proceed.lower() != 'yes':
        print("Migration aborted by the user.")
        return

    try:
        client = pymongo.MongoClient(MONGO_URI)
        # Ping the server to verify connection before performing operations
        client.admin.command('ping')
        print("\nSuccessfully connected to MongoDB.")
        db = client[DB_NAME]
    except Exception as e:
        print(f"\nFailed to connect to MongoDB: {e}")
        print("Please check your MONGO_URI.")
        return

    for collection_name in COLLECTIONS_TO_MIGRATE:
        migrate_collection_to_camel_case(db, collection_name)

    print("\nMigration process finished for all specified collections.")
    client.close()
    print("MongoDB connection closed.")

if __name__ == "__main__":
    main()
