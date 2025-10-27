#!/usr/bin/env python3
"""
Test script for the enhanced copy_prod_data_to_test.py script
"""

import os
import sys
import asyncio
from datetime import datetime, timezone

# Add the project root to the Python path
project_root = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, project_root)

# Set up test environment
os.environ['ENV_TYPE'] = 'DEV'

from papers2code_app2.database import initialize_async_db, async_db


async def test_collection_discovery():
    """Test the collection discovery functionality using our existing test database."""
    print("🧪 Testing Collection Discovery Functionality")
    print("=" * 60)
    
    try:
        # Initialize database connection
        await initialize_async_db()
        
        if not async_db:
            print("❌ Could not connect to test database")
            return False
        
        print(f"✅ Connected to database: {async_db.name}")
        
        # List all collections
        collection_names = await async_db.list_collection_names()
        print(f"📋 Found {len(collection_names)} total collections:")
        
        # Filter and analyze collections
        user_collections = []
        for collection_name in collection_names:
            if collection_name.startswith('system.'):
                print(f"  ⚠️  Skipping system collection: {collection_name}")
                continue
            
            try:
                collection = async_db[collection_name]
                doc_count = await collection.count_documents({})
                user_collections.append({
                    'name': collection_name,
                    'count': doc_count
                })
                
                if doc_count > 0:
                    print(f"  ✅ {collection_name}: {doc_count} documents")
                else:
                    print(f"  📭 {collection_name}: empty")
                    
            except Exception as e:
                print(f"  ❌ Error checking {collection_name}: {e}")
        
        # Test sampling logic
        print(f"\n🎯 Testing Sampling Logic:")
        print(f"📊 Collections that would be sampled:")
        
        min_sample = 20
        default_sample = 100
        
        for collection_info in user_collections:
            collection_name = collection_info['name']
            total_docs = collection_info['count']
            
            if total_docs == 0:
                print(f"  ⚠️  {collection_name}: Would skip (empty)")
                continue
            
            # Calculate sample size
            if total_docs <= min_sample:
                sample_size = total_docs
                sample_type = "all (below minimum)"
            else:
                if total_docs > 1000:
                    sample_size = max(min_sample, min(default_sample, int(total_docs * 0.1)))
                    sample_type = "10% (large collection)"
                else:
                    sample_size = max(min_sample, min(default_sample, int(total_docs * 0.2)))
                    sample_type = "20% (medium collection)"
            
            sample_rate = f"{(sample_size / total_docs * 100):.1f}%" if total_docs > 0 else "0%"
            print(f"  📈 {collection_name}: {sample_size}/{total_docs} docs ({sample_rate}) - {sample_type}")
        
        print(f"\n✅ Collection discovery test completed successfully!")
        print(f"🎉 Found {len(user_collections)} user collections ready for sampling")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run the collection discovery test."""
    success = await test_collection_discovery()
    return 0 if success else 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)
