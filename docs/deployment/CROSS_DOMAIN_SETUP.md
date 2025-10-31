# Cross-Domain Deployment Guide (Render Backend + Vercel Frontend)

This guide covers deploying Papers2Code with the backend on Render and frontend on Vercel, ensuring secure CSRF token handling across domains.

## Prerequisites

- Render account for backend hosting
- Vercel account for frontend hosting
- MongoDB Atlas or other cloud MongoDB instance
- GitHub OAuth app configured
- Google OAuth app configured (optional)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User's Browser                       │
│                                                              │
│  ┌────────────────────┐      ┌────────────────────┐        │
│  │   Frontend (SPA)   │──────│  CSRF Token Cache  │        │
│  │  Vercel Hosting    │      │    (In-Memory)     │        │
│  └────────────────────┘      └────────────────────┘        │
│           │                            │                     │
│           │ X-CSRFToken Header         │                     │
│           │ + HttpOnly Cookie          │                     │
│           ▼                            ▼                     │
└───────────┼────────────────────────────┼─────────────────────┘
            │                            │
            │ HTTPS (SameSite=None)      │
            ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Server                        │
│                     Render Hosting                           │
│                                                              │
│  ┌────────────────────┐      ┌────────────────────┐        │
│  │  CSRF Middleware   │──────│  Origin Validation │        │
│  │  (Double-Submit)   │      │    Middleware      │        │
│  └────────────────────┘      └────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Backend Deployment (Render)

### 1.1 Create Render Web Service

1. Log in to [Render](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure service:
   - **Name**: `papers2code-backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install uv && uv sync`
   - **Start Command**: `uv run uvicorn papers2code_app2.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Choose based on your needs (Free tier available)

### 1.2 Configure Environment Variables

Add the following environment variables in Render Dashboard:

#### Essential Variables
```bash
# Environment
ENV_TYPE=production

# Database
MONGO_URI_PROD=mongodb+srv://username:password@cluster.mongodb.net/papers2code
MONGO_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/papers2code

# Security
FLASK_SECRET_KEY=<generate-with-secrets-module>
TOKEN_ENCRYPTION_KEY=<generate-with-fernet>

# Frontend URL (CRITICAL for CSRF)
FRONTEND_URL=https://your-app.vercel.app

# OAuth
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>

# Tokens
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=10080

# Admin
OWNER_GITHUB_USERNAME=<your-github-username>
```

#### Generate Secrets
```bash
# Flask Secret Key
python -c "import secrets; print(secrets.token_hex(32))"

# Fernet Encryption Key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 1.3 Update OAuth Callback URLs

Update your OAuth apps to include Render callback URLs:

**GitHub OAuth** (`https://github.com/settings/developers`):
- Homepage URL: `https://your-app.vercel.app`
- Callback URL: `https://your-backend.onrender.com/api/auth/github/callback`

**Google OAuth** (`https://console.cloud.google.com/apis/credentials`):
- Authorized JavaScript origins: `https://your-app.vercel.app`
- Authorized redirect URIs: `https://your-backend.onrender.com/api/auth/google/callback`

### 1.4 Deploy

Click **"Create Web Service"**. Render will:
1. Clone your repository
2. Install dependencies
3. Start your application
4. Provide a URL: `https://your-backend.onrender.com`

## Step 2: Frontend Deployment (Vercel)

### 2.1 Create Vercel Project

1. Log in to [Vercel](https://vercel.com)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `papers2code-ui`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.2 Configure Environment Variables

Add environment variables in Vercel Dashboard:

```bash
# Backend API URL
VITE_API_BASE_URL=https://your-backend.onrender.com
```

### 2.3 Configure CORS Headers

Create `vercel.json` in the root of your repository:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Credentials",
          "value": "true"
        },
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://your-backend.onrender.com"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-CSRFToken, Content-Type, Authorization"
        }
      ]
    }
  ]
}
```

### 2.4 Deploy

Click **"Deploy"**. Vercel will:
1. Build your frontend
2. Deploy to CDN
3. Provide a URL: `https://your-app.vercel.app`

