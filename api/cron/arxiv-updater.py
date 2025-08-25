#!/usr/bin/env python3
"""
ArXiv Data Update Cron Job

This script runs as a cron job to periodically extract new papers from ArXiv
and add them to the database. It replaces the Papers with Code data source
which has been sunsetted.

Usage:
- As a standalone script: python arxiv-updater.py
- As a cron job: 0 */12 * * * /usr/bin/python3 /path/to/arxiv-updater.py

Schedule recommendations:
- Production: Every 12 hours (0 */12 * * *)
- Development: Every 24 hours (0 0 * * *)
- Testing: Every hour (0 * * * *)
"""

import os
import sys
import logging
from datetime import datetime, timezone

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

# Add scripts directory to path for imports
scripts_dir = os.path.join(project_root, 'scripts')
sys.path.insert(0, scripts_dir)

def setup_logging():
    """Configure logging for the cron job."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            # Optional: Add file handler for persistent logs
            # logging.FileHandler('/var/log/papers2code/arxiv-updater.log')
        ]
    )
    
    return logging.getLogger(__name__)

def run_arxiv_update():
    """Run the ArXiv data update."""
    logger = setup_logging()
    
    try:
        logger.info("Starting ArXiv data update cron job...")
        
        # Import and run the update function
        from update_arxiv_data import main_arxiv_update
        
        # Run the update
        main_arxiv_update()
        
        logger.info("ArXiv data update completed successfully")
        
    except ImportError as e:
        logger.error(f"Failed to import ArXiv update script: {e}")
        logger.error("Make sure you're running from the correct directory and dependencies are installed")
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"Critical error in ArXiv updater cron job: {e}", exc_info=True)
        sys.exit(1)

def main():
    """Main entry point for the cron job."""
    try:
        run_arxiv_update()
    except KeyboardInterrupt:
        print("ArXiv updater interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()