from fastapi import FastAPI, Request, HTTPException, APIRouter, status
from fastapi.middleware.cors import CORSMiddleware  # ADDED: For CORS
from fastapi.responses import JSONResponse  # For custom error handling
from pydantic import BaseModel  # ADDED: For type checking in AliasJSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .dependencies import limiter
from .constants import CSRF_TOKEN_COOKIE_NAME, CSRF_TOKEN_HEADER_NAME
import uvicorn
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware  # For HSTS
from starlette.middleware.base import (
    BaseHTTPMiddleware,
    RequestResponseEndpoint,
)  # ADDED
from starlette.responses import Response as StarletteResponse  # ADDED
import logging  # Ensure logging is imported and active
from contextlib import asynccontextmanager  # ADDED: For lifespan event handler
from typing import Optional, Dict

from .database import ensure_db_indexes_async, initialize_sync_db, initialize_async_db
from .shared import config_settings

# from .routers import users, auth, admin, user_profile, research_fields, conference_series, conferences, proceedings, links, stats # Commented out missing routers
from .routers import auth_routes  # Corrected import for auth_routes

# Import the paper routers
from .routers import (
    user_router,
    auth_routes,
    paper_actions_router,
    paper_moderation_router,
    implementation_progress_router,
    paper_views_router,
    activity_router,
    background_tasks_router,
    dashboard_router,
    seo_router,
)


# ADDED: Origin Validation Middleware to restrict API access to frontend only
class OriginValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate that API requests come only from allowed origins.
    This prevents direct public API access and protects against rate limiting/abuse.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> StarletteResponse:
        # Exempt paths that need to be publicly accessible or have external redirects
        exempt_paths = [
            "/",
            "/health",
        ]

        if request.url.path in exempt_paths:
            response = await call_next(request)
            return response

        # For API endpoints, use a more lenient validation approach
        # Only validate origin for sensitive mutation endpoints (POST, PUT, DELETE, PATCH)
        # GET requests and OAuth flows are allowed through
        if request.url.path.startswith("/api/"):
            # In production, only validate origin for state-changing requests
            if config_settings.ENV_TYPE == "production":
                # Allow all GET, HEAD, OPTIONS requests (read-only)
                if request.method in ("GET", "HEAD", "OPTIONS"):
                    response = await call_next(request)
                    return response
                
                # Allow all OAuth-related endpoints (they have external redirects)
                if "/auth/" in request.url.path:
                    response = await call_next(request)
                    return response
                
                # For mutation requests (POST, PUT, DELETE, PATCH), validate origin
                origin = request.headers.get("origin")
                referer = request.headers.get("referer")

                # Check if request has a valid origin or referer from allowed list
                valid_origin = False
                if origin:
                    valid_origin = origin in origins
                elif referer:
                    # Check if referer starts with any allowed origin
                    valid_origin = any(
                        referer.startswith(allowed_origin) for allowed_origin in origins
                    )

                if not valid_origin:
                    logger.warning(
                        f"Blocked API mutation request from unauthorized origin. "
                        f"Path: {request.url.path}, Method: {request.method}, Origin: {origin}, Referer: {referer}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: Invalid origin",
                    )

        response = await call_next(request)
        return response