## Step 3: Configure CSRF for Cross-Domain

### 3.1 Backend Configuration

Ensure `papers2code_app2/main.py` has correct CORS origins:

```python
# Add Vercel frontend URL to allowed origins
origins_set = {
    "https://your-app.vercel.app",  # Production frontend
    # Development origins for local testing
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

if config_settings.FRONTEND_URL:
    origins_set.add(config_settings.FRONTEND_URL)

origins = list(origins_set)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["Content-Type", "X-CSRFToken", "Authorization", "Accept"],
)
```

### 3.2 Verify CSRF Cookie Settings

In `papers2code_app2/routers/auth_routes.py`, ensure production settings:

```python
is_production = config_settings.ENV_TYPE == "production"

response.set_cookie(
    key=CSRF_TOKEN_COOKIE_NAME,
    value=csrf_token_value,
    httponly=True,          # ✅ XSS Protection
    samesite="none",        # ✅ Cross-domain (production)
    secure=True,            # ✅ HTTPS required
    path="/",
    max_age=config_settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
)
```

### 3.3 Frontend Configuration

Verify `papers2code-ui/src/shared/services/auth.ts`:

```typescript
// ✅ Token stored in memory (NOT localStorage)
let csrfTokenCache: string | null = null;

export const getCsrfToken = (): string | null => {
    return csrfTokenCache;
};

export const fetchAndStoreCsrfToken = async (): Promise<string | null> => {
    const response = await api.get<{ csrfToken: string }>(CSRF_API_ENDPOINT);
    if (response.data?.csrfToken) {
        csrfTokenCache = response.data.csrfToken;  // ✅ In-memory only
        return response.data.csrfToken;
    }
    return null;
};
```

## Step 4: Testing Cross-Domain Setup

### 4.1 Test Authentication Flow

1. Visit `https://your-app.vercel.app`
2. Click "Sign in with GitHub" or "Sign in with Google"
3. Complete OAuth flow
4. Verify you're redirected back to your app and logged in

### 4.2 Test CSRF Protection

Use the test script:

```bash
# Update base_url in test script
cd papers2code_app2
python tests/test_csrf_protection.py
```

Expected output:
```
✅ GET requests work without CSRF tokens
✅ POST requests work with valid CSRF tokens
❌ POST requests fail with invalid CSRF tokens
```

### 4.3 Browser DevTools Check

1. Open browser DevTools (F12)
2. Go to **Application** → **Cookies**
3. Select `https://your-backend.onrender.com`
4. Verify cookies:
   - ✅ `csrf_token_cookie` - HttpOnly, Secure, SameSite=None
   - ✅ `access_token_cookie` - HttpOnly, Secure, SameSite=None
   - ✅ `refresh_token` - HttpOnly, Secure, SameSite=None

### 4.4 Test State-Changing Operations

1. **Upvote a paper**
   - Should work without errors
   - Check Network tab for `X-CSRFToken` header
   
2. **Update profile**
   - Should work without errors
   - Verify CSRF token in request headers

3. **Join implementation**
   - Should work without errors
   - Verify proper CSRF validation

## Troubleshooting

### Issue: "CSRF token missing" error

**Symptoms**: All POST/PUT/DELETE requests fail with 403 error

**Causes**:
1. Frontend can't reach backend `/api/auth/csrf-token` endpoint
2. Cookies blocked by browser

**Solutions**:
1. Verify `VITE_API_BASE_URL` is set correctly in Vercel
2. Check browser console for CORS errors
3. Ensure `FRONTEND_URL` is set in Render environment variables
4. Verify both domains use HTTPS

### Issue: Cookies not being set

**Symptoms**: No cookies visible in DevTools, login fails

**Causes**:
1. SameSite=None requires HTTPS (missing Secure flag)
2. Browser blocking third-party cookies
3. CORS misconfiguration

