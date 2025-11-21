import os
import random
from pymongo import MongoClient, errors
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import dotenv

dotenv.load_dotenv()

def get_env_variable(var_name, default=None):
    """Get environment variable with optional default."""
    value = os.getenv(var_name)
    if value is None and default is None:
        raise ValueError(f"Environment variable {var_name} not set and no default provided.")
    elif value is None:
        return default
    return value


def connect_to_db(uri, db_name, connection_type="Source"):
    """Connect to MongoDB database with error handling."""
    print(f"Attempting to connect to {connection_type} MongoDB: {uri}, DB: {db_name}")
    try:
        client = MongoClient(uri)
        client.admin.command('ping')  # Verify connection
        print(f"{connection_type} MongoDB server ping successful.")
        db = client[db_name]
        print(f"Successfully connected to {connection_type} MongoDB database: '{db_name}'.")
        return db, client
    except errors.ConnectionFailure as e:
        print(f"CRITICAL: Failed to connect to {connection_type} MongoDB at {uri} (DB: {db_name}). Error: {e}")
        raise
    except Exception as e:
        print(f"CRITICAL: An unexpected error occurred while connecting to {connection_type} MongoDB. Error: {e}")
        raise


def get_collection_stats(db, collection_name: str) -> Dict[str, Any]:
    """Get statistics about a collection."""
    try:
        collection = db[collection_name]
        stats = db.command("collStats", collection_name)
        doc_count = collection.count_documents({})
        
        return {
            "name": collection_name,
            "document_count": doc_count,
            "size_mb": round(stats.get("size", 0) / (1024 * 1024), 2),
            "avg_doc_size": round(stats.get("avgObjSize", 0), 2) if doc_count > 0 else 0,
            "indexes": stats.get("nindexes", 0)
        }
    except Exception as e:
        print(f"Warning: Could not get stats for collection {collection_name}: {e}")
        return {"name": collection_name, "error": str(e)}


def discover_collections(db):
    """Discover all collections in the database, excluding system collections."""
    try:
        all_collections = db.list_collection_names()
        # Filter out system collections and empty collections
        user_collections = []
        
        for collection_name in all_collections:
            # Skip system collections
            if collection_name.startswith('system.'):
                continue
                
            # Check if collection has documents
            try:
                doc_count = db[collection_name].count_documents({})
                if doc_count > 0:
                    user_collections.append({
                        'name': collection_name,
                        'count': doc_count
                    })
                    print(f"Found collection '{collection_name}' with {doc_count} documents")
                else:
                    print(f"Skipping empty collection '{collection_name}'")
            except Exception as e:
                print(f"Warning: Could not check collection '{collection_name}': {e}")
        
        return user_collections
    except Exception as e:
        print(f"Error discovering collections: {e}")
        return []


def copy_random_documents_from_collection(source_db, target_db, collection_name: str, sample_size: int, min_sample: int = 20):
    """Copy random documents from a specific collection."""
    source_collection = source_db[collection_name]
    target_collection = target_db[collection_name]
    
    print(f"📄 Processing collection '{collection_name}'...")
    
    # Get total document count
    total_docs = source_collection.count_documents({})
    if total_docs == 0:
        print(f"  ⚠️  Collection '{collection_name}' is empty. Skipping.")
        return []
    
    # Determine actual sample size (minimum 20, or total if less than 20)
    actual_sample_size = max(min_sample, min(sample_size, total_docs))
    if total_docs < min_sample:
        actual_sample_size = total_docs
        print(f"  ℹ️  Collection has only {total_docs} documents, copying all")
    else:
        print(f"  ℹ️  Sampling {actual_sample_size} documents from {total_docs} total")
    
    # Get random documents
    try:
        if actual_sample_size >= total_docs:
            # Copy all documents
            random_docs = list(source_collection.find())
        else:
            # Use aggregation sampling
            try:
                random_docs = list(source_collection.aggregate([
                    {"$sample": {"size": actual_sample_size}}
                ]))
            except errors.OperationFailure as e:
                print(f"    ⚠️  $sample aggregation failed: {e}. Using fallback method.")
                # Fallback to random.sample
                all_docs = list(source_collection.find())
                if len(all_docs) <= actual_sample_size:
                    random_docs = all_docs
                else:
                    random_docs = random.sample(all_docs, actual_sample_size)
    except Exception as e:
        print(f"  ❌ Error sampling from '{collection_name}': {e}")
        return []
    
    if not random_docs:
        print(f"  ⚠️  No documents found in '{collection_name}' to copy.")
        return []
    
    # Optional: Clear the target collection before inserting
    clear_target = os.getenv("CLEAR_TARGET_COLLECTION", "false").lower() == "true"
    if clear_target:
        print(f"  🗑️  Clearing existing documents from target collection...")
        delete_result = target_collection.delete_many({})
        print(f"    Deleted {delete_result.deleted_count} existing documents")
    
    # Insert documents
    try:
        result = target_collection.insert_many(random_docs, ordered=False)
        print(f"  ✅ Successfully copied {len(result.inserted_ids)} documents to '{collection_name}'")
        
        # Extract IDs for potential relationship tracking
        document_ids = [doc.get("_id") for doc in random_docs if doc.get("_id")]
        return document_ids
        
    except errors.BulkWriteError as bwe:
        inserted_count = len(bwe.details.get('writeResults', []))
        print(f"  ⚠️  Bulk write completed with some errors. {inserted_count} documents were inserted.")
        if bwe.details.get('writeErrors'):
            print(f"    First few errors: {[err.get('errmsg', 'Unknown error') for err in bwe.details['writeErrors'][:3]]}")
        return []
    except Exception as e:
        print(f"  ❌ Error inserting documents into '{collection_name}': {e}")
        return []


