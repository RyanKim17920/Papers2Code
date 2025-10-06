# Security Architecture

## Overview

This document provides a technical overview of the security architecture for Papers2Code, demonstrating how the application maintains security while being fully open source.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTERNET (PUBLIC)                             │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  GitHub Repository (Open Source)                           │     │
│  │  • Source code                                             │     │
│  │  • Security logic                                          │     │
│  │  • Documentation                                           │     │
│  │  • No secrets                                              │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT BOUNDARY                               │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  Platform (Render/Railway/Vercel)                         │     │
│  │  • Environment variables (secrets)                         │     │
│  │  • HTTPS/TLS termination                                   │     │
│  │  • DDoS protection                                         │     │
│  │  • CDN/Edge caching                                        │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                                 │
│                                                                       │
│  ┌──────────────────┐              ┌──────────────────┐             │
│  │   Frontend       │              │    Backend       │             │
│  │   (React/Vite)   │◄────────────►│   (FastAPI)     │             │
│  │                  │   HTTPS      │                  │             │
│  │  • Static files  │   CORS       │  • REST API      │             │
│  │  • Client logic  │   CSRF       │  • Auth logic    │             │
│  │  • UI components │              │  • Business      │             │
│  └──────────────────┘              │    logic         │             │
│                                     └──────────────────┘             │
│                                              ↓                        │
│                                     ┌──────────────────┐             │
│                                     │   Database       │             │
│                                     │   (MongoDB)      │             │
│                                     │                  │             │
│                                     │  • Encrypted     │             │
│                                     │  • Authenticated │             │
│                                     │  • Network       │             │
│                                     │    restricted    │             │
│                                     └──────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

## Security Layers

### Layer 1: Transport Security

**Technology**: HTTPS/TLS 1.3
**Purpose**: Encrypt all data in transit

```
Client ──(HTTPS)──> Load Balancer ──(HTTPS)──> Backend
          TLS 1.3                     TLS 1.3
```

**Implementation**:
- Automatic HTTPS redirect in production
- Strict Transport Security (HSTS) headers
- TLS certificate management by platform

### Layer 2: Origin Control (CORS)

**Technology**: Cross-Origin Resource Sharing
**Purpose**: Restrict which domains can make requests

```python
# main.py
origins = [
    "http://localhost:5173",    # Dev
    "https://your-domain.com",  # Prod (from FRONTEND_URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRFToken", "Authorization"],
)
```

**Protection**: Prevents unauthorized domains from calling your API

### Layer 3: Request Validation (CSRF)

**Technology**: Custom CSRF middleware
**Purpose**: Prevent cross-site request forgery

```
1. Client requests CSRF token: GET /api/auth/csrf-token
2. Server generates token: secrets.token_hex(16)
3. Server sets cookie: Set-Cookie: csrftoken=abc123
4. Server responds: {"csrfToken": "abc123"}
5. Client sends both in state-changing requests:
   - Cookie: csrftoken=abc123
   - Header: X-CSRFToken: abc123
6. Server validates match: cookie == header
```

**Implementation**:
```python
class CSRFProtectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            cookie = request.cookies.get("csrftoken")
            header = request.headers.get("X-CSRFToken")
            if cookie != header:
                raise HTTPException(403, "CSRF token mismatch")
        return await call_next(request)
```

### Layer 4: Rate Limiting

**Technology**: SlowAPI
**Purpose**: Prevent abuse and DoS attacks

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/papers")
@limiter.limit("100/minute")
async def list_papers():
    ...
```

**Limits**:
- General endpoints: 100 requests/minute
- Auth endpoints: 10 requests/minute
- Search: 50 requests/minute

### Layer 5: Authentication

**Technology**: OAuth 2.0 + JWT
**Purpose**: Verify user identity

```
GitHub OAuth Flow:
┌──────┐                                      ┌─────────┐
│Client│                                      │ Backend │
└──┬───┘                                      └────┬────┘
   │ 1. Request login                              │
   │────────────────────────────────────────────>  │
   │                                                │
   │ 2. Redirect to GitHub                         │
   │ <──────────────────────────────────────────── │
   │                                                │
   │ 3. User authorizes                            │
   │────(GitHub)─────────────────────────────────> │
   │                                                │
   │ 4. GitHub callback with code                  │
   │────────────────────────────────────────────>  │
   │                                                │
   │             5. Exchange code for token        │
   │                    (Backend → GitHub)         │
   │                                                │
   │ 6. Create JWT tokens & set cookies            │
   │ <──────────────────────────────────────────── │
   │                                                │
   │ 7. Authenticated requests with JWT            │
   │────────────────────────────────────────────>  │
