"""
Standalone task runner for production environments (e.g., Render Cron Jobs).
This script initializes the application environment and runs a specified background task.
"""
import asyncio
import argparse
import logging
import os
import sys

# Ensure the app's root directory is in the Python path
# This allows us to import modules from the 'papers2code_app2' package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from papers2code_app2.background_tasks import BackgroundTaskRunner
    from papers2code_app2.database import initialize_async_db, close_async_db
except ImportError as e:
    print(f"CRITICAL: Failed to import required modules: {e}", file=sys.stderr)
    print("Please ensure the script is run from the project root or the path is set correctly.", file=sys.stderr)
    sys.exit(1)

# --- Basic Logger Setup ---
# Setup a basic logger to see output from the cron job
log_level = os.environ.get("APP_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("task_runner")

async def main():
    """
    Parses command-line arguments and runs the specified task.
    """
    parser = argparse.ArgumentParser(description="Run a specific background task.")
    parser.add_argument(
        "task_name",
        type=str,
        choices=["update_email_statuses", "update_view_analytics"],
        help="The name of the task to run."
    )
    args = parser.parse_args()

    logger.info(f"Task runner started for task: '{args.task_name}'")

    # --- Database Connection ---
    try:
        await initialize_async_db()
        logger.info("Database connection initialized.")
    except Exception as e:
        logger.critical(f"Failed to initialize database connection: {e}", exc_info=True)
        sys.exit(1)

    # --- Task Execution ---
    runner = BackgroundTaskRunner()
    task_to_run = getattr(runner, args.task_name, None)

    if not task_to_run or not callable(task_to_run):
        logger.error(f"Task '{args.task_name}' is not a valid, callable method on BackgroundTaskRunner.")
        sys.exit(1)

    try:
        logger.info(f"Executing task: '{args.task_name}'...")
        result = await task_to_run()
        logger.info(f"Task '{args.task_name}' completed successfully.")
        logger.info(f"Result: {result}")
    except Exception as e:
        logger.critical(f"An error occurred during task execution: {e}", exc_info=True)
    finally:
        # --- Database Shutdown ---
        await close_async_db()
        logger.info("Database connection closed.")
        logger.info("Task runner finished.")


if __name__ == "__main__":
    # Ensure a clean event loop for running the async main function
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Task runner interrupted. Exiting.") 