def copy_all_collections_with_sampling(source_db, target_db, default_sample_size: int = 100, min_sample: int = 20):
    """Discover and copy random samples from all collections in the source database."""
    print(f"\n🔍 Discovering collections in source database...")
    
    collections_info = discover_collections(source_db)
    if not collections_info:
        print("❌ No collections found to copy.")
        return {}
    
    print(f"\n📊 Found {len(collections_info)} collections to process:")
    for info in collections_info:
        print(f"  • {info['name']}: {info['count']} documents")
    
    # Copy each collection
    copied_summary = {}
    print(f"\n📦 Starting collection sampling and copying...")
    
    for collection_info in collections_info:
        collection_name = collection_info['name']
        
        # Calculate sample size based on collection size
        total_docs = collection_info['count']
        if total_docs <= min_sample:
            sample_size = total_docs
        else:
            # Use percentage-based sampling for large collections, but respect minimums
            if total_docs > 1000:
                sample_size = max(min_sample, min(default_sample_size, int(total_docs * 0.1)))  # 10% for large collections
            else:
                sample_size = max(min_sample, min(default_sample_size, int(total_docs * 0.2)))  # 20% for smaller collections
        
        document_ids = copy_random_documents_from_collection(
            source_db, target_db, collection_name, sample_size, min_sample
        )
        
        copied_summary[collection_name] = {
            'total_source': total_docs,
            'copied': len(document_ids),
            'sample_rate': f"{(len(document_ids) / total_docs * 100):.1f}%" if total_docs > 0 else "0%"
        }
    
    return copied_summary


def print_database_summary(db, db_name: str):
    """Print a comprehensive summary of the database contents."""
    print(f"\n📊 Database Summary: {db_name}")
    print("-" * 60)
    
    try:
        # Get all collection names
        collection_names = db.list_collection_names()
        user_collections = [name for name in collection_names if not name.startswith('system.')]
        
        if not user_collections:
            print("  No user collections found.")
            return
        
        print(f"  Total collections: {len(user_collections)}")
        print("  Collection details:")
        
        total_docs = 0
        total_size_mb = 0
        
        for collection_name in sorted(user_collections):
            try:
                stats = get_collection_stats(db, collection_name)
                if "error" not in stats:
                    total_docs += stats['document_count']
                    total_size_mb += stats['size_mb']
                    print(f"    • {collection_name}: {stats['document_count']:,} docs, {stats['size_mb']:.2f} MB")
                else:
                    print(f"    • {collection_name}: Error - {stats['error']}")
            except Exception as e:
                print(f"    • {collection_name}: Could not retrieve stats - {e}")
        
        print(f"  📈 Total: {total_docs:,} documents, {total_size_mb:.2f} MB")
        
    except Exception as e:
        print(f"  ❌ Error generating database summary: {e}")


