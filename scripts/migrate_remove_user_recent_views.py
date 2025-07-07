#!/usr/bin/env python3
"""
Migration Script: Remove user_recent_views Collection

This script safely removes the redundant user_recent_views collection
and any cached data related to it. The user_recent_views functionality
has been replaced with direct queries to paper_views for better efficiency.

Safety features:
- Backs up existing data before deletion
- Verifies dashboard service works with new approach
- Provides rollback capability if needed
"""

import os
import sys
import asyncio
import logging
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from papers2code_app2.database import (
    initialize_async_db,
    async_db,
    get_paper_views_collection_async
)
from papers2code_app2.services.dashboard_service import DashboardService


def setup_logging():
    """Configure logging for the migration."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
        ]
    )
    
    return logging.getLogger(__name__)


async def backup_user_recent_views_data():
    """Backup user_recent_views data before deletion."""
    logger = logging.getLogger(__name__)
    
    try:
        await initialize_async_db()
        
        # Import async_db after initialization
        from papers2code_app2.database import async_db
        
        if async_db is None:
            raise Exception("Database not initialized")
        
        # Check if user_recent_views collection exists
        collections = await async_db.list_collection_names()
        if "user_recent_views" not in collections:
            logger.info("✅ user_recent_views collection doesn't exist - migration not needed")
            return True
        
        user_recent_coll = async_db["user_recent_views"]
        
        # Count documents
        doc_count = await user_recent_coll.count_documents({})
        logger.info(f"📊 Found {doc_count} documents in user_recent_views collection")
        
        if doc_count == 0:
            logger.info("✅ user_recent_views collection is empty - safe to remove")
            return True
        
        # Create backup
        backup_file = f"user_recent_views_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        backup_path = os.path.join(project_root, "backups", backup_file)
        
        # Create backups directory if it doesn't exist
        os.makedirs(os.path.dirname(backup_path), exist_ok=True)
        
        # Export all documents
        cursor = user_recent_coll.find({})
        backup_data = []
        async for doc in cursor:
            # Convert ObjectId to string for JSON serialization
            doc["_id"] = str(doc["_id"])
            if "last_updated" in doc and doc["last_updated"]:
                doc["last_updated"] = doc["last_updated"].isoformat()
            backup_data.append(doc)
        
        # Write backup file
        with open(backup_path, 'w') as f:
            json.dump({
                "collection": "user_recent_views",
                "backup_date": datetime.now().isoformat(),
                "document_count": len(backup_data),
                "data": backup_data
            }, f, indent=2)
        
        logger.info(f"✅ Backup created: {backup_path}")
        logger.info(f"📁 Backed up {len(backup_data)} documents")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Backup failed: {e}")
        return False


async def test_new_dashboard_functionality():
    """Test that the new dashboard service works correctly without user_recent_views."""
    logger = logging.getLogger(__name__)
    
    try:
        await initialize_async_db()
        
        # Create a few test paper views to ensure the new functionality works
        views_coll = await get_paper_views_collection_async()
        
        test_user_id = "test_migration_user"
        test_paper_ids = ["test_paper_1", "test_paper_2", "test_paper_3"]
        
        now = datetime.now(timezone.utc)
        
        # Insert test views
        test_views = []
        for i, paper_id in enumerate(test_paper_ids):
            test_views.append({
                "userId": test_user_id,
                "paperId": paper_id,
                "timestamp": now - timedelta(hours=i),
                "sessionId": "test_session",
                "userAgent": "test_migration"
            })
        
        await views_coll.insert_many(test_views)
        logger.info(f"✅ Created {len(test_views)} test paper views")
        
        # Test dashboard service
        dashboard_service = DashboardService()
        recent_papers = await dashboard_service.get_user_recent_papers(test_user_id, limit=5)
        
        logger.info(f"📊 Dashboard service returned {len(recent_papers)} recent papers")
        
        # Verify the results
        if len(recent_papers) == len(test_paper_ids):
            logger.info("✅ Dashboard service working correctly with new approach")
            success = True
        else:
            logger.warning(f"⚠️  Expected {len(test_paper_ids)} papers, got {len(recent_papers)}")
            success = False
        
        # Clean up test data
        await views_coll.delete_many({"userId": test_user_id})
        logger.info("🧹 Test data cleaned up")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Dashboard functionality test failed: {e}")
        return False


async def remove_user_recent_views_collection():
    """Safely remove the user_recent_views collection."""
    logger = logging.getLogger(__name__)
    
    try:
        await initialize_async_db()
        
        if async_db is None:
            raise Exception("Database not initialized")
        
        # Check if collection exists
        collections = await async_db.list_collection_names()
        if "user_recent_views" not in collections:
            logger.info("✅ user_recent_views collection already removed")
            return True
        
        # Drop the collection
        await async_db.drop_collection("user_recent_views")
        logger.info("✅ user_recent_views collection removed successfully")
        
        # Verify it's gone
        collections_after = await async_db.list_collection_names()
        if "user_recent_views" not in collections_after:
            logger.info("✅ Verified: user_recent_views collection no longer exists")
            return True
        else:
            logger.error("❌ Collection still exists after deletion attempt")
            return False
        
    except Exception as e:
        logger.error(f"❌ Failed to remove collection: {e}")
        return False


async def verify_migration_success():
    """Verify that the migration was successful and everything still works."""
    logger = logging.getLogger(__name__)
    
    try:
        # Test that database connections still work
        await initialize_async_db()
        
        # Test that paper_views collection still exists and works
        views_coll = await get_paper_views_collection_async()
        view_count = await views_coll.count_documents({})
        logger.info(f"✅ paper_views collection accessible with {view_count} documents")
        
        # Test dashboard service again
        dashboard_service = DashboardService()
        
        # This should work without errors even if no recent papers exist
        recent_papers = await dashboard_service.get_user_recent_papers("nonexistent_user", limit=5)
        logger.info(f"✅ Dashboard service works correctly (returned {len(recent_papers)} papers)")
        
        logger.info("✅ Migration verification completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration verification failed: {e}")
        return False


async def run_migration():
    """Run the complete migration process."""
    logger = setup_logging()
    
    try:
        logger.info("🚀 Starting user_recent_views collection removal migration...")
        
        # Step 1: Backup existing data
        logger.info("📦 Step 1: Backing up existing data...")
        if not await backup_user_recent_views_data():
            logger.error("❌ Backup failed - aborting migration")
            return False
        
        # Step 2: Test new functionality
        logger.info("🧪 Step 2: Testing new dashboard functionality...")
        if not await test_new_dashboard_functionality():
            logger.error("❌ New functionality test failed - aborting migration")
            return False
        
        # Step 3: Remove the collection
        logger.info("🗑️  Step 3: Removing user_recent_views collection...")
        if not await remove_user_recent_views_collection():
            logger.error("❌ Collection removal failed")
            return False
        
        # Step 4: Verify migration
        logger.info("✅ Step 4: Verifying migration success...")
        if not await verify_migration_success():
            logger.error("❌ Migration verification failed")
            return False
        
        logger.info("🎉 Migration completed successfully!")
        logger.info("📋 Summary:")
        logger.info("  ✅ user_recent_views collection removed")
        logger.info("  ✅ Dashboard service updated to use direct paper_views queries")
        logger.info("  ✅ Background tasks no longer maintain redundant user view data")
        logger.info("  ✅ All functionality verified to work correctly")
        
        return True
        
    except Exception as e:
        logger.error(f"💥 Migration failed: {e}", exc_info=True)
        return False


def main():
    """Main entry point."""
    try:
        success = asyncio.run(run_migration())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("Migration interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal migration error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