**Solutions**:
1. Verify both backend and frontend use HTTPS (not HTTP)
2. Check CORS configuration includes `allow_credentials=True`
3. Ensure `Access-Control-Allow-Origin` matches exactly (no wildcards with credentials)
4. Test in incognito mode to rule out browser extensions

### Issue: "Origin not allowed" error

**Symptoms**: CORS errors in browser console

**Causes**:
1. Frontend URL not in backend's `origins` list
2. Trailing slashes mismatch
3. HTTP vs HTTPS mismatch

**Solutions**:
1. Add exact frontend URL to `main.py` origins list
2. Ensure `FRONTEND_URL` environment variable is set in Render
3. Redeploy backend after CORS configuration changes

### Issue: OAuth redirect fails

**Symptoms**: "Invalid redirect_uri" error from OAuth provider

**Causes**:
1. OAuth callback URL not updated in provider settings
2. Mismatch between configured URL and actual Render URL

**Solutions**:
1. Update GitHub OAuth callback URL to `https://your-backend.onrender.com/api/auth/github/callback`
2. Update Google OAuth redirect URI to `https://your-backend.onrender.com/api/auth/google/callback`
3. Wait 5-10 minutes for OAuth changes to propagate

## Security Checklist

Before going to production:

- [ ] ✅ `ENV_TYPE=production` set in Render
- [ ] ✅ Strong `FLASK_SECRET_KEY` generated and set
- [ ] ✅ Strong `TOKEN_ENCRYPTION_KEY` generated and set
- [ ] ✅ `FRONTEND_URL` matches Vercel deployment URL exactly
- [ ] ✅ OAuth apps configured with production callback URLs
- [ ] ✅ HTTPS enabled on both domains
- [ ] ✅ CORS configured with exact origins (no wildcards)
- [ ] ✅ HttpOnly, Secure, SameSite=None cookies configured
- [ ] ✅ CSP headers configured appropriately
- [ ] ✅ MongoDB connection uses Atlas with authentication
- [ ] ✅ MongoDB user has minimal required permissions
- [ ] ✅ Rate limiting enabled (default in FastAPI app)
- [ ] ✅ Secrets not committed to repository
- [ ] ✅ GitHub secret scanning enabled
- [ ] ✅ Dependabot enabled for security updates

## Performance Optimization

### Enable Caching

Add caching headers to Vercel:

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Enable Compression

Render automatically enables gzip compression. For Vercel, ensure build output is already minified.

### CDN Configuration

Vercel automatically serves static assets via CDN. No additional configuration needed.

## Monitoring

### Backend Monitoring (Render)

1. Go to Render Dashboard → Your Service
2. Check **Metrics** tab for:
   - Response times
   - Error rates
   - Memory usage
   - CPU usage

### Frontend Monitoring (Vercel)

1. Go to Vercel Dashboard → Your Project
2. Check **Analytics** for:
   - Page load times
   - Core Web Vitals
   - Error rates

### Logging

**Backend logs**: Available in Render Dashboard → Logs tab

**Frontend logs**: Use Vercel Logs or integrate with Sentry for error tracking

## Cost Estimates

### Free Tier
- **Render**: 750 hours/month free (1 web service)
- **Vercel**: 100 GB bandwidth/month free
- **MongoDB Atlas**: 512 MB storage free

### Paid Tier (Estimated)
- **Render**: Starting at $7/month for Starter instance
- **Vercel**: Pro plan at $20/month for team features
- **MongoDB Atlas**: Starting at $9/month for M2 cluster

## References

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [CSRF Protection Guide](./docs/security/CSRF_PROTECTION.md)
- [MDN: SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)

## Support

For issues specific to this deployment:
1. Check Render and Vercel service logs
2. Review browser console for frontend errors
3. Test with curl to isolate backend vs frontend issues
4. Open an issue on GitHub with logs and error messages
