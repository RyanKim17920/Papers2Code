# CSRF Protection Implementation

## Overview

Papers2Code implements a robust CSRF (Cross-Site Request Forgery) protection system using a **Double-Submit Cookie pattern with HttpOnly cookies**. This approach provides defense-in-depth security against both CSRF and XSS (Cross-Site Scripting) attacks.

## Security Model

### How It Works

1. **Token Generation**: Backend generates a 256-bit cryptographically secure CSRF token using `secrets.token_hex(32)`

2. **Token Distribution**:
   - Token is set as an **HttpOnly cookie** (prevents JavaScript access → XSS protection)
   - Token is also returned in response body (for X-CSRFToken header)

3. **Token Storage**:
   - **Backend**: Token stored in HttpOnly cookie (browser manages automatically)
   - **Frontend**: Token cached in memory only (NOT in localStorage to prevent XSS theft)

4. **Token Validation**:
   - Frontend sends cached token in `X-CSRFToken` header with each state-changing request
   - Browser automatically sends HttpOnly cookie with same request
   - Backend validates that cookie value matches header value (double-submit)

### Security Guarantees

#### ✅ CSRF Protection
- **Double-Submit Pattern**: Token must match in both cookie and header
- **Same-Origin Policy**: Attackers cannot read cookies from other domains
- **Custom Headers**: Attackers cannot set X-CSRFToken header in simple cross-origin requests
- **Origin Validation**: Additional middleware validates request origin for mutation operations

#### ✅ XSS Protection
- **HttpOnly Cookie**: JavaScript cannot access the cookie value (prevents XSS theft)
- **In-Memory Storage**: Frontend stores token in memory, NOT localStorage (prevents XSS theft)
- **Defense-in-Depth**: Even if XSS occurs, attackers cannot steal the CSRF token

#### ✅ Cross-Domain Support
- **SameSite=None + Secure**: Allows backend (Render) and frontend (Vercel) on different domains
- **CORS Configuration**: Properly configured CORS headers for authorized origins
- **Token in Response Body**: Enables frontend to send token in custom header

## Implementation Details

### Backend (FastAPI)

#### Token Generation (`auth_service.py`)
```python
def generate_csrf_token(self) -> str:
    """
    Generate a cryptographically secure CSRF token.
    Uses 32 bytes (256 bits) for enhanced security.
    """
    return secrets.token_hex(32)
```

#### Token Distribution (`auth_routes.py`)
```python
@router.get("/csrf-token", response_model=CsrfToken)
async def get_csrf_token(request: Request, response: Response):
    csrf_token_value = auth_service.generate_csrf_token()
    
    # Set HttpOnly cookie (XSS-safe)
    response.set_cookie(
        key=CSRF_TOKEN_COOKIE_NAME,
        value=csrf_token_value,
        httponly=True,  # Prevents JavaScript access
        samesite="none" if is_production else "lax",
        secure=True if is_production else False,
        path="/",
        max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    
    # Return in body for X-CSRFToken header
    return {"csrf_token": csrf_token_value}
```

#### Token Validation (`main.py`)
```python
class CSRFProtectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Exempt safe methods (GET, HEAD, OPTIONS)
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)
        
        # For state-changing requests, validate token
        csrf_token_cookie = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)
        csrf_token_header = request.headers.get(CSRF_TOKEN_HEADER_NAME)
        
        # Both must exist and match
        if not csrf_token_header or not csrf_token_cookie:
            raise HTTPException(403, "CSRF token missing")
        
        if csrf_token_cookie != csrf_token_header:
            raise HTTPException(403, "CSRF token mismatch")
        
        return await call_next(request)
```

### Frontend (React/TypeScript)

#### Token Fetching (`auth.ts`)
```typescript
// In-memory storage (XSS-safe)
let csrfTokenCache: string | null = null;

export const fetchAndStoreCsrfToken = async (): Promise<string | null> => {
    const response = await api.get<{ csrfToken: string }>(CSRF_API_ENDPOINT);
    
    if (response.data?.csrfToken) {
        // Store in memory only (NOT localStorage)
        csrfTokenCache = response.data.csrfToken;
        return response.data.csrfToken;
    }
    
    return null;
};

export const getCsrfToken = (): string | null => {
    return csrfTokenCache;
};
```

