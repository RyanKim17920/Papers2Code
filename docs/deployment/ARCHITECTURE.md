# Deployment Architecture

This document explains the architecture of Papers2Code across different deployment scenarios.

## Overview

Papers2Code is a full-stack application with three main components:
1. **Frontend**: React + Vite (Static Site)
2. **Backend**: FastAPI (Python Web Server)
3. **Database**: MongoDB Atlas (Cloud Database)

---

## Architecture Option 1: Vercel + Render (Recommended)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Internet                              │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │ HTTPS                              │ HTTPS
             ↓                                    ↓
┌────────────────────────────┐      ┌────────────────────────────┐
│   Vercel CDN (Global)      │      │  Render (Single Region)    │
│                            │      │                            │
│  ┌──────────────────────┐  │      │  ┌──────────────────────┐  │
│  │   React/Vite App     │  │      │  │   FastAPI Server     │  │
│  │   (Static Assets)    │  │      │  │   (Python 3.12+)     │  │
│  │                      │  │      │  │                      │  │
│  │  • HTML/CSS/JS       │  │      │  │  • REST API          │  │
│  │  • Images/Fonts      │  │      │  │  • OAuth Flow        │  │
│  │  • Cached at Edge    │  │      │  │  • Business Logic    │  │
│  └──────────────────────┘  │      │  └──────────────────────┘  │
│                            │      │                            │
│  Frontend Domain:          │      │  Backend Domain:           │
│  papers2code.vercel.app    │      │  api.onrender.com          │
└────────────────────────────┘      └────────────┬───────────────┘
                                                  │
                                                  │ MongoDB Wire Protocol
                                                  ↓
                                    ┌────────────────────────────┐
                                    │   MongoDB Atlas (AWS)      │
                                    │                            │
                                    │  ┌──────────────────────┐  │
                                    │  │   Database Cluster   │  │
                                    │  │   (Multi-Region)     │  │
                                    │  │                      │  │
                                    │  │  • Users Collection  │  │
                                    │  │  • Papers Collection │  │
                                    │  │  • Progress Data     │  │
                                    │  └──────────────────────┘  │
                                    │                            │
                                    │  Database:                 │
                                    │  cluster.mongodb.net       │
                                    └────────────────────────────┘
```

### Request Flow

#### 1. Initial Page Load
```
User Browser
    │
    ↓ [1] HTTP GET https://papers2code.vercel.app
    │
Vercel CDN (Edge Location Nearest to User)
    │
    ↓ [2] Serve cached HTML/CSS/JS
    │
User Browser (React App Loads)
    │
    ↓ [3] Initialize React Application
    │
Browser executes JavaScript
```

#### 2. API Request Flow
```
React App
    │
    ↓ [1] API Request: GET /api/papers
    │     Destination: https://api.onrender.com/api/papers
    │     Headers: Authorization, CSRF Token
    │
Render Backend
    │
    ↓ [2] Validate CSRF & Authentication
    │
    ├─ [3a] Check Redis Cache (if available)
    │  └─ Cache Hit → Return cached data
    │
    └─ [3b] Cache Miss → Query MongoDB
           │
           ↓ [4] Execute MongoDB Query
           │
       MongoDB Atlas
           │
           ↓ [5] Return Results
           │
       Render Backend
           │
           ↓ [6] Format Response (JSON)
           │
       React App
           │
           ↓ [7] Update UI with Data
           │
       User sees results
```

#### 3. OAuth Authentication Flow
```
User clicks "Login with GitHub"
    │
    ↓ [1] Redirect to Backend OAuth endpoint
    │     https://api.onrender.com/api/auth/github/login
    │
Backend generates OAuth state
    │
    ↓ [2] Redirect to GitHub
    │     https://github.com/login/oauth/authorize?client_id=...
    │
User approves on GitHub
    │
    ↓ [3] GitHub redirects back with code
    │     https://api.onrender.com/api/auth/github/callback?code=xxx
    │