# ADDED: CSRF Protection Middleware
class CSRFProtectMiddleware(BaseHTTPMiddleware):
    """
    CSRF Protection using Double-Submit Cookie pattern with HttpOnly cookies.
    
    Security Model:
    1. Backend generates CSRF token and sets it as HttpOnly cookie (XSS-safe)
    2. Backend also returns token in response body for frontend to cache in memory
    3. Frontend sends cached token in X-CSRFToken header with each request
    4. Backend validates that HttpOnly cookie value matches X-CSRFToken header
    
    This protects against both CSRF and XSS attacks:
    - CSRF Protection: Attackers can't read cookies from other domains (Same-Origin Policy)
                      and can't set custom headers in simple/cross-origin requests
    - XSS Protection: HttpOnly cookie prevents JavaScript access to the token
                     In-memory storage on frontend (not localStorage) prevents XSS theft
    - Double-Submit: Token must match in both cookie and header
    
    Combined with OriginValidationMiddleware and HttpOnly cookies, this provides
    defense-in-depth security against both CSRF and XSS attacks.
    """
    
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> StarletteResponse:
        # Paths that do not require CSRF protection
        exempt_paths = [
            "/",
            "/health",
            "/api/auth/csrf-token",
            "/api/auth/github/login",
            "/api/auth/github/callback",
            "/api/auth/google/login",
            "/api/auth/google/callback",
            "/redoc",
            "/openapi.json",
        ]
        
        # Exempt patterns for read-only or tracking endpoints
        exempt_patterns = [
            "/api/activity/track",  # Activity tracking (analytics, read-only intent)
            "/mock-idp",  # Exempt all Mock IDP endpoints
        ]
        
        # Check if path matches any exempt pattern
        path_exempt = any(request.url.path.startswith(pattern) for pattern in exempt_patterns)
        
        # Allow GET, HEAD, OPTIONS (safe methods) and exempted paths
        if (
            request.url.path.startswith("/static/")
            or request.url.path in exempt_paths
            or path_exempt
            or request.method in ("GET", "HEAD", "OPTIONS")
        ):
            response = await call_next(request)
            return response

        # For state-changing requests (POST, PUT, DELETE, PATCH), validate CSRF token
        csrf_token_cookie = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)
        csrf_token_header = request.headers.get(CSRF_TOKEN_HEADER_NAME)

        if config_settings.ENV_TYPE != "production":
            logger.debug(
                f"CSRF Validation: {request.method} {request.url.path}"
            )
            logger.debug(
                f"   Cookie: {csrf_token_cookie[:10] + '...' if csrf_token_cookie else 'None'}"
            )
            logger.debug(
                f"   Header: {csrf_token_header[:10] + '...' if csrf_token_header else 'None'}"
            )

        # Validate that both token sources exist and match
        if not csrf_token_header:
            logger.warning(
                f"CSRF validation failed: Missing header. "
                f"Path: {request.method} {request.url.path}, "
                f"Origin: {request.headers.get('origin', 'None')}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing in request header. Please refresh the page and try again.",
            )

        if not csrf_token_cookie:
            logger.warning(
                f"CSRF validation failed: Missing cookie. "
                f"Path: {request.method} {request.url.path}, "
                f"Origin: {request.headers.get('origin', 'None')}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing in cookies. Please refresh the page and try again.",
            )

        if csrf_token_cookie != csrf_token_header:
            logger.warning(
                f"CSRF validation failed: Token mismatch. "
                f"Path: {request.method} {request.url.path}, "
                f"Cookie: {csrf_token_cookie[:10]}..., "
                f"Header: {csrf_token_header[:10]}..."
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token mismatch. Please refresh the page and try again.",
            )

        if config_settings.ENV_TYPE != "production":
            logger.debug(
                f"CSRF validation successful: {request.method} {request.url.path}"
            )
        response = await call_next(request)
        return response


# --- Custom JSON Response class to enforce by_alias=True globally ---
class AliasJSONResponse(JSONResponse):
    def render(self, content: any) -> bytes:
        if isinstance(content, list):
            # Handle lists of Pydantic models
            processed_content = []
            for item in content:
                if isinstance(item, BaseModel):
                    processed_content.append(item.model_dump(by_alias=True))
                else:
                    processed_content.append(item)
            return super().render(processed_content)
        if isinstance(content, BaseModel):
            # Handle single Pydantic models
            return super().render(content.model_dump(by_alias=True))
        return super().render(content)


# --- Logging Configuration ---
# MOVED from shared.py: BasicConfig should ideally be called once, e.g. in main.py
logging.basicConfig(level=logging.INFO)


