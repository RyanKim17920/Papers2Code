import os
import logging
from flask import Flask, session, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from dotenv import load_dotenv
from flask import request
import traceback
from bson import ObjectId
from bson.errors import InvalidId

# Import configuration, blueprints, and db setup
from .config import Config
from .db import init_db, get_users_collection, get_db
from .auth.routes import auth_bp
from .papers.routes import papers_bp

# Configure logging
logging.basicConfig(level=logging.INFO)

# Initialize extensions that need to be configured before app creation or globally
csrf = CSRFProtect()
talisman = Talisman()

def create_app():
    """Application factory function."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions
    CORS(app, supports_credentials=True, origins=app.config['CORS_ORIGINS'].split(',') if app.config.get('CORS_ORIGINS') else [])

    # Initialize Limiter only if enabled
    if app.config.get('RATELIMIT_ENABLED', True):
        limiter = Limiter(
            get_remote_address,
            app=app,
            default_limits=app.config.get('RATELIMIT_DEFAULT', '200 per day;50 per hour').split(';'),
            storage_uri=app.config.get('RATELIMIT_STORAGE_URI', 'memory://'),
            strategy=app.config.get('RATELIMIT_STRATEGY', 'fixed-window')
        )
        # Apply limiter to blueprints if needed, or globally as done here
        limiter.limit("100 per minute")(papers_bp) # Example: Apply specific limit to papers_bp
        limiter.limit("60 per minute")(auth_bp)   # Example: Apply specific limit to auth_bp

    # CSRF Protection: Initialize with the app
    csrf.init_app(app)

    # Talisman: Security headers
    csp = None # Keep None for now as in app_old.py, but configure for production
    talisman.init_app(
        app,
        content_security_policy=csp,
        force_https=False # Set to True in production behind a TLS proxy
    )

    # Initialize Database
    try:
        with app.app_context():
            init_db(app) # init_db now handles connection and index creation
    except Exception as e:
        app.logger.error(f"CRITICAL: Failed to initialize database: {e}")

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(papers_bp, url_prefix='/api') # Keep /api prefix

    # Simple root route
    @app.route('/')
    def index():
        return jsonify({"message": "Welcome to the Papers2Code API"})

    # Error Handling
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not Found", "message": str(error)}), 404

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"Server Error: {error}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal Server Error"}), 500

    @app.errorhandler(429)
    def ratelimit_handler(e):
        """Custom JSON response for rate limit exceeded"""
        return jsonify(error="Rate limit exceeded", description=str(e.description)), 429

    # Add a before_request handler to load/validate user from session
    @app.before_request
    def load_validate_user_from_session():
        user_id_str = session.get('user', {}).get('id')
        if user_id_str:
            try:
                user_id_obj = ObjectId(user_id_str)
                users_collection = get_users_collection()
                # --- FIX: Check if collection is not None ---
                if users_collection is not None:
                    # Check if user exists in DB
                    user_doc = users_collection.find_one({"_id": user_id_obj}, {"_id": 1})
                    if not user_doc:
                        app.logger.warning(f"User ID {user_id_str} found in session but not in DB. Clearing session.")
                        session.pop('user', None)
                    # else: User exists, proceed. No need to load full user data on every request unless necessary.
                # --- END FIX ---
                else:
                    # DB not available, log error but don't clear session yet
                    app.logger.error("Cannot validate user session: Users collection not available.")
            except InvalidId:
                app.logger.warning(f"Invalid user ID format in session: {user_id_str}. Clearing session.")
                session.pop('user', None)
            except ConnectionError as ce:
                 app.logger.error(f"Database connection error during user validation: {ce}")
                 # Don't clear session on temporary connection issue
            except Exception as e:
                app.logger.error(f"Error validating user {user_id_str} from session: {e}")
                # Optionally clear session on unexpected errors, or leave it
                # session.pop('user', None)

    app.logger.info("Flask app created and configured.")
    return app