def print_copy_summary(copied_summary: dict):
    """Print a detailed summary of what was copied."""
    print(f"\n📋 Copy Operation Summary")
    print("-" * 60)
    
    if not copied_summary:
        print("  No collections were copied.")
        return
    
    total_source_docs = 0
    total_copied_docs = 0
    
    print("  Collection copy results:")
    for collection_name, stats in copied_summary.items():
        total_source_docs += stats['total_source']
        total_copied_docs += stats['copied']
        
        print(f"    • {collection_name}:")
        print(f"      Source: {stats['total_source']:,} docs")
        print(f"      Copied: {stats['copied']:,} docs ({stats['sample_rate']})")
    
    overall_rate = f"{(total_copied_docs / total_source_docs * 100):.1f}%" if total_source_docs > 0 else "0%"
    print(f"  📊 Overall: {total_copied_docs:,} / {total_source_docs:,} documents copied ({overall_rate})")


def main():
    """Main function to copy production data to test environment with comprehensive sampling."""
    print("🚀 Starting enhanced script to copy production data to test environment...")
    print(f"⏰ Started at: {datetime.now(timezone.utc).isoformat()}")

    source_client, target_client = None, None
    
    try:
        # Configuration
        SOURCE_MONGO_URI = get_env_variable("SOURCE_MONGO_URI")
        SOURCE_DB_NAME = get_env_variable("SOURCE_DB_NAME")
        TARGET_MONGO_URI = get_env_variable("TARGET_MONGO_URI")
        TARGET_DB_NAME = get_env_variable("TARGET_DB_NAME")
        DEFAULT_SAMPLE_SIZE = int(get_env_variable("DEFAULT_SAMPLE_SIZE", "100"))
        MIN_SAMPLE_SIZE = int(get_env_variable("MIN_SAMPLE_SIZE", "20"))

        print(f"\n📋 Configuration:")
        print(f"  Default sample size: {DEFAULT_SAMPLE_SIZE}")
        print(f"  Minimum sample size: {MIN_SAMPLE_SIZE}")
        print(f"  Clear target collections: {get_env_variable('CLEAR_TARGET_COLLECTION', 'false')}")
        print(f"  Source DB: {SOURCE_DB_NAME}")
        print(f"  Target DB: {TARGET_DB_NAME}")

        # Connect to databases
        print("\n🔌 Connecting to databases...")
        source_db, source_client = connect_to_db(SOURCE_MONGO_URI, SOURCE_DB_NAME, "Source")
        target_db, target_client = connect_to_db(TARGET_MONGO_URI, TARGET_DB_NAME, "Target")

        # Print source database summary
        print_database_summary(source_db, f"Source ({SOURCE_DB_NAME})")

        # Copy all collections with intelligent sampling
        print(f"\n🎯 Starting comprehensive data copy with intelligent sampling...")
        copied_summary = copy_all_collections_with_sampling(
            source_db, 
            target_db, 
            default_sample_size=DEFAULT_SAMPLE_SIZE,
            min_sample=MIN_SAMPLE_SIZE
        )

        # Print target database summary
        print_database_summary(target_db, f"Target ({TARGET_DB_NAME})")

        # Print detailed copy summary
        print_copy_summary(copied_summary)

        print(f"\n✅ Script completed successfully at {datetime.now(timezone.utc).isoformat()}")
        print(f"📊 Total collections processed: {len(copied_summary)}")

    except ValueError as ve:
        print(f"❌ Configuration Error: {ve}")
        print("\n💡 Required environment variables:")
        print("  • SOURCE_MONGO_URI")
        print("  • SOURCE_DB_NAME") 
        print("  • TARGET_MONGO_URI")
        print("  • TARGET_DB_NAME")
        print("\n🔧 Optional environment variables:")
        print("  • DEFAULT_SAMPLE_SIZE (default: 100)")
        print("  • MIN_SAMPLE_SIZE (default: 20)")
        print("  • CLEAR_TARGET_COLLECTION (default: false)")
        return 1
    except errors.ConnectionFailure:
        print("❌ Database connection failed. Please check your MONGO_URI and network settings.")
        return 1
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        # Clean up connections
        if source_client:
            source_client.close()
            print("🔌 Source database connection closed.")
        if target_client:
            target_client.close()
            print("🔌 Target database connection closed.")
    
    return 0


if __name__ == "__main__":
    exit_code = main()
    exit(exit_code)
