#!/usr/bin/env python3
"""
Test Script for Cron Jobs

This script tests the cron job functionality to ensure they work properly
before deploying to production.

Usage: python test.py
"""

import os
import sys
import asyncio
import logging

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

from papers2code_app2.background_tasks import BackgroundTaskRunner
from papers2code_app2.database import initialize_async_db


async def test_email_updater():
    """Test the email status update functionality."""
    print("Testing email updater...")
    try:
        await initialize_async_db()
        runner = BackgroundTaskRunner()
        result = await runner.update_email_statuses()
        
        print(f"✓ Email updater test result: {result}")
        return True
    except Exception as e:
        print(f"✗ Email updater test failed: {e}")
        return False


async def test_view_analytics():
    """Test the view analytics functionality."""
    print("Testing view analytics...")
    try:
        runner = BackgroundTaskRunner()
        result = await runner.update_view_analytics()
        
        print(f"✓ View analytics test result: {result}")
        return True
    except Exception as e:
        print(f"✗ View analytics test failed: {e}")
        return False


async def test_database_connection():
    """Test database connection."""
    print("Testing database connection...")
    try:
        await initialize_async_db()
        print("✓ Database connection successful")
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False


async def run_all_tests():
    """Run all cron job tests."""
    print("=" * 50)
    print("CRON JOBS TEST SUITE")
    print("=" * 50)
    
    tests = [
        ("Database Connection", test_database_connection),
        ("Email Updater", test_email_updater),
        ("View Analytics", test_view_analytics),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n🧪 Running {test_name} test...")
        try:
            success = await test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"✗ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 50)
    print("TEST RESULTS SUMMARY")
    print("=" * 50)
    
    passed = 0
    for test_name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{test_name}: {status}")
        if success:
            passed += 1
    
    print(f"\nTests passed: {passed}/{len(results)}")
    
    if passed == len(results):
        print("🎉 All tests passed! Cron jobs are ready for deployment.")
        return True
    else:
        print("❌ Some tests failed. Please fix issues before deployment.")
        return False


def main():
    """Main entry point for the test script."""
    try:
        success = asyncio.run(run_all_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nTests interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error during testing: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()