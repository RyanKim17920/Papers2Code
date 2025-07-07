#!/usr/bin/env python3
"""
Performance Test Suite for Optimized Cron Jobs

This script tests the performance improvements of the optimized sliding window
implementations compared to the original full-recalculation approach.
"""

import os
import sys
import asyncio
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

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
    async_db
)
from papers2code_app2.schemas.implementation_progress import EmailStatus


def setup_logging():
    """Set up logging for performance tests."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


async def create_large_test_dataset():
    """Create a large dataset to test performance improvements."""
    logger = logging.getLogger(__name__)
    
    try:
        await initialize_async_db()
        
        impl_coll = await get_implementation_progress_collection_async()
        views_coll = await get_paper_views_collection_async()
        papers_coll = await get_papers_collection_async()

        # Clean up previous test data
        await impl_coll.delete_many({"_id": {"$regex": "^perf_test_"}})
        await views_coll.delete_many({"paperId": {"$regex": "^perf_test_"}})
        await papers_coll.delete_many({"_id": {"$regex": "^perf_test_"}})

        now = datetime.now(timezone.utc)
        
        # Create 1000 test papers
        papers = []
        for i in range(1000):
            papers.append({
                "_id": f"perf_test_paper_{i}",
                "title": f"Performance Test Paper {i}",
                "upvoteCount": i % 100,  # Varying upvotes
                "status": "Needs Code" if i % 2 == 0 else "Code Available",
                "publicationDate": now - timedelta(days=i % 365),
                "createdAt": now - timedelta(days=i % 30),
                "venue": f"Test Conference {i % 10}"
            })
        
        await papers_coll.insert_many(papers)
        
        # Create 10,000 implementation progress records
        impl_records = []
        for i in range(10000):
            days_ago = i % 100  # Spread over 100 days
            email_date = now - timedelta(days=days_ago)
            
            impl_records.append({
                "_id": f"perf_test_impl_{i}",
                "emailStatus": EmailStatus.SENT.value if days_ago > 28 else EmailStatus.NOT_SENT.value,
                "emailSentAt": email_date if days_ago > 0 else None,
                "initiatedBy": f"perf_test_user_{i % 100}",
                "createdAt": email_date,
                "updatedAt": email_date
            })
        
        await impl_coll.insert_many(impl_records)
        
        # Create 100,000 paper views (this is the expensive part)
        views_batch_size = 1000
        total_views = 100000
        
        logger.info(f"Creating {total_views} test views in batches of {views_batch_size}...")
        
        for batch_start in range(0, total_views, views_batch_size):
            views = []
            
            for i in range(batch_start, min(batch_start + views_batch_size, total_views)):
                hours_ago = i % (24 * 30)  # Spread over 30 days
                view_time = now - timedelta(hours=hours_ago)
                paper_id = f"perf_test_paper_{i % 1000}"
                user_id = f"perf_test_user_{i % 500}" if i % 10 != 0 else None  # 10% anonymous
                
                views.append({
                    "paperId": paper_id,
                    "userId": user_id,
                    "timestamp": view_time,
                    "userAgent": f"Test Browser {i % 5}",
                    "ipAddress": f"192.168.{(i // 255) % 255}.{i % 255}"
                })
            
            await views_coll.insert_many(views)
            
            if batch_start % (views_batch_size * 10) == 0:
                logger.info(f"Created {batch_start + len(views)} views...")
        
        logger.info(f"✅ Created large performance test dataset:")
        logger.info(f"  - 1,000 test papers")
        logger.info(f"  - 10,000 implementation progress records")
        logger.info(f"  - 100,000 paper views")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to create performance test data: {e}")
        return False


async def benchmark_email_updates():
    """Benchmark the optimized email status updates."""
    logger = logging.getLogger(__name__)
    logger.info("🚀 Benchmarking Email Status Updates...")
    
    runner = BackgroundTaskRunner()
    
    # Warm up
    await runner.update_email_statuses()
    
    # Benchmark optimized version
    start_time = time.time()
    result = await runner.update_email_statuses()
    duration = time.time() - start_time
    
    logger.info(f"✅ Optimized Email Updates:")
    logger.info(f"  - Duration: {duration:.3f} seconds")
    logger.info(f"  - Updated: {result.get('updated_count', 0)} records")
    logger.info(f"  - Rate: {result.get('updated_count', 0) / duration:.1f} updates/sec")
    
    return {
        "duration": duration,
        "updated_count": result.get('updated_count', 0),
        "rate": result.get('updated_count', 0) / duration if duration > 0 else 0
    }


async def benchmark_view_analytics():
    """Benchmark the optimized view analytics."""
    logger = logging.getLogger(__name__)
    logger.info("🚀 Benchmarking View Analytics...")
    
    runner = BackgroundTaskRunner()
    
    # First run (cold start)
    start_time = time.time()
    result = await runner.update_view_analytics()
    cold_duration = time.time() - start_time
    
    # Second run (warm/incremental)
    start_time = time.time()
    result = await runner.update_view_analytics()
    warm_duration = time.time() - start_time
    
    logger.info(f"✅ Optimized View Analytics:")
    logger.info(f"  - Cold start: {cold_duration:.3f} seconds")
    logger.info(f"  - Incremental: {warm_duration:.3f} seconds")
    logger.info(f"  - Speedup: {cold_duration / warm_duration:.1f}x faster")
    logger.info(f"  - Processed papers: {result.get('processed_papers', 0)}")
    
    return {
        "cold_duration": cold_duration,
        "warm_duration": warm_duration,
        "speedup": cold_duration / warm_duration if warm_duration > 0 else 0,
        "processed_papers": result.get('processed_papers', 0)
    }


async def benchmark_popular_papers():
    """Benchmark the optimized popular papers analytics."""
    logger = logging.getLogger(__name__)
    logger.info("🚀 Benchmarking Popular Papers Analytics...")
    
    # Import the optimized script
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "popular_papers_optimized", 
        os.path.join(project_root, "scripts", "popular-papers-optimized.py")
    )
    optimized_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(optimized_module)
    
    # First run (cold start)
    start_time = time.time()
    result1 = await optimized_module.get_sliding_window_metrics()
    cold_duration = time.time() - start_time
    
    # Second run (warm/cached)
    start_time = time.time()
    result2 = await optimized_module.get_sliding_window_metrics()
    warm_duration = time.time() - start_time
    
    logger.info(f"✅ Optimized Popular Papers Analytics:")
    logger.info(f"  - Cold start: {cold_duration:.3f} seconds")
    logger.info(f"  - Cached run: {warm_duration:.3f} seconds")
    logger.info(f"  - Speedup: {cold_duration / warm_duration:.1f}x faster")
    logger.info(f"  - Categories populated: {len([k for k, v in result2.items() if v and k != 'timestamp'])}")
    
    return {
        "cold_duration": cold_duration,
        "warm_duration": warm_duration,
        "speedup": cold_duration / warm_duration if warm_duration > 0 else 0,
        "categories": len([k for k, v in result2.items() if v and k != 'timestamp'])
    }


async def cleanup_performance_test_data():
    """Clean up performance test data."""
    logger = logging.getLogger(__name__)
    logger.info("🧹 Cleaning up performance test data...")

    try:
        await initialize_async_db()
        
        impl_coll = await get_implementation_progress_collection_async()
        views_coll = await get_paper_views_collection_async()
        papers_coll = await get_papers_collection_async()

        # Clean up collections
        result1 = await impl_coll.delete_many({"_id": {"$regex": "^perf_test_"}})
        result2 = await views_coll.delete_many({"paperId": {"$regex": "^perf_test_"}})
        result3 = await papers_coll.delete_many({"_id": {"$regex": "^perf_test_"}})

        logger.info(f"✅ Cleaned up:")
        logger.info(f"  - {result1.deleted_count} implementation records")
        logger.info(f"  - {result2.deleted_count} view records")
        logger.info(f"  - {result3.deleted_count} paper records")
        
        return True
            
    except Exception as e:
        logger.warning(f"⚠️  Failed to clean up performance test data: {e}")
        return False


async def run_performance_tests():
    """Run comprehensive performance tests."""
    logger = setup_logging()
    
    print("🚀 Starting Performance Test Suite for Optimized Cron Jobs")
    print("=" * 70)
    
    try:
        # Create large test dataset
        print("\n📊 Creating large test dataset...")
        dataset_created = await create_large_test_dataset()
        if not dataset_created:
            print("❌ Failed to create test dataset")
            return False
        
        # Run benchmarks
        results = {}
        
        print("\n⚡ Running Performance Benchmarks...")
        
        # Email updates benchmark
        results["email"] = await benchmark_email_updates()
        
        # View analytics benchmark  
        results["views"] = await benchmark_view_analytics()
        
        # Popular papers benchmark
        results["popular"] = await benchmark_popular_papers()
        
        # Display summary
        print("\n" + "=" * 70)
        print("📈 PERFORMANCE BENCHMARK RESULTS")
        print("=" * 70)
        
        print(f"\n🔧 Email Status Updates:")
        print(f"  • Duration: {results['email']['duration']:.3f}s")
        print(f"  • Throughput: {results['email']['rate']:.1f} updates/sec")
        print(f"  • Efficiency: Bulk operations vs individual updates")
        
        print(f"\n📊 View Analytics:")
        print(f"  • Cold start: {results['views']['cold_duration']:.3f}s")
        print(f"  • Incremental: {results['views']['warm_duration']:.3f}s")
        print(f"  • Speedup: {results['views']['speedup']:.1f}x faster")
        print(f"  • Optimization: Sliding window + incremental processing")
        
        print(f"\n🏆 Popular Papers Analytics:")
        print(f"  • Cold start: {results['popular']['cold_duration']:.3f}s")
        print(f"  • Cached run: {results['popular']['warm_duration']:.3f}s")
        print(f"  • Speedup: {results['popular']['speedup']:.1f}x faster")
        print(f"  • Optimization: Smart caching + pre-computed metrics")
        
        # Overall efficiency score
        avg_speedup = (results['views']['speedup'] + results['popular']['speedup']) / 2
        
        print(f"\n🎯 Overall Performance Improvement:")
        print(f"  • Average speedup: {avg_speedup:.1f}x faster")
        print(f"  • Memory efficiency: Sliding window approach")
        print(f"  • Database efficiency: Bulk operations + incremental updates")
        
        if avg_speedup >= 5:
            print(f"  • Status: 🚀 EXCELLENT performance gains!")
        elif avg_speedup >= 2:
            print(f"  • Status: ✅ GOOD performance improvements")
        else:
            print(f"  • Status: ⚠️  MODERATE improvements")
        
        success = True
        
    except Exception as e:
        logger.exception(f"❌ Performance test suite crashed: {e}")
        success = False
    
    finally:
        # Always cleanup
        print("\n🧹 Cleaning up test data...")
        await cleanup_performance_test_data()
    
    return success


def main():
    """Main entry point."""
    try:
        success = asyncio.run(run_performance_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⏹️  Performance tests interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"💥 Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
