#!/usr/bin/env python3
"""
Email Status Updater Cron Job

This script updates email statuses for implementation progress records.
It's designed to run as a cron job and integrates with the existing
background tasks system in papers2code_app2.

Usage:
- As a standalone script: python email-updater.py
- As a cron job: */6 * * * * /usr/bin/python3 /path/to/email-updater.py
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timezone

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

from papers2code_app2.background_tasks import BackgroundTaskRunner
from papers2code_app2.database import initialize_async_db


def setup_logging():
    """Configure logging for the cron job."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            # Optional: Add file handler for persistent logs
            # logging.FileHandler('/var/log/papers2code/email-updater.log')
        ]
    )
    
    return logging.getLogger(__name__)


async def run_email_update():
    """Run the email status update task."""
    logger = setup_logging()
    
    try:
        logger.info("Starting email status update cron job...")
        
        # Initialize database connection
        await initialize_async_db()
        
        # Create background task runner and execute email update
        runner = BackgroundTaskRunner()
        result = await runner.update_email_statuses()
        
        if result.get("success"):
            logger.info(
                f"Email update completed successfully. "
                f"Updated: {result.get('updated_count', 0)}, "
                f"Errors: {len(result.get('errors', []))}"
            )
            
            # Log any errors that occurred
            for error in result.get('errors', []):
                logger.warning(f"Update error: {error}")
                
        else:
            logger.error(f"Email update failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Critical error in email updater cron job: {e}", exc_info=True)
        sys.exit(1)


def main():
    """Main entry point for the cron job."""
    try:
        asyncio.run(run_email_update())
    except KeyboardInterrupt:
        print("Email updater interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