Backend exchanges code for access token
    │
    ↓ [4] Get user info from GitHub API
    │
Backend creates/updates user in MongoDB
    │
    ↓ [5] Generate JWT token
    │
Backend sets secure cookie
    │
    ↓ [6] Redirect to Frontend
    │     https://papers2code.vercel.app/dashboard
    │
User is logged in
```

### Environment Variables Flow

```
┌─────────────────────────────────┐
│   Vercel Environment Variables  │
│                                 │
│   VITE_API_BASE_URL             │
│   └→ Injected at build time     │
│      into compiled JS           │
└─────────────────────────────────┘
              │
              ↓ (Used by frontend to make API calls)
              │
┌─────────────────────────────────┐
│   Render Environment Variables  │
│                                 │
│   MONGO_CONNECTION_STRING       │
│   FLASK_SECRET_KEY              │
│   GITHUB_CLIENT_ID/SECRET       │
│   FRONTEND_URL ──────────┐      │
│   └→ Used for CORS       │      │
└──────────────────────────┼──────┘
                           │
                           ↓
              Validates requests from Frontend
```

---

## Architecture Option 2: Render All-in-One

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Internet                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTPS
                           ↓
             ┌─────────────────────────────┐
             │   Render (Single Region)    │
             │                             │
             │  ┌───────────────────────┐  │
             │  │  Static Site Service  │  │
             │  │  (Frontend)           │  │
             │  │  • Serves HTML/CSS/JS │  │
             │  │  • papers.onrender.com│  │
             │  └───────────────────────┘  │
             │             │                │
             │             │ Internal       │
             │             ↓                │
             │  ┌───────────────────────┐  │
             │  │  Web Service          │  │
             │  │  (Backend API)        │  │
             │  │  • FastAPI Server     │  │
             │  │  • api.onrender.com   │  │
             │  └───────────────────────┘  │
             │             │                │
             └─────────────┼────────────────┘
                           │
                           │ MongoDB Wire Protocol
                           ↓
             ┌─────────────────────────────┐
             │   MongoDB Atlas (AWS)       │
             │                             │
             │  ┌───────────────────────┐  │
             │  │  Database Cluster     │  │
             │  │  • Users, Papers, etc │  │
             │  └───────────────────────┘  │
             └─────────────────────────────┘
```

### Request Flow (Simplified)
```
User → Render (Frontend) → Render (Backend) → MongoDB Atlas
     ←─────────────────────────────────────────
```

---

## Component Details

### Frontend (React + Vite)

**Technology Stack**:
- React 19 (UI Framework)
- TypeScript (Type Safety)
- Vite (Build Tool)
- Tailwind CSS (Styling)
- React Router (Routing)
- Axios (HTTP Client)

**Build Process**:
```
Source Code (papers2code-ui/src/)
    │
    ↓ [1] TypeScript Compilation (tsc)
    │
Type-checked JavaScript
    │
    ↓ [2] Vite Bundling
    │
Optimized Bundles
    │
    ├─ [3a] Code Splitting
    │  └─ Separate chunks for React, MUI, Charts, etc.
    │
    ├─ [3b] Minification
    │  └─ Remove whitespace, shorten names
    │
    └─ [3c] Asset Optimization
       └─ Compress images, fonts
    │
    ↓ [4] Output to dist/
    │
Static Files (HTML, CSS, JS, Images)
    │
    ↓ [5] Deploy to Vercel/Render
    │
Served via CDN or Static Hosting
```

**Routing (Client-Side)**:
```
/ (root)
├── /login              → Login Page
├── /papers             → Paper List
│   └── /papers/:id     → Paper Detail
├── /dashboard          → User Dashboard
├── /profile/:id        → User Profile
└── /404                → Not Found
```

### Backend (FastAPI)