# Determine log level: use APP_LOG_LEVEL if set, otherwise base on ENV_TYPE
if config_settings.APP_LOG_LEVEL:
    try:
        log_level_str = config_settings.APP_LOG_LEVEL.upper()
        app_log_level = getattr(
            logging, log_level_str
        )  # Convert string to logging level
    except AttributeError:
        app_log_level = logging.DEBUG  # Default to DEBUG if invalid
        _initial_log_level_warning = f"Warning: Invalid APP_LOG_LEVEL '{config_settings.APP_LOG_LEVEL}'. Defaulting to DEBUG."
    else:
        _initial_log_level_warning = None
else:
    app_log_level = (
        logging.DEBUG if config_settings.ENV_TYPE != "production" else logging.INFO
    )
    _initial_log_level_warning = None

# Now that basicConfig is called, we can use loggers.
if _initial_log_level_warning:
    logging.warning(_initial_log_level_warning)  # Log the warning if it was set

# Get the main application package logger and set its level
# This will affect all child loggers like papers2code_app2.shared, papers2code_app2.routers.paper_views_router
app_package_logger = logging.getLogger("papers2code_app2")
app_package_logger.setLevel(
    app_log_level
)  # Explicitly set level for this logger and its children

# Log the effective level being used by the application's root-ish logger
app_package_logger.info(
    f"Logging level for 'papers2code_app2' and its children set to: {logging.getLevelName(app_package_logger.getEffectiveLevel())}"
)
app_package_logger.debug(
    "This is a test DEBUG log from 'papers2code_app2' logger in main.py after explicit level setting."
)

logger = logging.getLogger(
    "papers2code_fastapi"
)  # This is for main.py specific logs, if any.
# Ensure our app's logger also respects the determined level
logger.setLevel(app_log_level)
logger.debug(
    "This is a test DEBUG log from 'papers2code_fastapi' logger in main.py"
)  # Added test debug log


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run before the application starts serving requests
    # logger.info("Application startup: Initializing synchronous database connection...")
    initialize_sync_db()  # ADDED: Initialize sync DB for index creation
    # logger.info("Application startup: Initializing asynchronous database connection...")
    await initialize_async_db()  # ADDED: Initialize async DB for dashboard and other async operations
    # logger.info("Application startup: Ensuring database indexes...")
    await ensure_db_indexes_async()
    # logger.info("Database index check complete during lifespan startup")
    yield
    # Code to run when the application is shutting down
    # logger.info("Application shutdown in lifespan context")


app = FastAPI(
    title="Papers2Code API",
    description="API for Papers2Code platform.",
    version="0.2.0",
    lifespan=lifespan,
    default_response_class=AliasJSONResponse,
    docs_url=None,      # Disabled - not needed
    redoc_url=None,     # Disabled - not needed
    openapi_url=None,   # Disabled - not needed
)

# --- CORS Middleware ---
# Origins that are allowed to make cross-origin requests.

# Initialize origins set
origins_set = set()

# Add localhost origins only in non-production environments
if config_settings.ENV_TYPE != "production":
    origins_set.update({
        "http://localhost:5173",  # Common Vite dev port
        "http://127.0.0.1:5173",
        "http://localhost:3000",  # Common port for React/Next.js dev
        "http://127.0.0.1:3000",
    })

# Add the configured FRONTEND_URL from settings (always included)
if config_settings.FRONTEND_URL:
    origins_set.add(config_settings.FRONTEND_URL)

origins = list(origins_set)  # Convert set to list for CORSMiddleware

# Log the origins being used (ensure logger is configured before this line if used here, it is)
# logger.info(f"Allowed CORS origins: {origins}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # List of origins that are allowed to make cross-origin requests.
    allow_credentials=True,  # Support cookies/authorization headers.
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
        "HEAD",
        "PATCH",
    ],  # Explicitly list allowed methods
    allow_headers=[
        "Content-Type",
        "X-CSRFToken",
        "Authorization",
        "Accept",
        "Access-Control-Allow-Origin",
        "Vary",
    ],  # Added Access-Control-Allow-Origin and Vary
)