```

**JWT Structure**:
```json
{
  "sub": "user_id",
  "username": "github_username",
  "role": "user",
  "exp": 1234567890,
  "token_type": "access"
}
```

**Signed with**: `FLASK_SECRET_KEY` (environment variable)

### Layer 6: Session Security

**Technology**: HTTP-only cookies
**Purpose**: Prevent XSS token theft

```python
response.set_cookie(
    key="access_token",
    value=token,
    httponly=True,      # JavaScript cannot access
    secure=True,        # HTTPS only
    samesite="lax",     # CSRF protection
    max_age=1800,       # 30 minutes
)
```

**Protection**:
- JavaScript cannot access tokens (XSS protection)
- Cookies only sent over HTTPS (man-in-the-middle protection)
- SameSite prevents cross-site cookie sending

### Layer 7: Input Validation

**Technology**: Pydantic models
**Purpose**: Prevent injection and malformed data

```python
from pydantic import BaseModel, validator

class PaperCreate(BaseModel):
    title: str
    abstract: str
    arxiv_id: str
    
    @validator('arxiv_id')
    def validate_arxiv_id(cls, v):
        # Strict format validation
        if not re.match(r'^\d{4}\.\d{4,5}$', v):
            raise ValueError('Invalid arXiv ID format')
        return v
```

**Benefits**:
- Type safety
- Automatic validation
- Prevents injection attacks
- Clear error messages

### Layer 8: Query Safety

**Technology**: Motor (async MongoDB) with parameterization
**Purpose**: Prevent NoSQL injection

```python
# ❌ UNSAFE - concatenation
db.papers.find({"title": user_input})

# ✅ SAFE - parameterized
db.papers.find({"title": {"$regex": user_input, "$options": "i"}})

# ✅ SAFE - Pydantic validation first
validated_data = PaperQuery(**request_data)
db.papers.find(validated_data.dict())
```

### Layer 9: Security Headers

**Technology**: Custom middleware
**Purpose**: Browser-level protections

```python
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers.update({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        "Content-Security-Policy": "default-src 'self'; ..."
    })
    return response
```

**Headers Explained**:
| Header | Purpose |
|--------|---------|
| `X-Content-Type-Options` | Prevent MIME sniffing |
| `X-Frame-Options` | Prevent clickjacking |
| `X-XSS-Protection` | Enable browser XSS filter |
| `Referrer-Policy` | Control referrer information |
| `Permissions-Policy` | Restrict browser features |
| `Content-Security-Policy` | Control resource loading |

### Layer 10: Secret Management

**Technology**: Environment variables
**Purpose**: Separate code from configuration

```
┌─────────────────────────────────────────────────────────────┐
│  Secrets Management Architecture                            │
│                                                               │
│  ┌───────────────┐         ┌───────────────┐                │
│  │  Code (Public)│         │ Secrets (🔒)  │                │
│  │               │         │               │                │
│  │  config_      │         │  Platform     │                │
│  │  settings.    │◄────────│  Environment  │                │
│  │  FLASK_       │ Runtime │  Variables    │                │
│  │  SECRET_KEY   │  Load   │               │                │
│  │               │         │  FLASK_       │                │
│  │  if not set:  │         │  SECRET_KEY=  │                │
│  │    raise      │         │  abc123...    │                │
│  │    Error      │         │               │                │
│  └───────────────┘         └───────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:
```python
# shared.py
class AppSettings(BaseSettings):
    FLASK_SECRET_KEY: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    MONGO_CONNECTION_STRING: Optional[str] = None
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False
    )

config_settings = AppSettings()

# Validate critical secrets
if not config_settings.FLASK_SECRET_KEY:
    raise RuntimeError("FLASK_SECRET_KEY not configured!")
```