**Technology Stack**:
- FastAPI (Web Framework)
- Python 3.12+ (Language)
- Pydantic (Validation)
- Motor (Async MongoDB Driver)
- JWT (Authentication)
- SlowAPI (Rate Limiting)

**API Structure**:
```
/api
├── /auth
│   ├── /github/login
│   ├── /github/callback
│   ├── /google/login
│   ├── /google/callback
│   ├── /csrf-token
│   ├── /me
│   └── /logout
├── /papers
│   ├── GET    /             → List papers
│   ├── POST   /             → Create paper
│   ├── GET    /{id}         → Get paper
│   ├── PUT    /{id}         → Update paper
│   ├── POST   /{id}/vote    → Vote on paper
│   └── POST   /{id}/progress → Update progress
├── /users
│   ├── GET    /profile      → Get user profile
│   └── PUT    /profile      → Update profile
└── /admin
    ├── GET    /users        → List users (admin)
    └── PUT    /users/{id}   → Update user (admin)
```

**Middleware Stack**:
```
Request
    │
    ↓ [1] CORS Middleware (validate origin)
    │
    ↓ [2] CSRF Protection (check token)
    │
    ↓ [3] Rate Limiting (prevent abuse)
    │
    ↓ [4] Authentication (verify JWT)
    │
    ↓ [5] Authorization (check permissions)
    │
    ↓ [6] Request Handler (business logic)
    │
Response
```

### Database (MongoDB Atlas)

**Collections**:
```
papers2code (database)
├── users
│   ├── _id (ObjectId)
│   ├── email
│   ├── github_id
│   ├── google_id
│   ├── role (user/moderator/admin)
│   └── ...
├── papers
│   ├── _id (ObjectId)
│   ├── title
│   ├── abstract
│   ├── authors []
│   ├── tags []
│   ├── votes []
│   ├── implementability_status
│   └── ...
├── implementation_progress
│   ├── _id (ObjectId)
│   ├── paper_id (reference)
│   ├── status
│   ├── updates []
│   └── ...
└── paper_views
    ├── _id (ObjectId)
    ├── paper_id (reference)
    ├── user_id (reference)
    └── timestamp
```

**Indexes** (for performance):
- `users.email` (unique)
- `users.github_id` (unique, sparse)
- `papers.title` (text search)
- `papers.tags` (array index)
- `implementation_progress.paper_id`

---

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Network/Infrastructure Security                   │
│  • HTTPS/TLS encryption (Vercel/Render)                    │
│  • DDoS protection (Platform level)                        │
│  • Firewall rules (MongoDB Atlas)                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Application Security                              │
│  • CORS validation (FRONTEND_URL whitelist)                │
│  • CSRF tokens (cookie + header validation)                │
│  • Rate limiting (SlowAPI)                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Authentication & Authorization                     │
│  • OAuth 2.0 (GitHub/Google)                                │
│  • JWT tokens (signed, time-limited)                        │
│  • Role-based access control                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Data Security                                      │
│  • Input validation (Pydantic schemas)                      │
│  • SQL injection prevention (NoSQL)                         │
│  • XSS prevention (React escaping)                          │
│  • Secrets in environment variables only                    │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow Security

```
┌──────────────────────────────────────────────────────────────┐
│  1. User initiates OAuth login                              │
│     • Generate random state parameter                       │
│     • Store in session with expiry (5 min)                  │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  2. OAuth provider validates                                │
│     • User approves access                                  │
│     • Provider redirects with code + state                  │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  3. Backend validates callback                              │
│     • Verify state matches stored value                     │
│     • Exchange code for token (server-to-server)            │
│     • Validate token with provider                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│  4. Create session                                          │
│     • Generate JWT with user claims                         │
│     • Sign with FLASK_SECRET_KEY                            │
│     • Set secure, httpOnly cookie                           │
│     • Redirect to frontend                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Scaling Considerations

### Current Architecture (Small to Medium Scale)

**Supports**:
- ✅ Up to 10,000 daily active users
- ✅ Up to 100 requests/second
- ✅ Database size up to 10GB

**Limitations**:
- ⚠️ Single backend instance (Render)
- ⚠️ No caching layer (Redis)
- ⚠️ No CDN for API responses

### Scaling Path

#### Level 1: Add Caching (Support 50K users)
```
Frontend (Vercel CDN)
    ↓