# ADDED: Add OriginValidationMiddleware to restrict API access to frontend only
app.add_middleware(OriginValidationMiddleware)

# ADDED: Add CSRFProtectMiddleware after origin validation
app.add_middleware(CSRFProtectMiddleware)

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
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"  # ADDED
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=()"  # ADDED
    )
    response.headers["X-XSS-Protection"] = "1; mode=block"  # ADDED

    # Content-Security-Policy: This is a stricter policy.
    # Adjust based on your frontend's spedcific needs (CDNs, inline scripts/styles if absolutely necessary after build).
    # For Vite in dev, you might need 'unsafe-inline' for styles and 'unsafe-eval' for scripts.
    # This policy is geared towards a production build.
    if config_settings.ENV_TYPE == "production":
        csp_policy = (
            "default-src 'self';"
            "script-src 'self' https://cdnjs.cloudflare.com;"  # Example: Allow scripts from self and a specific CDN like cdnjs
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;"  # Allow self, known safe inline (e.g. for critical CSS), and Google Fonts
            "img-src 'self' data: https://avatars.githubusercontent.com;"
            "font-src 'self' https://fonts.gstatic.com;"
            "connect-src 'self';"  # Allow XHR/fetch to own origin. Add other API endpoints if needed.
            "form-action 'self';"
            "frame-ancestors 'none';"
            "base-uri 'self';"
            "object-src 'none';"
            "block-all-mixed-content;"  # Prevent loading HTTP assets on HTTPS pages
            "upgrade-insecure-requests;"  # Instructs browsers to upgrade HTTP to HTTPS
        )
        response.headers["Content-Security-Policy"] = csp_policy.replace(
            "\\n", ""
        )  # Ensure no newlines

        # HTTP Strict Transport Security (HSTS) - Only in production and if HTTPS is enforced
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
    else:
        # More permissive CSP for development to allow Vite HMR, etc.
        csp_policy = (
            "default-src 'self' ws://localhost:*/;"  # Allow websockets for Vite HMR
            "script-src 'self' 'unsafe-inline' 'unsafe-eval';"  # Vite dev needs these
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;"
            "img-src 'self' data: https://avatars.githubusercontent.com;"
            "font-src 'self' https://fonts.gstatic.com;"
            "connect-src 'self' ws://localhost:*/;"  # Allow XHR/fetch to own origin and Vite HMR
        )
        response.headers["Content-Security-Policy"] = csp_policy.replace("\\n", "")

    return response


# --- HSTS Middleware (Optional but Recommended for Production) ---
# Only add HTTPSRedirectMiddleware if in production and HTTPS is expected to be handled by the app
if config_settings.ENV_TYPE == "production":
    app.add_middleware(
        HTTPSRedirectMiddleware
    )  # Uncomment if your app is served over HTTPS directly or X-Forwarded-Proto is set by proxy

# Include routers
# Create a parent router for /api endpoints
api_router = APIRouter(prefix="/api")

# Include the paper routers into the api_router
api_router.include_router(paper_views_router.router)
api_router.include_router(paper_actions_router.router)
api_router.include_router(paper_moderation_router.router)
api_router.include_router(implementation_progress_router.router)
api_router.include_router(user_router.router)
api_router.include_router(activity_router.router)
api_router.include_router(background_tasks_router.router)
api_router.include_router(dashboard_router.router)
api_router.include_router(seo_router.router)
# Include the auth_routes router into the api_router
api_router.include_router(auth_routes.router)
# Include the api_router into the main app
# Include the api_router into the main app
app.include_router(api_router)

# Include Mock IDP router ONLY in non-production environments (mounted at root /mock-idp)
# SECURITY: Mock IDP provides authentication simulation and must never be exposed in production
if config_settings.ENV_TYPE != "production":
    from .routers import mock_idp_routes
    app.include_router(mock_idp_routes.router)
    logger.info("Mock IDP routes enabled for development environment")
else:
    logger.info("Mock IDP routes disabled in production environment")

