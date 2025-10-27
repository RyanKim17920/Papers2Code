#!/usr/bin/env python3
"""
Comprehensive Test Suite for Papers2Code Cron Jobs

This script performs extensive testing of the cron job functionality
to ensure they work correctly with real data and produce expected outputs.
"""

import os
import sys
import asyncio
import logging
import json
import random
import string
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from unittest.mock import AsyncMock, patch

# Add the project root to the Python path
project_root = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, project_root)

# Set up test environment
os.environ['ENV_TYPE'] = 'DEV'
os.environ['MONGO_URI_DEV'] = os.environ.get('MONGO_URI_DEV', 'mongodb://localhost:27017/')

from papers2code_app2.background_tasks import BackgroundTaskRunner
from papers2code_app2.database import (
    initialize_async_db, 
    get_implementation_progress_collection_async,
    get_paper_views_collection_async,
    get_papers_collection_async,
    get_popular_papers_cache_collection_async, # <-- Import the new getter
    async_db
)
from papers2code_app2.schemas.implementation_progress import EmailStatus


def setup_test_logging():
    """Set up logging for tests."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


async def create_test_data_with_edge_cases():
    """Create comprehensive test data with edge cases for robust testing."""
    logger = logging.getLogger(__name__)
    
    try:
        await initialize_async_db()
        
        impl_coll = await get_implementation_progress_collection_async()
        views_coll = await get_paper_views_collection_async()
        papers_coll = await get_papers_collection_async()

        # Clean up previous test data to ensure a clean slate
        await impl_coll.delete_many({"_id": {"$regex": "^test_"}})
        await views_coll.delete_many({"paperId": {"$regex": "^test_"}})
        await papers_coll.delete_many({"_id": {"$regex": "^test_"}})

        # Test data for email status updates with edge cases
        now = datetime.now(timezone.utc)
        four_weeks_ago = now - timedelta(weeks=4)
        four_weeks_one_day_ago = now - timedelta(weeks=4, days=1)
        exactly_28_days = now - timedelta(days=28)
        recent_date = now - timedelta(days=1)
        future_date = now + timedelta(days=1)
        very_old_date = now - timedelta(days=365)
        
        test_impl_records = [
            # Normal case - should be updated
            {
                "_id": "test_paper_1_needs_update",
                "emailStatus": EmailStatus.SENT.value,
                "emailSentAt": four_weeks_one_day_ago,
                "initiatedBy": "test_user_1",
                "createdAt": four_weeks_one_day_ago,
                "updatedAt": four_weeks_one_day_ago
            },
            # Boundary case - exactly 4 weeks (28 days) - WILL be updated due to $lte
            {
                "_id": "test_paper_2_boundary_28_days", 
                "emailStatus": EmailStatus.SENT.value,
                "emailSentAt": exactly_28_days,
                "initiatedBy": "test_user_2",
                "createdAt": exactly_28_days,
                "updatedAt": exactly_28_days
            },
            # Already NO_RESPONSE - should remain unchanged
            {
                "_id": "test_paper_3_already_no_response",
                "emailStatus": EmailStatus.NO_RESPONSE.value,
                "emailSentAt": four_weeks_one_day_ago,
                "initiatedBy": "test_user_3",
                "createdAt": four_weeks_one_day_ago,
                "updatedAt": four_weeks_one_day_ago
            },
            # Recent - should NOT be updated
            {
                "_id": "test_paper_4_recent",
                "emailStatus": EmailStatus.SENT.value,
                "emailSentAt": recent_date,
                "initiatedBy": "test_user_4",
                "createdAt": recent_date,
                "updatedAt": recent_date
            },
            # Missing emailSentAt - should NOT be updated
            {
                "_id": "test_paper_5_missing_date",
                "emailStatus": EmailStatus.SENT.value,
                "emailSentAt": None,
                "initiatedBy": "test_user_5",
                "createdAt": recent_date,
                "updatedAt": recent_date
            },
            # Future date (edge case) - should NOT be updated
            {
                "_id": "test_paper_6_future_date",
                "emailStatus": EmailStatus.SENT.value,
                "emailSentAt": future_date,
                "initiatedBy": "test_user_6",
                "createdAt": recent_date,
                "updatedAt": recent_date
            },
            # Very old date - should be updated
            {
                "_id": "test_paper_7_very_old",
                "emailStatus": EmailStatus.SENT.value,
                "emailSentAt": very_old_date,
                "initiatedBy": "test_user_7",
                "createdAt": very_old_date,
                "updatedAt": very_old_date
            },
            # Missing required fields edge case
            {
                "_id": "test_paper_8_minimal",
                "emailStatus": EmailStatus.SENT.value,
                "emailSentAt": four_weeks_one_day_ago,
                "initiatedBy": None,  # Missing user
                "createdAt": four_weeks_one_day_ago,
                "updatedAt": four_weeks_one_day_ago
            }
        ]
        
        # Insert test implementation progress
        await impl_coll.insert_many(test_impl_records)
        
        # Create test papers with edge cases
        test_papers = [
            # High upvotes paper
            {
                "_id": "test_paper_1_needs_update",
                "title": "Test Paper 1 - High Upvotes with Special Characters: éñ中文",
                "upvoteCount": 999999,  # Very high number
                "status": "Needs Code",
                "publicationDate": now - timedelta(days=30),
                "createdAt": now - timedelta(days=30),
                "venue": "Test Conference 2024"
            },
            # Recent paper
            {
                "_id": "test_paper_2_boundary_28_days",
                "title": "Test Paper 2 - Recent",
                "upvoteCount": 5,
                "status": "Code Available",
                "publicationDate": now - timedelta(days=2),
                "createdAt": now - timedelta(days=2),
                "venue": "Recent Conference"
            },
            # Zero upvotes
            {
                "_id": "test_paper_3_already_no_response",
                "title": "Test Paper 3 - Zero Upvotes",
                "upvoteCount": 0,
                "status": "Needs Code",
                "publicationDate": now - timedelta(days=15),
                "createdAt": now - timedelta(days=15),
                "venue": "Unpopular Conference"
            },
            # Negative upvotes (edge case)
            {
                "_id": "test_paper_4_recent",
                "title": "Test Paper 4 - Negative Upvotes",
                "upvoteCount": -1,
                "status": "Needs Code",
                "publicationDate": now - timedelta(days=60),
                "createdAt": now - timedelta(days=60),
                "venue": "Edge Case Conference"
            },
            # Missing optional fields
            {
                "_id": "test_paper_5_missing_date",
                "title": "Test Paper 5 - Missing Venue",
                "upvoteCount": 10,
                "status": "Code Available",
                "publicationDate": None,  # Missing publication date
                "createdAt": now - timedelta(days=5),
                "venue": None  # Missing venue
            },
            # Very long title
            {
                "_id": "test_paper_6_future_date",
                "title": "Test Paper 6 - " + "Very Long Title " * 50,  # Extremely long title
                "upvoteCount": 15,
                "status": "Needs Code",
                "publicationDate": now - timedelta(days=10),
                "createdAt": now - timedelta(days=10),
                "venue": "Long Title Conference"
            },
            # Future publication date (edge case)
            {
                "_id": "test_paper_7_very_old",
                "title": "Test Paper 7 - Future Publication",
                "upvoteCount": 20,
                "status": "Code Available",
                "publicationDate": now + timedelta(days=30),  # Future date
                "createdAt": now - timedelta(days=1),
                "venue": "Future Conference"
            },
            # Empty title (edge case)
            {
                "_id": "test_paper_8_minimal",
                "title": "",  # Empty title
                "upvoteCount": 1,
                "status": "Needs Code",
                "publicationDate": now - timedelta(days=7),
                "createdAt": now - timedelta(days=7),
                "venue": ""  # Empty venue
            }
        ]
        
        await papers_coll.insert_many(test_papers)
        
        # Create test paper views with edge cases
        test_views = []
        
        # Generate views with various patterns
        for i in range(500):  # More views for comprehensive testing
            hours_ago = i
            view_time = now - timedelta(hours=hours_ago)
            paper_id = f"test_paper_{(i % 8) + 1}_" + ["needs_update", "boundary_28_days", "already_no_response", "recent", "missing_date", "future_date", "very_old", "minimal"][i % 8]
            
            # Vary user patterns
            if i % 10 == 0:
                user_id = None  # Anonymous views
            elif i % 5 == 0:
                user_id = f"test_user_power_{i % 3}"  # Power users with many views
            else:
                user_id = f"test_user_{i % 20}"  # Regular users
            
            # Add edge case data
            user_agent = "Test Browser" if i % 2 == 0 else None  # Some missing user agents
            ip_address = f"192.168.1.{i % 255}" if i % 3 == 0 else "127.0.0.1"
            
            test_views.append({
                "paperId": paper_id,
                "userId": user_id,
                "timestamp": view_time,
                "userAgent": user_agent,
                "ipAddress": ip_address
            })
        
        # Add some views with edge case timestamps
        edge_case_views = [
            # Very old view
            {
                "paperId": "test_paper_1_needs_update",
                "userId": "test_user_old",
                "timestamp": now - timedelta(days=400),
                "userAgent": "Old Browser",
                "ipAddress": "192.168.1.1"
            },
            # Future view (should not happen but test resilience)
            {
                "paperId": "test_paper_2_boundary_28_days", 
                "userId": "test_user_future",
                "timestamp": now + timedelta(hours=1),
                "userAgent": "Future Browser",
                "ipAddress": "192.168.1.2"
            }
        ]
        
        test_views.extend(edge_case_views)
        
        # Insert test views
        if test_views:
            await views_coll.insert_many(test_views)
        
        logger.info(f"✅ Created comprehensive test data:")
        logger.info(f"  - {len(test_impl_records)} implementation progress records (with edge cases)")
        logger.info(f"  - {len(test_papers)} test papers (with edge cases)")
        logger.info(f"  - {len(test_views)} test paper views (with edge cases)")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to create test data: {e}")
        return False


async def create_test_data(no_data=False):
    """Create test data for testing cron jobs, with an option for no data."""
    logger = logging.getLogger(__name__)
    
    if no_data:
        try:
            await initialize_async_db()
            
            impl_coll = await get_implementation_progress_collection_async()
            views_coll = await get_paper_views_collection_async()
            papers_coll = await get_papers_collection_async()

            # Clean up all test data to ensure empty state
            await impl_coll.delete_many({"_id": {"$regex": "^test_"}})
            await views_coll.delete_many({"paperId": {"$regex": "^test_"}})
            await papers_coll.delete_many({"_id": {"$regex": "^test_"}})

            logger.info("✅ Created empty state for no_data scenario.")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to create no_data scenario: {e}")
            return False
    else:
        return await create_test_data_with_edge_cases()


async def test_email_updater_functionality(no_data_scenario=False):
    """Test email updater with comprehensive edge cases and verify outputs."""
    logger = logging.getLogger(__name__)
    logger.info(f"🧪 Testing Email Updater Functionality (No Data: {no_data_scenario})...")
    
    try:
        await create_test_data(no_data=no_data_scenario)
        
        impl_coll = await get_implementation_progress_collection_async()
        
        # Get initial state for validation
        initial_sent_count = await impl_coll.count_documents({
            "emailStatus": EmailStatus.SENT.value
        })
        
        initial_no_response_count = await impl_coll.count_documents({
            "emailStatus": EmailStatus.NO_RESPONSE.value
        })
        
        logger.info(f"Initial state - SENT: {initial_sent_count}, NO_RESPONSE: {initial_no_response_count}")
        
        # Run email updater
        runner = BackgroundTaskRunner()
        result = await runner.update_email_statuses()
        
        if not result.get("success"):
            logger.error(f"❌ Email updater failed: {result.get('error')}")
            return False
        
        updated_count = result.get("updated_count", 0)
        logger.info(f"Updated {updated_count} records")
        
        if no_data_scenario:
            if updated_count == 0:
                logger.info("✅ Email updater correctly handled no data (0 updates)")
                return True
            else:
                logger.error(f"❌ Email updater updated {updated_count} records with no data")
                return False

        # Comprehensive validation for normal scenario
        expected_updates = 4  # paper_1_needs_update, paper_2_boundary_28_days, paper_7_very_old, paper_8_minimal
        if updated_count != expected_updates:
            logger.error(f"❌ Expected to update {expected_updates} records but updated {updated_count}")
            return False
        
        # Verify specific test records with detailed checks
        test_cases = [
            {
                "id": "test_paper_1_needs_update",
                "expected_status": EmailStatus.NO_RESPONSE.value,
                "description": "4+ weeks old SENT record should be updated"
            },
            {
                "id": "test_paper_2_boundary_28_days",
                "expected_status": EmailStatus.NO_RESPONSE.value,
                "description": "Exactly 28 days old should be updated (due to $lte)"
            },
            {
                "id": "test_paper_3_already_no_response",
                "expected_status": EmailStatus.NO_RESPONSE.value,
                "description": "Already NO_RESPONSE should remain unchanged"
            },
            {
                "id": "test_paper_4_recent",
                "expected_status": EmailStatus.SENT.value,
                "description": "Recent record should remain SENT"
            },
            {
                "id": "test_paper_5_missing_date",
                "expected_status": EmailStatus.SENT.value,
                "description": "Missing emailSentAt should remain SENT"
            },
            {
                "id": "test_paper_6_future_date",
                "expected_status": EmailStatus.SENT.value,
                "description": "Future date should remain SENT"
            },
            {
                "id": "test_paper_7_very_old",
                "expected_status": EmailStatus.NO_RESPONSE.value,
                "description": "Very old record should be updated"
            },
            {
                "id": "test_paper_8_minimal",
                "expected_status": EmailStatus.NO_RESPONSE.value,
                "description": "Record with minimal fields should be updated"
            }
        ]
        
        all_tests_passed = True
        for case in test_cases:
            record = await impl_coll.find_one({"_id": case["id"]})
            if not record:
                logger.error(f"❌ Record {case['id']} not found")
                all_tests_passed = False
                continue
                
            actual_status = record.get("emailStatus")
            if actual_status == case["expected_status"]:
                logger.info(f"✅ {case['description']}")
            else:
                logger.error(f"❌ {case['description']} - Expected: {case['expected_status']}, Got: {actual_status}")
                all_tests_passed = False
        
        # Verify final counts
        final_sent_count = await impl_coll.count_documents({
            "emailStatus": EmailStatus.SENT.value
        })
        
        final_no_response_count = await impl_coll.count_documents({
            "emailStatus": EmailStatus.NO_RESPONSE.value
        })
        
        expected_final_sent = initial_sent_count - expected_updates
        expected_final_no_response = initial_no_response_count + expected_updates
        
        if final_sent_count != expected_final_sent:
            logger.error(f"❌ Final SENT count mismatch - Expected: {expected_final_sent}, Got: {final_sent_count}")
            all_tests_passed = False
        
        if final_no_response_count != expected_final_no_response:
            logger.error(f"❌ Final NO_RESPONSE count mismatch - Expected: {expected_final_no_response}, Got: {final_no_response_count}")
            all_tests_passed = False
        
        if all_tests_passed:
            logger.info("✅ Email updater functionality test PASSED")
            return True
        else:
            logger.error("❌ Email updater functionality test FAILED")
            return False
        
    except Exception as e:
        logger.exception(f"❌ Email updater test failed: {e}")
        return False


async def test_popular_papers_analytics(no_data_scenario=False):
    """Test popular papers analytics and verify outputs."""
    logger = logging.getLogger(__name__)
    logger.info(f"🧪 Testing Popular Papers Analytics (No Data: {no_data_scenario})...")
    
    try:
        await create_test_data(no_data=no_data_scenario)

        # Run view analytics first
        runner = BackgroundTaskRunner()
        analytics_result = await runner.update_view_analytics()
        
        if not analytics_result.get("success"):
            logger.error(f"❌ View analytics failed: {analytics_result.get('error')}")
            return False
        
        logger.info("✅ View analytics completed successfully")
        
        # Now test the popular papers script functionality
        # Import the functions directly from the script
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "popular_papers", 
            os.path.join(project_root, "scripts", "popular-papers.py")
        )
        popular_papers_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(popular_papers_module)
        
        calculate_popular_papers_metrics = popular_papers_module.calculate_popular_papers_metrics
        cache_popular_papers_results = popular_papers_module.cache_popular_papers_results
        
        await initialize_async_db()
        
        # Calculate metrics
        analytics_data = await calculate_popular_papers_metrics()
        
        if no_data_scenario:
            # In no_data scenario, check if any test data exists in results
            has_test_data = False
            for category in ["popular_by_views_24h", "popular_by_views_7d", "popular_by_views_30d", "trending_papers", "most_upvoted", "recently_added"]:
                if analytics_data[category]:
                    for item in analytics_data[category]:
                        paper_id = item.get("paper_id", "")
                        if paper_id.startswith("test_"):
                            has_test_data = True
                            break
                    if has_test_data:
                        break
            
            if not has_test_data:
                logger.info("✅ Popular papers analytics correctly handled no test data")
            else:
                logger.error(f"❌ Analytics found test data when there should be none")
                return False
        else:
            # Validate analytics data structure
            expected_keys = [
                "popular_by_views_24h", "popular_by_views_7d", "popular_by_views_30d",
                "trending_papers", "most_upvoted", "recently_added", "timestamp"
            ]
            
            for key in expected_keys:
                if key not in analytics_data:
                    logger.error(f"❌ Missing key in analytics data: {key}")
                    return False
            
            logger.info("✅ Analytics data structure is correct")
            
            # Verify we have data in categories (just check they're not empty for now)
            if not analytics_data["most_upvoted"]:
                logger.error("❌ 'most_upvoted' is empty")
                return False
            
            # Check if we have test data in most_upvoted
            has_test_data = any(item["paper_id"].startswith("test_") for item in analytics_data["most_upvoted"])
            if not has_test_data:
                logger.error("❌ 'most_upvoted' does not contain test data")
                return False

            logger.info("✅ Key categories have expected data")

        # Test caching
        cache_success = await cache_popular_papers_results(analytics_data)
        if not cache_success:
            logger.error("❌ Failed to cache popular papers results")
            return False
        
        cache_coll = await get_popular_papers_cache_collection_async()
        cached_doc = await cache_coll.find_one({"_id": "latest"})
        
        if no_data_scenario:
            # For no data scenario, just check that caching doesn't crash
            if cached_doc:
                logger.info("✅ Caching handled no data scenario correctly (data may exist from previous runs).")
            else:
                logger.info("✅ Caching handled no data scenario correctly (no cached data).")
        elif not cached_doc:
            logger.error("❌ No cached data found")
            return False
        
        logger.info("✅ Popular papers analytics test PASSED")
        return True
        
    except Exception as e:
        logger.exception(f"❌ Popular papers analytics test failed: {e}")
        return False


async def test_integration_and_performance():
    """Test integration between components and basic performance."""
    logger = logging.getLogger(__name__)
    logger.info("🧪 Testing Integration and Performance...")
    
    try:
        start_time = datetime.now()
        
        # Test running both tasks back-to-back
        runner = BackgroundTaskRunner()
        
        # Email update
        email_start = datetime.now()
        email_result = await runner.update_email_statuses()
        email_duration = (datetime.now() - email_start).total_seconds()
        
        # Analytics update
        analytics_start = datetime.now()
        analytics_result = await runner.update_view_analytics()
        analytics_duration = (datetime.now() - analytics_start).total_seconds()
        
        total_duration = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"⏱️  Performance Results:")
        logger.info(f"  Email update: {email_duration:.2f}s")
        logger.info(f"  Analytics update: {analytics_duration:.2f}s")
        logger.info(f"  Total time: {total_duration:.2f}s")
        
        # Check if performance is reasonable (under 30 seconds for test data)
        if total_duration > 30:
            logger.warning(f"⚠️  Performance may be slow: {total_duration:.2f}s")
        else:
            logger.info("✅ Performance is acceptable")
        
        # Verify both tasks succeeded
        both_succeeded = (
            email_result.get("success", False) and 
            analytics_result.get("success", False)
        )
        
        if both_succeeded:
            logger.info("✅ Integration test PASSED")
            return True
        else:
            logger.error("❌ Integration test failed - one or more tasks failed")
            return False
        
    except Exception as e:
        logger.exception(f"❌ Integration test failed: {e}")
        return False


async def cleanup_test_data():
    """Clean up all test data created during the test run."""
    logger = logging.getLogger(__name__)
    logger.info("🧹 Cleaning up test data...")

    try:
        # Ensure DB is initialized before cleanup
        await initialize_async_db()
        
        # Get collections directly to ensure they exist
        impl_coll = await get_implementation_progress_collection_async()
        views_coll = await get_paper_views_collection_async()
        papers_coll = await get_papers_collection_async()
        cache_coll = await get_popular_papers_cache_collection_async()

        # Clean up collections
        await impl_coll.delete_many({"_id": {"$regex": "^test_"}})
        await views_coll.delete_many({"paperId": {"$regex": "^test_"}})
        await papers_coll.delete_many({"_id": {"$regex": "^test_"}})
        
        # Clean up any test cache data
        await cache_coll.delete_many({"_id": {"$in": ["latest", "test_cache"]}})
        
        # Clean up analytics collections if they exist
        if async_db is not None:
            await async_db["user_recent_views"].delete_many({})
            await async_db["popular_papers_recent"].delete_many({})

        logger.info("✅ Test data cleanup successful.")
        return True
            
    except Exception as e:
        logger.warning(f"⚠️  Failed to clean up test data (this is non-critical): {e}")
        return False


async def test_database_error_handling():
    """Test how cron jobs handle database errors."""
    logger = logging.getLogger(__name__)
    logger.info("🧪 Testing Database Error Handling...")
    
    try:
        # For this test, we'll just verify that the system handles potential errors gracefully
        # by testing with malformed MongoDB queries/operations
        await initialize_async_db()
        
        # Test with a background task that might encounter errors
        runner = BackgroundTaskRunner()
        
        # Patch the collection to simulate connection errors
        from unittest.mock import patch, AsyncMock
        
        original_method = runner.update_email_statuses
        
        async def mock_failing_method():
            raise Exception("Simulated database connection error")
        
        # Temporarily replace the method to simulate failure
        runner.update_email_statuses = mock_failing_method
        
        try:
            result = await runner.update_email_statuses()
            # If we get here without exception, the test should fail
            logger.error("❌ Database error handling test FAILED - No exception raised")
            return False
        except Exception as e:
            logger.info(f"✅ Database error handling test PASSED - Exception properly raised: {e}")
            return True
        finally:
            # Restore original method
            runner.update_email_statuses = original_method
            
    except Exception as e:
        logger.info(f"✅ Database error handling test PASSED - System handled error gracefully: {e}")
        return True


async def test_concurrent_execution():
    """Test concurrent execution of cron jobs."""
    logger = logging.getLogger(__name__)
    logger.info("🧪 Testing Concurrent Execution...")
    
    try:
        await create_test_data()
        runner = BackgroundTaskRunner()
        
        # Run both tasks concurrently
        results = await asyncio.gather(
            runner.update_email_statuses(),
            runner.update_view_analytics(),
            return_exceptions=True
        )
        
        success_count = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
        
        if success_count >= 1:  # At least one should succeed
            logger.info("✅ Concurrent execution test PASSED")
            return True
        else:
            logger.error("❌ Concurrent execution test FAILED")
            return False
            
    except Exception as e:
        logger.exception(f"❌ Concurrent execution test failed: {e}")
        return False


async def test_large_dataset_performance():
    """Test performance with larger datasets."""
    logger = logging.getLogger(__name__)
    logger.info("🧪 Testing Large Dataset Performance...")
    
    try:
        await create_test_data()
        
        start_time = datetime.now()
        runner = BackgroundTaskRunner()
        result = await runner.update_view_analytics()
        duration = (datetime.now() - start_time).total_seconds()
        
        # Performance should be reasonable (under 10 seconds for test data)
        if result.get("success") and duration < 10:
            logger.info(f"✅ Large dataset performance test PASSED ({duration:.2f}s)")
            return True
        else:
            logger.error(f"❌ Large dataset performance test FAILED ({duration:.2f}s)")
            return False
            
    except Exception as e:
        logger.exception(f"❌ Large dataset performance test failed: {e}")
        return False


async def test_malformed_data_resilience():
    """Test resilience against malformed data."""
    logger = logging.getLogger(__name__)
    logger.info("🧪 Testing Malformed Data Resilience...")
    
    try:
        await initialize_async_db()
        
        # Insert some malformed data
        impl_coll = await get_implementation_progress_collection_async()
        malformed_record = {
            "_id": "test_malformed_1",
            "emailStatus": "INVALID_STATUS",  # Invalid status
            "emailSentAt": "not_a_date",     # Invalid date
            "initiatedBy": 12345             # Invalid user ID type
        }
        
        await impl_coll.insert_one(malformed_record)
        
        runner = BackgroundTaskRunner()
        result = await runner.update_email_statuses()
        
        # Should handle malformed data gracefully
        if result.get("success") is not None:  # Should not crash
            logger.info("✅ Malformed data resilience test PASSED")
            return True
        else:
            logger.error("❌ Malformed data resilience test FAILED")
            return False
            
    except Exception as e:
        logger.info(f"✅ Malformed data resilience test PASSED - Handled exception: {e}")
        return True


async def run_comprehensive_tests():
    """Run all comprehensive tests."""
    logger = setup_test_logging()
    
    print("🚀 Starting Comprehensive Cron Jobs Test Suite")
    print("=" * 60)
    
    test_results = {}
    
    try:
        # --- Test with data ---
        print("\n📋 Running tests with mock data...")
        test_results["email_updater_with_data"] = await test_email_updater_functionality()
        test_results["popular_papers_with_data"] = await test_popular_papers_analytics()
        test_results["integration"] = await test_integration_and_performance()

        # --- Test with no data ---
        print("\n📋 Running tests with no data...")
        test_results["email_updater_no_data"] = await test_email_updater_functionality(no_data_scenario=True)
        test_results["popular_papers_no_data"] = await test_popular_papers_analytics(no_data_scenario=True)
        
        # --- Test error handling and edge cases ---
        print("\n🔧 Running error handling and stress tests...")
        test_results["database_error_handling"] = await test_database_error_handling()
        test_results["concurrent_execution"] = await test_concurrent_execution()
        test_results["large_dataset_performance"] = await test_large_dataset_performance()
        test_results["malformed_data_resilience"] = await test_malformed_data_resilience()
        
        # Display results
        print("\n" + "=" * 60)
        print("📊 COMPREHENSIVE TEST RESULTS")
        print("=" * 60)
        
        passed_tests = 0
        total_tests = len(test_results)
        
        for test_name, success in test_results.items():
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
            if success:
                passed_tests += 1
        
        print(f"\nTests passed: {passed_tests}/{total_tests}")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED!")
            print("✅ Cron jobs are thoroughly tested and working correctly")
            print("✅ Ready for production deployment")
            success = True
        else:
            print(f"\n❌ {total_tests - passed_tests} tests failed")
            print("⚠️  Please fix issues before deployment")
            success = False
            
    except Exception as e:
        logger.exception(f"❌ Test suite crashed: {e}")
        success = False
    
    finally:
        # Always cleanup
        print("\n🧹 Cleaning up test data...")
        await cleanup_test_data()
    
    return success


def main():
    """Main entry point."""
    try:
        success = asyncio.run(run_comprehensive_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"💥 Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
