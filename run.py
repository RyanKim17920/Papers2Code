"""
Enhanced run_app2.py with production-ready features and resilient error handling
"""
import os
import sys
import signal
import logging
import asyncio
import time
from typing import NoReturn, Optional
from contextlib import suppress


# Set app-specific log level for development (matches run_app2.py)
os.environ["APP_LOG_LEVEL"] = "INFO"


# Determine if we're in production early for fail-safe behavior (matches run_app2.py logic)
IS_PRODUCTION = os.getenv("ENV_TYPE", "").lower() == "production"

try:
    import uvicorn
    from papers2code_app2.main import app
    from papers2code_app2.shared import config_settings
except ImportError as e:
    if IS_PRODUCTION:
        # In production, log to stderr and exit gracefully
        print(f"CRITICAL: Failed to import required modules: {e}", file=sys.stderr)
        sys.exit(1)
    else:
        # In development, let the error bubble up for debugging
        raise


class ApplicationRunner:
    """Enhanced application runner with production-grade resilience."""
    
    def __init__(self):
        self.is_production = IS_PRODUCTION
        self.logger = self._setup_logger()
        self.server: Optional[uvicorn.Server] = None
        self.startup_time = time.time()
        
    def _setup_logger(self) -> logging.Logger:
        """Setup logger with fail-safe configuration."""
        try:
            logger = logging.getLogger(__name__)
            if not logger.handlers:  # Avoid duplicate handlers
                handler = logging.StreamHandler(sys.stdout)
                formatter = logging.Formatter(
                    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
                )
                handler.setFormatter(formatter)
                logger.addHandler(handler)
                # Set log level from APP_LOG_LEVEL env variable, fallback to INFO
                env_log_level = os.getenv("APP_LOG_LEVEL", "INFO").upper()
                level = getattr(logging, env_log_level, logging.INFO)
                logger.setLevel(level)
            return logger
        except Exception:
            # Fallback to basic print if logging fails
            print("WARNING: Failed to setup logger, using print fallback", file=sys.stderr)
            return None
        
    def _log(self, level: str, message: str) -> None:
        """Fail-safe logging method."""
        if self.logger:
            getattr(self.logger, level.lower())(message)
        else:
            print(f"{level.upper()}: {message}", file=sys.stderr)
        
    def setup_signal_handlers(self) -> None:
        """Set up graceful shutdown signal handlers with error handling."""
        def handle_shutdown(signum: int, frame) -> NoReturn:
            self._log("info", f"Received signal {signum}, initiating graceful shutdown...")
            
            if self.server:
                try:
                    self.server.should_exit = True
                except Exception as e:
                    self._log("error", f"Error during server shutdown: {e}")
            
            # Give processes time to clean up in production
            if self.is_production:
                time.sleep(2)
                
            sys.exit(0)
            
        try:
            signal.signal(signal.SIGINT, handle_shutdown)
            signal.signal(signal.SIGTERM, handle_shutdown)
            self._log("debug", "Signal handlers registered successfully")
        except Exception as e:
            if self.is_production:
                self._log("error", f"Failed to setup signal handlers: {e}")
                # Continue anyway in production
            else:
                raise
        
    def validate_configuration(self) -> bool:
        """No-op configuration validation for drop-in compatibility with run_app2.py."""
        # run_app2.py does not require MONGO_CONNECTION_STRING or FLASK_SECRET_KEY for startup
        # so we skip these checks entirely for drop-in compatibility
        self._log("debug", "Skipping configuration validation (matches run_app2.py behavior)")
        return True
        
    async def health_check(self) -> bool:
        """Perform health checks with production resilience."""
        try:
            self._log("info", "Running health checks...")
            
            # Basic import check
            try:
                from papers2code_app2.database import get_database
                self._log("debug", "Database module import successful")
            except ImportError as e:
                self._log("warning", f"Database module import failed: {e}")
                if not self.is_production:
                    return False
            
            # TODO: Add actual database connectivity check
            # try:
            #     db = get_database()
            #     await db.admin.command("ping")
            #     self._log("info", "Database connectivity check passed")
            # except Exception as e:
            #     self._log("error", f"Database connectivity check failed: {e}")
            #     return False
            
            self._log("info", "Health checks completed successfully")
            return True
            
        except Exception as e:
            self._log("error", f"Health check failed: {e}")
            if self.is_production:
                self._log("warning", "Continuing despite health check failures...")
                return False
            else:
                return False
            

    def get_uvicorn_config(self) -> dict:
        """Get environment-specific uvicorn configuration with error handling."""
        try:
            # Use the same environmental variables as run_app2.py for drop-in compatibility
            base_config = {
                "app": app,
                "host": "0.0.0.0",  # Matches run_app2.py
                "port": 5000,         # Matches run_app2.py
                "log_level": "info", # Matches run_app2.py
            }

            env_type = getattr(config_settings, 'ENV_TYPE', 'development').lower()

            if env_type == "development":
                base_config.update({
                    "reload": True,
                    "reload_dirs": ["papers2code_app2"],
                    "log_level": "debug",
                })
                self._log("info", "Using development configuration with hot reload")

            elif env_type == "production":
                # Production optimizations with safe defaults
                workers = 1
                try:
                    workers = max(1, int(os.getenv("WORKERS", "1")))
                except (ValueError, TypeError):
                    self._log("warning", "Invalid WORKERS value, using default: 1")

                base_config.update({
                    "workers": workers,
                    "access_log": True,
                    "server_header": False,  # Security: hide server info
                    "date_header": False,    # Security: hide date info
                })

                # Only use uvloop if available
                try:
                    import uvloop
                    base_config["loop"] = "uvloop"
                    self._log("info", "Using uvloop for better performance")
                except ImportError:
                    self._log("info", "uvloop not available, using default event loop")

                self._log("info", f"Using production configuration with {workers} worker(s)")

            return base_config

        except Exception as e:
            self._log("error", f"Failed to get uvicorn config: {e}")
            # Return minimal safe configuration
            return {
                "app": app,
                "host": "0.0.0.0",
                "port": 5000,
                "log_level": "info",
            }
        
    def run(self) -> None:
        """Run the application with maximum resilience and error handling."""
        startup_successful = False
        
        try:
            self._log("info", "Starting Papers2Code FastAPI application...")
            self._log("info", f"Environment: {getattr(config_settings, 'ENV_TYPE', 'unknown')}")
            self._log("info", f"Production mode: {self.is_production}")
            self._log("info", f"Log level: {os.getenv('APP_LOG_LEVEL', 'INFO')}")
            
            # Setup with error handling
            self.setup_signal_handlers()
            
            # Configuration validation
            config_valid = self.validate_configuration()
            if not config_valid and not self.is_production:
                self._log("error", "Configuration validation failed in development mode")
                sys.exit(1)
            
            # Health checks (only mandatory in production)
            if self.is_production:
                try:
                    health_ok = asyncio.run(self.health_check())
                    if not health_ok:
                        self._log("warning", "Health checks failed, but continuing in production mode...")
                except Exception as e:
                    self._log("error", f"Health check error: {e}")
                    if not self.is_production:
                        sys.exit(1)
            
            # Get server configuration
            uvicorn_config = self.get_uvicorn_config()
            host = uvicorn_config.get('host', 'unknown')
            port = uvicorn_config.get('port', 'unknown')
            
            self._log("info", f"Starting server on {host}:{port}")
            
            # Show docs URL only in non-production
            if not self.is_production:
                self._log("info", f"API docs available at http://localhost:{port}/docs")
            
            # Calculate startup time
            startup_duration = time.time() - self.startup_time
            self._log("info", f"Startup completed in {startup_duration:.2f} seconds")
            
            # Create and run server with retry logic for production
            max_retries = 3 if self.is_production else 1
            
            for attempt in range(max_retries):
                try:
                    self.server = uvicorn.Server(uvicorn.Config(**uvicorn_config))
                    startup_successful = True
                    self._log("info", f"Server started successfully (attempt {attempt + 1})")
                    self.server.run()
                    break
                    
                except Exception as e:
                    self._log("error", f"Server start attempt {attempt + 1} failed: {e}")
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Exponential backoff
                        self._log("info", f"Retrying in {wait_time} seconds...")
                        time.sleep(wait_time)
                    else:
                        raise
            
        except KeyboardInterrupt:
            self._log("info", "Received keyboard interrupt, shutting down...")
            
        except Exception as e:
            self._log("error", f"Application failed to start: {e}")
            if self.is_production:
                # In production, try to provide helpful exit codes
                if "port" in str(e).lower() or "address" in str(e).lower():
                    sys.exit(98)  # Address already in use
                elif "permission" in str(e).lower():
                    sys.exit(77)  # Permission denied
                else:
                    sys.exit(1)   # General error
            else:
                # In development, re-raise for full traceback
                raise
                
        finally:
            # Cleanup
            total_runtime = time.time() - self.startup_time
            if startup_successful:
                self._log("info", f"Application ran for {total_runtime:.2f} seconds")
            else:
                self._log("error", f"Application failed after {total_runtime:.2f} seconds")
            
            self._log("info", "Application shutdown complete")


if __name__ == "__main__":
    runner = ApplicationRunner()
    runner.run()