# app.include_router(auth_routes.router) # COMMENTED OUT: Moved to api_router

# app.include_router(users.router) # Commented out missing routers
# app.include_router(admin.router) # Commented out missing routers
# app.include_router(user_profile.router) # Commented out missing routers
# app.include_router(research_fields.router) # Commented out missing routers
# app.include_router(conference_series.router) # Commented out missing routers
# app.include_router(conferences.router) # Commented out missing routers
# app.include_router(proceedings.router) # Commented out missing routers
# app.include_router(links.router) # Commented out missing routers
# app.include_router(stats.router) # Commented out missing routers

# Removed deprecated @app.on_event handlers - now using lifespan context manager instead


# --- Helper function for CORS headers in exceptions ---
def _prepare_cors_headers_for_exceptions(
    request: Request, initial_headers: Optional[Dict[str, str]] = None
) -> Dict[str, str]:
    headers = initial_headers.copy() if initial_headers else {}
    request_origin = request.headers.get("origin")

    # 'origins' is the global list defined above
    if request_origin and request_origin in origins:
        headers["Access-Control-Allow-Origin"] = request_origin
        headers["Access-Control-Allow-Credentials"] = (
            "true"  # Matches CORSMiddleware config
        )

        # Add/update Vary header
        existing_vary_values = [
            v.strip() for v in headers.get("Vary", "").split(",") if v.strip()
        ]
        if "Origin" not in existing_vary_values:
            existing_vary_values.append("Origin")
        headers["Vary"] = ", ".join(existing_vary_values)
    return headers


# --- Generic Exception Handler ---
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    response_headers = _prepare_cors_headers_for_exceptions(request)

    return AliasJSONResponse(  # MODIFIED: Use AliasJSONResponse
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
        headers=response_headers,
    )


# --- HTTP Exception Handler ---
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # In production, only log actual errors (5xx) and auth/CSRF failures (403/401)
    # Don't log client errors (4xx) like 404s, 400s as prominently
    should_log = (
        exc.status_code >= 500 or  # Server errors
        exc.status_code == 403 or  # Forbidden (CSRF, auth)
        exc.status_code == 401 or  # Unauthorized
        config_settings.ENV_TYPE != "production"  # Always log in development
    )

    if should_log:
        logger.warning(
            f"HTTP Exception: {exc.status_code} {exc.detail} for {request.method} {request.url.path}"
        )

    response_headers = _prepare_cors_headers_for_exceptions(request, exc.headers)

    return AliasJSONResponse(  # MODIFIED: Use AliasJSONResponse
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=response_headers,
    )


@app.get("/")
async def root():
    return {"message": "Welcome to the Papers2Code API"}


@app.get("/health")
async def health_check():
    """
    Health check endpoint for deployment monitoring (e.g., Render).
    Returns HTTP 200 with status "healthy" when the service is running and database is accessible.
    This endpoint is exempt from CSRF protection and origin validation.

    Checks:
    - Application is running
    - MongoDB connection is healthy (via ping command)
    """
    from .database import async_client, initialize_async_db

    # Check database connectivity
    try:
        if async_client is None:
            await initialize_async_db()

        # Ping MongoDB to verify connection is healthy
        if async_client is not None:
            await async_client.admin.command('ping')
            db_status = "connected"
        else:
            db_status = "not_initialized"
            # Return unhealthy if DB client couldn't be initialized
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"status": "unhealthy", "database": db_status, "error": "Database client not initialized"}
            )
    except Exception as e:
        logger.error(f"Health check failed - database connection error: {e}")
        # Only show detailed errors in development
        error_detail = str(e) if config_settings.ENV_TYPE != "production" else "Database connection failed"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "database": "disconnected", "error": error_detail}
        )

    return {"status": "healthy", "database": db_status}


if __name__ == "__main__":
    # Only enable hot-reload in development
    is_dev = config_settings.ENV_TYPE != "production"
    uvicorn.run("papers2code_app2.main:app", host="0.0.0.0", port=5001, reload=is_dev)
