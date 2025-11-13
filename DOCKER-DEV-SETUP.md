# Docker Development Setup

**One command to start everything** with real test data.

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env.dev

# 2. Add your MongoDB Atlas connection string (or use local)
# Edit MONGO_URI_DEV in .env.dev

# 3. Initialize dev environment (creates structure + seeds 500 papers)
./scripts/init_dev_db.sh

# 4. Start Docker services
docker-compose -f docker-compose.dev.yml up -d

# Access at:
# - Frontend: http://localhost:5173
# - Backend: http://localhost:5000
# - API Docs: http://localhost:5000/docs
```

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
# .env.dev
ENV_TYPE=DEV  # Development mode (uses Dex mock OAuth)

# .env.production  
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

## MongoDB Options

### Option A: MongoDB Atlas (Recommended)
```bash
# In .env.dev
MONGO_URI_DEV=mongodb+srv://user:pass@cluster.mongodb.net/papers2code_dev
```

### Option B: Local MongoDB
```bash
# In .env.dev  
MONGO_URI_DEV=mongodb://localhost:27017/papers2code_dev
```

## Test OAuth with Dex

No real GitHub/Google accounts needed!

**Test users (password: `password`):**
- `dev_github_user1@test.local`
- `dev_google_user1@gmail.test`
- `admin_dev@test.local` (has admin privileges)

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
```

## Troubleshooting

**"Connection refused to MongoDB"**
- Check `MONGO_URI_DEV` in `.env.dev`
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
├── Backend (FastAPI) - Port 5000
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

---

**For detailed environment configuration:** See `.env.example` (complete reference)