#### Token Usage (`api.ts`)
```typescript
// Add CSRF token to state-changing requests
api.interceptors.request.use(async (config) => {
    if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            config.headers['X-CSRFToken'] = csrfToken;
        }
    }
    return config;
});
```

## Cross-Domain Configuration

### Development (Same-Domain)
- **Backend**: `http://localhost:5000`
- **Frontend**: `http://localhost:5173`
- **Cookie Settings**: `SameSite=lax, Secure=false`
- **Works because**: Same top-level domain (localhost)

### Production (Cross-Domain)
- **Backend**: `https://your-backend.onrender.com`
- **Frontend**: `https://your-app.vercel.app`
- **Cookie Settings**: `SameSite=none, Secure=true`
- **Required**: HTTPS on both domains for SameSite=None

### Configuration Steps

1. **Backend** (`papers2code_app2/.env`):
```bash
ENV_TYPE=production
FRONTEND_URL=https://your-app.vercel.app
```

2. **Frontend** (`papers2code-ui/.env`):
```bash
VITE_API_BASE_URL=https://your-backend.onrender.com
```

3. **CORS Configuration** (`main.py`):
```python
origins = [
    "https://your-app.vercel.app",
    # Add other authorized origins
]
```

## Best Practices

### ✅ DO
- Always use HTTPS in production (required for SameSite=None)
- Fetch fresh CSRF token on page load
- Store token in memory only (not localStorage)
- Use HttpOnly cookies for token distribution
- Validate origin for state-changing requests
- Rotate tokens on sensitive operations

### ❌ DON'T
- Store CSRF tokens in localStorage (XSS vulnerability)
- Use non-HttpOnly cookies (XSS vulnerability)
- Skip CSRF validation on state-changing endpoints
- Use weak token generation (< 256 bits)
- Allow cross-origin requests without validation

## Testing

### Manual Testing

1. **Start Backend**:
```bash
cd papers2code_app2
uv run uvicorn papers2code_app2.main:app --reload
```

2. **Start Frontend**:
```bash
cd papers2code-ui
npm run dev
```

3. **Test CSRF Protection**:
```bash
python tests/test_csrf_protection.py
```

### Expected Results
- ✅ GET requests work without CSRF token
- ✅ POST requests work with valid CSRF token
- ❌ POST requests fail with invalid/missing CSRF token

## Troubleshooting

### Issue: "CSRF token missing" error

**Cause**: Token not fetched or expired

**Solution**:
1. Check that `fetchAndStoreCsrfToken()` is called on app initialization
2. Verify CSRF token endpoint is accessible: `GET /api/auth/csrf-token`
3. Check browser dev tools → Application → Cookies for `csrf_token_cookie`

### Issue: "CSRF token mismatch" error

**Cause**: Token in header doesn't match cookie

**Solution**:
1. Clear browser cookies and reload page
2. Verify token is not being modified in transit
3. Check for clock skew between client and server

### Issue: Cookies not set in cross-domain setup

**Cause**: SameSite=None requires HTTPS

**Solution**:
1. Ensure both backend and frontend use HTTPS in production
2. Verify `ENV_TYPE=production` is set
3. Check CORS configuration includes your frontend domain
4. Verify `FRONTEND_URL` environment variable is set correctly

## Security Considerations

### Token Strength
- **Current**: 256 bits (32 bytes) using `secrets.token_hex(32)`
- **Industry Standard**: 128-256 bits
- **Rationale**: Higher entropy makes brute-force attacks infeasible

### Token Lifetime
- **Current**: Matches access token expiration (default: 30 minutes)
- **Recommendation**: Rotate on sensitive operations (password change, etc.)
- **Auto-Refresh**: Frontend automatically fetches new token on 403 errors

### Defense-in-Depth
CSRF protection is one layer of defense. Papers2Code also implements:
- Origin validation middleware
- Rate limiting
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options, X-Content-Type-Options headers

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## Version History

- **v1.0** (Current): Double-submit pattern with HttpOnly cookies, in-memory storage
- **v0.9**: Double-submit pattern with localStorage (vulnerable to XSS)
