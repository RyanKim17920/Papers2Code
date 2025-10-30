import os
os.environ["APP_LOG_LEVEL"] = "INFO" # Set app-specific log level for development

from papers2code_app2 import main
import uvicorn
import logging
import sys
import signal

def handle_exit(signum, frame):
    print("Exit signal received, shutting down gracefully...")
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, handle_exit)  # Handles Ctrl+C
    signal.signal(signal.SIGTERM, handle_exit)  # Handles termination signal
    
    # Get port from environment variable (for deployment platforms) or default to 5000
    port = int(os.getenv("PORT", 5000))
    
    try:
        print("Starting Papers2Code FastAPI application...")
        print(f"API will be available at http://localhost:{port}/docs")
        print(f"Application log level set by run_app2.py to: {os.getenv('APP_LOG_LEVEL')}") # Confirm APP_LOG_LEVEL
        print("The application uses FastAPI lifespan events for startup/shutdown handling")
        print("Press Ctrl+C to stop the server and trigger shutdown events")
        # The log_level here controls Uvicorn's server logs, not the application logger defined in main.py
        uvicorn.run(main.app, host="0.0.0.0", port=port, log_level="info")
    except Exception as e:
        logging.error(f"Failed to start application: {e}", exc_info=True)
        sys.exit(1)
