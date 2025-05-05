import os
from papers2code_app import create_app # Import the factory function

# Load environment variables (optional here if loaded in Config, but good practice)
from dotenv import load_dotenv
load_dotenv()

app = create_app() # Create the Flask app instance

if __name__ == '__main__':
    # Use Waitress as the production WSGI server (like in app_old.py)
    from waitress import serve
    host = os.getenv('FLASK_RUN_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_RUN_PORT', 5000))
    print(f"Starting server with Waitress on http://{host}:{port}")
    serve(app, host=host, port=port)

    # Alternatively, for development use Flask's built-in server:
    # debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ['true', '1', 't']
    # app.run(host=host, port=port, debug=debug_mode)