Backend (Render) ← → Redis Cache
    ↓
MongoDB Atlas
```

#### Level 2: Multi-Region Backend (Support 500K users)
```
Frontend (Vercel CDN - Global)
    ↓
Load Balancer
    ├→ Backend (US)
    ├→ Backend (EU)
    └→ Backend (Asia)
         ↓
MongoDB Atlas (Multi-Region)
```

#### Level 3: Microservices (Support 1M+ users)
```
Frontend (Vercel)
    ↓
API Gateway
    ├→ Auth Service
    ├→ Papers Service
    ├→ Progress Service
    └→ Search Service (Elasticsearch)
         ↓
MongoDB Atlas Sharded Cluster
```

---

## Monitoring & Observability

### What to Monitor

```
Frontend (Vercel)
├── Deployment success rate
├── Build duration
├── Bandwidth usage
└── Core Web Vitals (LCP, FID, CLS)

Backend (Render)
├── Uptime/Downtime
├── Response times (p50, p95, p99)
├── Error rates (4xx, 5xx)
├── CPU & Memory usage
└── Request throughput

Database (MongoDB Atlas)
├── Connection pool usage
├── Query performance
├── Storage size
└── Index efficiency
```

### Recommended Tools

- **Vercel Analytics**: Frontend performance
- **Render Logs**: Backend debugging
- **MongoDB Atlas Metrics**: Database performance
- **Sentry** (optional): Error tracking
- **Uptime Robot** (optional): Availability monitoring

---

## Disaster Recovery

### Backup Strategy

**Database** (MongoDB Atlas):
- Automated daily snapshots (retained 7 days)
- Point-in-time recovery available
- Manual backup before major changes

**Code** (GitHub):
- All code in version control
- Main branch protected
- Feature branches for development

**Environment Variables**:
- Documented in `.env.example`
- Backed up securely offline
- Never in code repository

### Recovery Procedures

**Frontend Failure**:
1. Check Vercel deployment logs
2. Rollback to previous deployment (1 click)
3. Estimated recovery: < 5 minutes

**Backend Failure**:
1. Check Render logs
2. Redeploy or rollback
3. Estimated recovery: < 10 minutes

**Database Failure** (rare):
1. Contact MongoDB Atlas support
2. Restore from snapshot
3. Estimated recovery: < 1 hour

---

## Cost Optimization Tips

1. **Use Free Tiers Wisely**:
   - Vercel: Free forever for frontend
   - Render: Free with cold starts acceptable
   - MongoDB Atlas: Free 512MB tier

2. **Optimize Bundle Size**:
   - Code splitting in Vite
   - Lazy load components
   - Compress images

3. **Database Optimization**:
   - Proper indexes (reduces query time)
   - Limit result sets
   - Use projections (only fetch needed fields)

4. **Caching**:
   - Browser caching (max-age headers)
   - API response caching
   - CDN edge caching (Vercel does this)

5. **Monitor Usage**:
   - Watch bandwidth (Vercel)
   - Monitor compute hours (Render)
   - Check database operations (MongoDB)

---

## Next Steps

- **Deploy**: Follow [DEPLOY_VERCEL.md](../../DEPLOY_VERCEL.md)
- **Compare Options**: See [DEPLOYMENT_COMPARISON.md](./DEPLOYMENT_COMPARISON.md)
- **Checklist**: Use [VERCEL_CHECKLIST.md](./VERCEL_CHECKLIST.md)

---

**Last Updated**: October 2025