## Data Flow: Authenticated Request

```
1. User Request
   ┌──────────────────────────────────────┐
   │ POST /api/papers                     │
   │ Headers:                             │
   │   X-CSRFToken: abc123                │
   │   Cookie: access_token=jwt123        │
   │         csrftoken=abc123             │
   │ Body: {"title": "Paper Title"}       │
   └──────────────────────────────────────┘
                  ↓
2. HTTPS/TLS Decryption (Platform)
                  ↓
3. CORS Check
   ✓ Origin: https://your-frontend.com
   ✓ Allowed in origins list
                  ↓
4. Rate Limiting
   ✓ Client IP: 10 requests in last minute
   ✓ Under 100/minute limit
                  ↓
5. CSRF Validation
   ✓ Cookie csrftoken: abc123
   ✓ Header X-CSRFToken: abc123
   ✓ Match confirmed
                  ↓
6. JWT Validation
   ✓ Cookie access_token present
   ✓ Decode JWT: payload = jwt.decode(token, SECRET_KEY)
   ✓ Signature valid
   ✓ Not expired
   ✓ Extract user_id from payload
                  ↓
7. Input Validation
   ✓ Parse body with Pydantic: PaperCreate(**body)
   ✓ Type checking passed
   ✓ Custom validators passed
                  ↓
8. Database Query (Parameterized)
   db.papers.insert_one({
       "title": validated_data.title,
       "author_id": user_id,
       "created_at": datetime.utcnow()
   })
                  ↓
9. Response with Security Headers
   ┌──────────────────────────────────────┐
   │ 201 Created                          │
   │ Headers:                             │
   │   X-Content-Type-Options: nosniff    │
   │   X-Frame-Options: DENY              │
   │   Content-Security-Policy: ...       │
   │ Body: {"id": "123", "title": "..."}  │
   └──────────────────────────────────────┘
```

## Security Boundary Isolation

### Deployment Isolation

Each deployment is completely isolated:

