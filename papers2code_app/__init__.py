import traceback
import logging
from flask import Flask, jsonify, request, session  # Import session
from flask_wtf.csrf import generate_csrf, CSRFError  # Import CSRFError
from pymongo import DESCENDING
from pymongo.errors import OperationFailure

from .config import Config
from .extensions import cors, limiter, csrf, talisman, mongo
from .papers import papers_bp
from .auth import auth_bp
from .models import get_papers_collection, get_users_collection, get_removed_papers_collection, get_user_actions_collection

def create_app(config_class=Config):
    """Application Factory Function"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # --- Logging Setup (Basic) ---
    if not app.debug:
        # In production, you might want more robust logging
        pass  # Add production logging handler if needed
    else:
        # Development logging
        logging.basicConfig(level=logging.INFO)  # Log INFO level and above
        app.logger.setLevel(logging.INFO)

    app.config['WTF_CSRF_HEADER_NAME'] = 'X-CSRFToken'

    # Initialize extensions
    cors.init_app(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}}, supports_credentials=True)
    limiter.init_app(app)
    csrf.init_app(app)
    talisman.init_app(
        app,
        content_security_policy={
            'default-src': '\'self\'',  # Default to only allow content from own origin
            'script-src': [
                '\'self\'',
                # Add any other domains/hashes needed for your frontend scripts
                # e.g., 'https://cdn.jsdelivr.net/...'
                # If using inline scripts/styles, consider using nonces (requires talisman config)
                # or hashes ('sha256-...')
            ],
            'style-src': [
                '\'self\'',
                '\'unsafe-inline\'',  # Often needed for UI libraries, but try to avoid
                # Add other style sources if needed
            ],
            'img-src': [
                '\'self\'',
                'data:',  # Allow data URIs if used
                'https://avatars.githubusercontent.com',  # Allow GitHub avatars
                # Add other image sources if needed
            ],
            'connect-src': [
                '\'self\'',  # Allow connections to own origin (API calls)
                # Add other domains if your frontend connects elsewhere
            ],
            # Add other directives like font-src, frame-src as needed
        },
        content_security_policy_nonce_in=['script-src'],  # Keep if using nonces
        force_https=False  # Set to True in production behind a proxy handling HTTPS
    )
    # Initialize PyMongo – ensure your URI string ends up including the 'papers2code' db
    mongo.init_app(app, uri=Config.MONGO_URI)

    # If your URI did NOT already include “/papers2code” at the end, you can pick it explicitly:
    mongo.db = mongo.cx.get_database("papers2code")

    # --- Add before_request handler for session/CSRF debugging ---
    @app.before_request
    def log_request_info():
        # Log session contents and CSRF token from header for relevant requests
        if request.path.startswith('/api/') and request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
            csrf_token_header = request.headers.get(app.config.get('WTF_CSRF_HEADER_NAME', 'X-CSRFToken'))
            app.logger.info(f"Session before request ({request.method} {request.path}): {dict(session)}")
            app.logger.info(f"CSRF Token from Header ({app.config.get('WTF_CSRF_HEADER_NAME')}): {csrf_token_header}")

    # Register blueprints
    app.register_blueprint(papers_bp)
    app.register_blueprint(auth_bp)

    # --- Add endpoint to get CSRF token ---
    @app.route('/api/csrf-token', methods=['GET'])
    def get_csrf_token():
        token = generate_csrf()
        # --- Add logging after generating token --- 
        app.logger.info(f"Generated CSRF token: {token}")
        app.logger.info(f"Session after generating CSRF token: {dict(session)}")
        # --- End logging --- 
        response = jsonify(csrfToken=token)
        return response

    # --- MongoDB Indexing (within app context) ---
    with app.app_context():
        try:
            print("Ensuring MongoDB indexes...")
            papers_collection = get_papers_collection()
            users_collection = get_users_collection()
            removed_papers_collection = get_removed_papers_collection()
            user_actions_collection = get_user_actions_collection()

            print("Existing indexes fetched (variables removed as unused).")

            # --- Define and Ensure Indexes ---
            index_definitions = {
                papers_collection: [
                    # Atlas Search index is managed via Atlas UI/API, not here.
                    # Regular indexes:
                    (("pwc_url", 1), {"name": "pwc_url_1", "unique": True, "background": True}),
                    (("publication_date", DESCENDING), {"name": "publication_date_-1", "background": True}),
                    (("upvoteCount", DESCENDING), {"name": "upvoteCount_-1", "background": True, "sparse": True}),
                    # Add other necessary indexes for papers
                ],
                users_collection: [
                    (("githubId", 1), {"name": "githubId_1", "unique": True, "background": True}),
                ],
                removed_papers_collection: [
                    (("removedAt", DESCENDING), {"name": "removedAt_-1", "background": True}),
                    (("original_pwc_url", 1), {"name": "original_pwc_url_1", "background": True}),
                ],
                user_actions_collection: [
                    ((["userId", 1], ["paperId", 1], ["actionType", 1]), {"name": "userId_1_paperId_1_actionType_1", "unique": True, "background": True}),
                    (("paperId", 1), {"name": "paperId_1", "background": True}),
                    # Add other necessary indexes for user actions
                ]
            }

            for collection, indexes in index_definitions.items():
                existing_indexes = collection.index_information()
                for keys, options in indexes:
                    index_name = options['name']
                    if index_name not in existing_indexes:
                        print(f"Creating index '{index_name}' on collection '{collection.name}'...")
                        collection.create_index(keys, **options)
                        print(f"Index '{index_name}' created.")
                    else:
                        print(f"Index '{index_name}' exists on collection '{collection.name}'.")

            # Check Atlas Search index (informational)
            try:
                # Example: Check if a basic search works (adjust query as needed)
                # This doesn't *create* the index, just verifies connectivity/basic function
                list(papers_collection.aggregate([{"$search": {"index": "default", "text": {"query": "test", "path": "title"}}}, {"$limit": 1}]))
                print("Atlas Search index 'default' seems accessible.")
            except OperationFailure as search_err:
                if "index not found" in str(search_err).lower():
                    print("Warning: Atlas Search index 'default' not found or not configured correctly.")
                else:
                    print(f"Warning: Could not verify Atlas Search index 'default': {search_err}")

            print("Index check complete.")
            # Ping DB
            mongo.cx.admin.command('ping')
            print("Pinged MongoDB deployment. Connection successful.")

        except Exception as e:
            print(f"Error during MongoDB initialization or indexing: {e}")
            traceback.print_exc()
            # Decide if the app should exit or continue with a warning
            # exit(1) # Uncomment to force exit on DB connection/indexing error

    # --- Custom Error Handler for CSRF Errors ---
    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        # Log the error and relevant request info
        csrf_token_header = request.headers.get(app.config.get('WTF_CSRF_HEADER_NAME', 'X-CSRFToken'))
        app.logger.error(f"CSRF Error: {e.description}. Request Path: {request.path}. Method: {request.method}")
        app.logger.error(f"Session during CSRF Error: {dict(session)}")
        app.logger.error(f"Headers during CSRF Error: {request.headers}")
        app.logger.error(f"CSRF Token from Header during Error: {csrf_token_header}")
        return jsonify(error="CSRF validation failed", description=str(e.description)), 400

    # --- Custom Error Handler for Rate Limits ---
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify(error="Rate limit exceeded", description=str(e.description)), 429

    # --- Optional: Generic Error Handler ---
    @app.errorhandler(Exception)
    def handle_exception(e):
        # Log the error
        traceback.print_exc()
        # Return a generic error response
        # Avoid exposing internal details in production
        response = jsonify(error="An internal server error occurred")
        response.status_code = 500
        # If it's an HTTPException, use its code
        if isinstance(e, (OperationFailure,)):  # Example specific exceptions
            response.status_code = 503  # Service Unavailable for DB issues
        elif hasattr(e, 'code'):
            response.status_code = e.code
        return response

    return app
