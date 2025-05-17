from fastapi import FastAPI, Request, HTTPException # MODIFIED: Added HTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware # For HSTS
from fastapi.responses import JSONResponse # For custom error handling
import logging # ADDED: Standard Python logging

from .shared import ensure_db_indexes, config_settings # MODIFIED: Added config_settings import
from .routers import users, auth, admin, user_profile, research_fields, conference_series, conferences, proceedings, links, stats

# Import the new specialized paper routers
from .routers import paper_views_router, paper_actions_router, paper_moderation_router

# Initialize Limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"]) # MODIFIED: Using fixed default limits for now

# --- Logging Configuration ---
# Basic configuration for logging. For production, consider structured logging (e.g., JSON),
# more sophisticated handlers (e.g., rotating file handlers, external logging services),
# and configuring log levels via environment variables.

logging.basicConfig(level=logging.INFO) # Set default level to INFO
logger = logging.getLogger("papers2code_fastapi")

# If you want to set a different level for your app's logger specifically:
# logger.setLevel(logging.DEBUG) # Example: Set to DEBUG for more verbose output from your app

# Example of adding a handler for file logging (optional)
# file_handler = logging.FileHandler("papers2code_fastapi.log")
# formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# file_handler.setFormatter(formatter)
# logger.addHandler(file_handler)
# logging.getLogger().addHandler(file_handler) # Optionally add to root logger too

app = FastAPI(
    title="Papers2Code Clone API",
    description="API for a PapersWithCode-like platform, rebuilt with FastAPI.",
    version="0.2.0"
)

# Add middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Security Headers Middleware (Talisman Equivalent) ---
# Note: FastAPI doesn't have a direct Talisman equivalent. We add common headers manually.
# For more complex CSP or other security features, you might explore third-party middleware
# or build more comprehensive custom middleware.

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"

    # Content-Security-Policy: This is a stricter policy.
    # Adjust based on your frontend's specific needs (CDNs, inline scripts/styles if absolutely necessary after build).
    # For Vite in dev, you might need 'unsafe-inline' for styles and 'unsafe-eval' for scripts.
    # This policy is geared towards a production build.
    if config_settings.ENV_TYPE == "production":
        csp_policy = (
            "default-src 'self';"
            "script-src 'self' https://cdnjs.cloudflare.com;" # Example: Allow scripts from self and a specific CDN like cdnjs
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" # Allow self, known safe inline (e.g. for critical CSS), and Google Fonts
            "img-src 'self' data: https://avatars.githubusercontent.com;"
            "font-src 'self' https://fonts.gstatic.com;"
            "connect-src 'self';" # Allow XHR/fetch to own origin. Add other API endpoints if needed.
            "form-action 'self';"
            "frame-ancestors 'none';"
            "base-uri 'self';"
            "object-src 'none';"
            "block-all-mixed-content;" # Prevent loading HTTP assets on HTTPS pages
            "upgrade-insecure-requests;" # Instructs browsers to upgrade HTTP to HTTPS
        )
        response.headers["Content-Security-Policy"] = csp_policy.replace("\\n", "") # Ensure no newlines

        # HTTP Strict Transport Security (HSTS) - Only in production and if HTTPS is enforced
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    else:
        # More permissive CSP for development to allow Vite HMR, etc.
        csp_policy = (
            "default-src 'self' ws://localhost:*/;" # Allow websockets for Vite HMR
            "script-src 'self' 'unsafe-inline' 'unsafe-eval';" # Vite dev needs these
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;"
            "img-src 'self' data: https://avatars.githubusercontent.com;"
            "font-src 'self' https://fonts.gstatic.com;"
            "connect-src 'self' ws://localhost:*/;" # Allow XHR/fetch to own origin and Vite HMR
        )
        response.headers["Content-Security-Policy"] = csp_policy.replace("\\n", "")

    return response

# --- HSTS Middleware (Optional but Recommended for Production) ---
# Only add HTTPSRedirectMiddleware if in production and HTTPS is expected to be handled by the app
if config_settings.ENV_TYPE == "production":
    app.add_middleware(HTTPSRedirectMiddleware) # Uncomment if your app is served over HTTPS directly or X-Forwarded-Proto is set by proxy

# Include routers
# Include the new specialized paper routers
app.include_router(paper_views_router.router)
app.include_router(paper_actions_router.router)
app.include_router(paper_moderation_router.router)

app.include_router(users.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(user_profile.router)
app.include_router(research_fields.router)
app.include_router(conference_series.router)
app.include_router(conferences.router)
app.include_router(proceedings.router)
app.include_router(links.router)
app.include_router(stats.router)

@app.on_event("startup")
async def startup_event():
    logger.info("Application startup: Ensuring database indexes...") # MODIFIED: Use logger
    ensure_db_indexes()
    logger.info("Database index check complete after call in startup_event.") # MODIFIED: Use logger

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Application shutdown.") # MODIFIED: Use logger

# --- Generic Exception Handler ---
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True) # Log the full traceback
    return JSONResponse(
        status_code=500,
        content={
            "message": "An unexpected error occurred on the server.",
            "detail": str(exc) # In production, you might want to hide or simplify this detail.
        },
    )

# --- HTTP Exception Handler (FastAPI's default is usually good, but can be customized) ---
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP Exception: {exc.status_code} {exc.detail} for {request.method} {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "message": "An HTTP error occurred."},
        headers=exc.headers,
    )

@app.get("/")
async def root():
    return {"message": "Welcome to the Papers2Code Clone API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
