# Docker Development Setup

**One command to start everything** with real test data.

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Add your MongoDB Atlas connection string (or use local)
# Edit MONGO_URI_DEV in .env

# 3. Initialize dev environment (creates structure + seeds 500 papers)
./scripts/init_dev_db.sh

# 4. Start Docker services
docker-compose -f docker-compose.dev.yml up -d

# Access at:
# - Frontend: http://localhost:5173
# - Backend: http://localhost:5001
# - API Docs: http://localhost:5001/docs
```

## Hybrid Workflow (Dex in Docker, app locally)

If you prefer running the FastAPI & Vite dev servers locally (for hot reload speed) while still using Dex from Docker, use the helper script:

```bash
uv run docker_run.py               # Starts Dex + backend + frontend
uv run docker_run.py --skip-frontend   # Just Dex + backend
uv run docker_run.py stop          # Stop only the Dex container
```

The script ensures Dex is up through Docker Compose and streams the logs of the locally run backend/frontend processes until you press `Ctrl+C`.

## What Gets Created

The initialization script (`init_dev_db.sh`):
1. Connects to production MongoDB (read-only)
2. Copies collection structure (indexes, validators) to dev
3. Randomly samples 500 papers from production
4. Seeds dev database with realistic data
5. No data loss - production is never modified

## Environment Toggle

**Change one line to switch environments:**

```bash
# .env
ENV_TYPE=DEV  # Development mode (uses Dex mock OAuth)

# Same .env file for other modes
ENV_TYPE=PRODUCTION  # Production mode (uses real GitHub/Google OAuth)
```

When `ENV_TYPE=DEV`:
- ✅ Uses `MONGO_URI_DEV`
- ✅ Dex mock OAuth (no real GitHub/Google needed)
- ✅ Debug logging
- ✅ Detailed errors

When `ENV_TYPE=PRODUCTION`:
- ✅ Uses `MONGO_URI_PROD`
- ✅ Real GitHub/Google OAuth
- ✅ Production logging
- ✅ Sanitized errors

## Environment File Precedence

The backend now automatically loads the correct env files:

1. `.env` is always loaded.

Keep production secrets out of version control by never committing `.env`. Use the same file locally, in Docker, and in deployment environments.

## MongoDB Options

### Option A: MongoDB Atlas (Recommended)
```bash
# In .env
MONGO_URI_DEV=mongodb+srv://user:pass@cluster.mongodb.net/papers2code_dev
```

### Option B: Local MongoDB
```bash
# In .env  
MONGO_URI_DEV=mongodb://localhost:27017/papers2code_dev
```

## Test OAuth with Dex

No real GitHub/Google accounts needed!

**Test users (password: `password`):**
- `dev_github_user1@test.local`
- `dev_google_user1@gmail.test`
- `admin_dev@test.local` (has admin privileges)

### Mock GitHub & Google behavior
With `ENV_TYPE=DEV` (or `USE_DEX_OAUTH=true`), the backend short-circuits all GitHub repository creation and Google-only API calls. Implementation progress actions still return realistic repository metadata (names, clone URLs, README edits, etc.) but nothing ever hits the real GitHub/Google APIs. This keeps Dex logins fully self-contained inside Docker while allowing the UI to exercise the full workflow.

## Common Commands

```bash
# View logs
docker-compose -f docker-compose.dev.yml logs -f backend

# Restart backend only (2-3 sec with hot reload)
docker-compose -f docker-compose.dev.yml restart backend

# Reset everything
docker-compose -f docker-compose.dev.yml down -v
./scripts/init_dev_db.sh

# Reseed database with different data
./scripts/init_dev_db.sh --resample

# Stop all
docker-compose -f docker-compose.dev.yml down

## Service Health Checklist

Quick smoke-tests to ensure every container is healthy:

```bash
# 1. All services running?
docker compose -f docker-compose.dev.yml ps

# 2. Backend FastAPI healthy?
curl -sf http://localhost:5001/health

# 3. Dex OIDC metadata reachable?
curl -sf http://localhost:5556/dex/.well-known/openid-configuration | jq '.issuer'

# 4. Frontend dev server responding?
curl -I http://localhost:5173
```

If any command fails, restart just the impacted service (e.g., `docker compose -f docker-compose.dev.yml restart backend`) instead of taking the whole stack down.
```

## Troubleshooting

**"Connection refused to MongoDB"**
- Check `MONGO_URI_DEV` in `.env`
- Verify MongoDB Atlas IP whitelist
- Test connection: `mongosh "your-connection-string"`

**"OAuth callback fails"**
- Check Dex is running: `curl http://localhost:5556/dex/.well-known/openid-configuration`
- Restart backend: `docker-compose -f docker-compose.dev.yml restart backend`

**"No papers in database"**
- Run init script: `./scripts/init_dev_db.sh`
- Check logs: `docker-compose -f docker-compose.dev.yml logs backend`

## Architecture

```
Docker Compose Stack:
├── Dex (Mock OAuth) - Port 5556
├── Backend (FastAPI) - Port 5001
│   └── Connects to MongoDB Atlas (external)
└── Frontend (React) - Port 5173

MongoDB Atlas (External):
└── papers2code_dev
    ├── papers (500 sampled)
    ├── users
    ├── user_actions
    └── ... (all collections)
```

## Next Steps

After setup works:
1. Make code changes
2. Backend hot reloads automatically
3. Frontend HMR updates instantly
4. Test OAuth flows with Dex users
5. No need to restart entire stack!

## Refresh Dev Data with Real Samples

Need fresh papers without reseeding everything? Run:

```bash
uv run python scripts/sample_prod_to_dev.py --size 100
# Optional: append --allow-invalid-cert if your OS trust store is missing
# Atlas root certificates (or run the macOS "Install Certificates" utility).
```

This pulls a random sample from the production `papers` collection and upserts it into the dev cluster (safe to repeat).

---

**For detailed environment configuration:** See `.env.example` (complete reference)