```
┌──────────────────────────────────────────────────────────────┐
│  Instance 1 (Production)                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Secrets:                                               │  │
│  │ • JWT Secret: a1b2c3...                                │  │
│  │ • Database: prod.mongodb.net/papers_prod               │  │
│  │ • OAuth: prod-app (callback: prod.com)                 │  │
│  │ • Domain: papers2code.com                              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
          ↓ No connection ↓
┌──────────────────────────────────────────────────────────────┐
│  Instance 2 (Staging)                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Secrets:                                               │  │
│  │ • JWT Secret: x9y8z7...                                │  │
│  │ • Database: staging.mongodb.net/papers_staging         │  │
│  │ • OAuth: staging-app (callback: staging.com)           │  │
│  │ • Domain: staging.papers2code.com                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
          ↓ No connection ↓
┌──────────────────────────────────────────────────────────────┐
│  Instance 3 (Development)                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Secrets:                                               │  │
│  │ • JWT Secret: dev123...                                │  │
│  │ • Database: localhost:27017/papers_dev                 │  │
│  │ • OAuth: dev-app (callback: localhost:5173)            │  │
│  │ • Domain: localhost:5173                               │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Key Point**: Compromising one instance does NOT affect others because:
- Different JWT signing keys (can't forge tokens)
- Different databases (can't access data)
- Different OAuth apps (can't hijack auth)
- Different domains (DNS-based trust)

## Attack Scenarios & Defenses

### Scenario 1: Attacker Studies Public Code

**Attacker Actions**:
1. Clones GitHub repository
2. Analyzes authentication logic
3. Identifies JWT structure and algorithm (HS256)
4. Finds database query patterns

**Cannot Do**:
- ❌ Sign valid JWTs (needs `FLASK_SECRET_KEY`)
- ❌ Access database (needs `MONGO_CONNECTION_STRING`)
- ❌ Use OAuth flow (needs `GITHUB_CLIENT_SECRET`)
- ❌ Bypass security layers (all enforced server-side)

**Defense**: Secret separation

### Scenario 2: Attacker Attempts JWT Forgery

**Attacker Actions**:
1. Captures JWT from network (even over HTTPS, if compromised client)
2. Decodes JWT to see payload structure
3. Attempts to create new JWT with admin role

**Cannot Do**:
- ❌ Sign JWT without `FLASK_SECRET_KEY`
- ❌ Modify existing JWT (signature verification fails)
- ❌ Brute-force secret (256-bit entropy = 2^256 combinations)

**Defense**: Cryptographic signing with secret key

### Scenario 3: Attacker Attempts CSRF

**Attacker Actions**:
1. Creates malicious site: evil.com
2. Tricks user into visiting while logged into papers2code.com
3. Evil site sends POST request to papers2code.com/api/papers

**Cannot Do**:
- ❌ CORS blocks cross-origin requests
- ❌ Even if CORS passes (shouldn't), CSRF token missing
- ❌ Cookie sent but header not (SameSite protection)

**Defense**: CORS + CSRF + SameSite cookies

### Scenario 4: Attacker Attempts NoSQL Injection

**Attacker Actions**:
1. Sends crafted input: `{"title": {"$ne": null}}`
2. Attempts to extract all papers

**Cannot Do**:
- ❌ Pydantic validation rejects invalid types
- ❌ Parameterized queries prevent injection
- ❌ Input sanitization catches malicious patterns

**Defense**: Input validation + parameterized queries

## Monitoring & Incident Response

### Security Monitoring

```python
# Example logging for security events
@app.middleware("http")
async def security_logging(request, call_next):
    if request.method in ("POST", "PUT", "DELETE"):
        logger.info(f"State-changing request: {request.method} {request.url.path}")
        logger.info(f"Client: {request.client.host}")
        logger.info(f"User-Agent: {request.headers.get('user-agent')}")
    
    response = await call_next(request)
    
    if response.status_code >= 400:
        logger.warning(f"Failed request: {response.status_code}")
    
    return response
```

### Alert Triggers

Monitor for:
- Multiple failed authentication attempts (> 5 in 5 minutes)
- Rate limit violations (> 100 requests/minute)
- CSRF validation failures
- Invalid JWT tokens
- Suspicious query patterns
- Unusual database queries

### Incident Response Plan

1. **Detection**: Monitoring alerts trigger
2. **Assessment**: Review logs and determine severity
3. **Containment**: 
   - Rotate compromised secrets
   - Block malicious IPs
   - Disable affected accounts
4. **Eradication**: Fix vulnerability
5. **Recovery**: Deploy patch, restore services
6. **Lessons Learned**: Update documentation and security measures

## Security Audit Checklist

Before deployment:

- [ ] All secrets in environment variables
- [ ] No hardcoded credentials in code
- [ ] HTTPS enabled in production
- [ ] CORS configured with proper origins
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Security headers set
- [ ] JWT expiration times reasonable
- [ ] Database authentication enabled
- [ ] MongoDB network restrictions configured
- [ ] Input validation with Pydantic
- [ ] Parameterized database queries
- [ ] Logging configured for security events
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies up to date
- [ ] Security scanning enabled (GitHub/GitGuardian)

## Conclusion

Papers2Code demonstrates that **open source and security are not mutually exclusive**. By following security best practices:

1. **Separation of Concerns**: Code (public) vs Configuration (private)
2. **Defense in Depth**: 10+ independent security layers
3. **Cryptographic Security**: Secrets, signing, encryption
4. **Platform Security**: HTTPS, DDoS protection, infrastructure
5. **Community Security**: Open code allows security reviews

The result is a production-ready application that benefits from open-source transparency while maintaining robust security posture.

## Further Reading

- [OPENSOURCE_SECURITY.md](OPENSOURCE_SECURITY.md) - Open source security principles
- [SECURITY.md](SECURITY.md) - Complete security guidelines  
- [SECURITY_QUICK_START.md](SECURITY_QUICK_START.md) - Quick setup guide
- [.env.example](.env.example) - Configuration template

---

**Security through design, not obscurity.** 🔐
