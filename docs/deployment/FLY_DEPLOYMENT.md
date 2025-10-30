# Complete Vercel + Fly.io Deployment Guide

This guide provides detailed instructions for deploying Papers2Code with:
- **Frontend**: Vercel (React/Vite application)
- **Backend**: Fly.io (FastAPI application in Docker)
- **Database**: MongoDB Atlas

## Why Fly.io for Backend?

**Fly.io** advantages:
- Runs Docker containers (full control)
- Global edge network (deploy close to users)
- Free tier includes 3 shared-cpu VMs
- Better WebSocket support than serverless
- Simple CLI-based deployment
- Auto-scaling and load balancing

## Architecture Overview

```
┌─────────────┐      HTTPS      ┌──────────────┐      HTTPS      ┌─────────────┐
│   Browser   │ ──────────────> │   Vercel     │ ──────────────> │   Fly.io    │
│             │                 │  (Frontend)  │                 │  (Backend)  │
└─────────────┘                 └──────────────┘                 └──────┬──────┘
                                                                        │
                                                                        │ HTTPS
                                                                        ▼
                                                                 ┌─────────────┐
                                                                 │   MongoDB   │
                                                                 │    Atlas    │
                                                                 └─────────────┘
```

---

## Part 1: MongoDB Atlas Setup

Follow the same MongoDB setup as in [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) Part 1.

Quick summary:
1. Create free M0 cluster
2. Create database user
3. Allow access from anywhere (0.0.0.0/0)
4. Copy connection string
5. (Optional) Create search index

---

## Part 2: Fly.io Backend Deployment

### 2.1 Install Fly.io CLI

**macOS:**
```bash
brew install flyctl
```

**Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows:**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

### 2.2 Sign Up and Login

```bash
# Sign up for Fly.io account
flyctl auth signup

# Or login if you already have an account
flyctl auth login
```

### 2.3 Launch Your App

From your project root directory:

```bash
cd /path/to/Papers2Code

# Launch the app (interactive setup)
flyctl launch
```

When prompted:
1. **App name**: `papers2code-backend` (or your choice)
2. **Organization**: Choose your organization
3. **Region**: Select closest to your users (e.g., `iad` for Washington D.C.)
4. **Would you like to set up a Postgresql database?**: **No** (we're using MongoDB)
5. **Would you like to set up an Upstash Redis database?**: **No** (optional for caching)
6. **Would you like to deploy now?**: **No** (we need to set secrets first)

This creates a `fly.toml` configuration file (already included in the repo).

### 2.4 Set Secrets (Environment Variables)

Set all required environment variables as secrets:

```bash
# Database
flyctl secrets set MONGO_CONNECTION_STRING="mongodb+srv://papers2code_admin:YOUR_PASSWORD@cluster.mongodb.net/papers2code?retryWrites=true&w=majority"

# GitHub OAuth
flyctl secrets set GITHUB_CLIENT_ID="your_github_client_id"
flyctl secrets set GITHUB_CLIENT_SECRET="your_github_client_secret"

# Security Keys (generate these first - see below)
flyctl secrets set FLASK_SECRET_KEY="your_64_char_hex_string"
flyctl secrets set TOKEN_ENCRYPTION_KEY="your_fernet_key"

# Owner Configuration
flyctl secrets set OWNER_GITHUB_USERNAME="your_github_username"

# Optional: Google OAuth
flyctl secrets set GOOGLE_CLIENT_ID="your_google_client_id"
flyctl secrets set GOOGLE_CLIENT_SECRET="your_google_client_secret"
```

**Generate Security Keys:**

```bash
# For FLASK_SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"

# For TOKEN_ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 2.5 Update Dockerfile for PORT

The Dockerfile is already configured to use PORT=8080 (Fly.io's default internal port).

Make sure your `run_app2.py` respects the PORT environment variable:

Check if this needs updating (file should already have this):

```python
# In run_app2.py
import os
port = int(os.getenv("PORT", 5000))
uvicorn.run(main.app, host="0.0.0.0", port=port, log_level="info")
```

### 2.6 Deploy to Fly.io

```bash
# Deploy your application
flyctl deploy
```

This will:
1. Build the Docker image
2. Push it to Fly.io's registry
3. Deploy to your chosen region
4. Run health checks
5. Route traffic to your app

### 2.7 Get Your Fly.io URL

```bash
# Check app status
flyctl status

# Your app URL will be shown
# Format: https://papers2code-backend.fly.dev
```

Or visit your app:
```bash
flyctl open
```

### 2.8 Set Frontend URL

After deploying frontend (Part 3), update the secret:

```bash
flyctl secrets set FRONTEND_URL="https://your-vercel-app.vercel.app"
```

### 2.9 Verify Deployment

Test your backend:

```bash
# Health check
curl https://papers2code-backend.fly.dev/health

# API documentation
open https://papers2code-backend.fly.dev/docs
```

---

## Part 3: GitHub OAuth Setup

Create a GitHub OAuth application:

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `Papers2Code`
   - **Homepage URL**: `https://papers2code.vercel.app` (your Vercel URL)
   - **Authorization callback URL**: `https://papers2code-backend.fly.dev/api/auth/github/callback` (your Fly.io URL)
4. Click **"Register application"**
5. **Save** your Client ID and Client Secret

Then update your Fly.io secrets (if not done in 2.4):

```bash
flyctl secrets set GITHUB_CLIENT_ID="your_client_id"
flyctl secrets set GITHUB_CLIENT_SECRET="your_client_secret"
```

---

## Part 4: Vercel Frontend Deployment

Follow the same Vercel setup as in [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) Part 4.

**Key difference**: Set environment variable to your Fly.io URL:

```bash
VITE_API_BASE_URL=https://papers2code-backend.fly.dev
```

Quick steps:
1. Sign up for Vercel
2. Import your GitHub repository
3. Configure build settings:
   - Build Command: `cd papers2code-ui && npm install && npm run build`
   - Output Directory: `papers2code-ui/dist`
4. Add environment variable: `VITE_API_BASE_URL=https://papers2code-backend.fly.dev`
5. Deploy

---

## Part 5: Final Configuration

### 5.1 Update Frontend URL in Fly.io

```bash
flyctl secrets set FRONTEND_URL="https://papers2code.vercel.app"
```

### 5.2 Test the Full Stack

1. Visit your Vercel URL
2. Test GitHub login
3. Search for papers
4. Vote on papers (requires login)
5. Check browser console for errors

---

## Part 6: Fly.io Management

### 6.1 View Logs

```bash
# Stream live logs
flyctl logs

# View recent logs
flyctl logs --limit 100
```

### 6.2 Scale Your App

```bash
# View current scaling
flyctl scale show

# Scale to more machines
flyctl scale count 2

# Scale memory
flyctl scale memory 512

# Scale CPU
flyctl scale vm shared-cpu-2x
```

### 6.3 Monitor Your App

```bash
# Check app status
flyctl status

# View metrics
flyctl metrics
```

### 6.4 SSH into Your App

```bash
# Open SSH session
flyctl ssh console
```

### 6.5 Manage Secrets

```bash
# List all secrets (names only, not values)
flyctl secrets list

# Update a secret
flyctl secrets set SECRET_NAME="new_value"

# Remove a secret
flyctl secrets unset SECRET_NAME
```

---

## Part 7: Advanced Configuration

### 7.1 Multiple Regions

Deploy to multiple regions for lower latency:

```bash
# Add a region
flyctl regions add lhr  # London
flyctl regions add nrt  # Tokyo
flyctl regions add syd  # Sydney

# List regions
flyctl regions list

# Remove a region
flyctl regions remove lhr
```

### 7.2 Auto-Scaling

Edit `fly.toml`:

```toml
[http_service]
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1  # Always keep 1 running
```

Then deploy:
```bash
flyctl deploy
```

### 7.3 Custom Domains

```bash
# Add custom domain
flyctl certs add papers2code.com

# Check certificate status
flyctl certs show papers2code.com
```

Update DNS:
- Add A record: `@` → Fly.io IP
- Add AAAA record: `@` → Fly.io IPv6

### 7.4 Persistent Storage

If you need persistent storage (not typical for this app):

```bash
# Create volume
flyctl volumes create data --size 1

# Update fly.toml
[mounts]
  source = "data"
  destination = "/data"
```

---

## Part 8: CI/CD with GitHub Actions

Create `.github/workflows/deploy-fly.yml`:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches:
      - main
    paths:
      - 'papers2code_app2/**'
      - 'run_app2.py'
      - 'Dockerfile'
      - 'fly.toml'
      - 'pyproject.toml'

jobs:
  deploy:
    name: Deploy Backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: superfly/flyctl-actions/setup-flyctl@master
      
      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

Set up the secret:
1. Get your Fly.io API token:
   ```bash
   flyctl auth token
   ```
2. Add to GitHub repository secrets as `FLY_API_TOKEN`

---

## Part 9: Cost Breakdown

### Fly.io Free Tier

- **3 shared-cpu-1x VMs**: 256MB RAM each
- **3GB persistent storage**
- **160GB outbound data transfer/month**
- Perfect for development and small production apps

### Fly.io Paid Tier (Scale-as-you-go)

| Resource | Free | Price |
|----------|------|-------|
| shared-cpu-1x (256MB) | 3 VMs | $1.94/month per additional VM |
| shared-cpu-2x (512MB) | - | $3.88/month per VM |
| dedicated-cpu-1x (2GB) | - | $27.87/month per VM |
| Storage | 3GB | $0.15/GB/month |
| Outbound bandwidth | 160GB | $0.02/GB |

### Total Estimated Costs

**Hobby/Free Setup:**
- Fly.io: $0/month (free tier)
- Vercel: $0/month (free tier)
- MongoDB Atlas M0: $0/month
- **Total: $0/month** 🎉

**Small Production:**
- Fly.io (2x shared-cpu-1x with 512MB): ~$8/month
- Vercel Free: $0/month
- MongoDB M0: $0/month
- **Total: ~$8/month**

**Medium Production:**
- Fly.io (2x dedicated-cpu-1x): ~$56/month
- Vercel Pro: $20/month
- MongoDB M10: $57/month
- **Total: ~$133/month**

---

## Part 10: Troubleshooting

### Check Application Logs

```bash
# Real-time logs
flyctl logs

# Filter logs
flyctl logs --filter "ERROR"
```

### Health Check Failures

```bash
# Check health endpoint directly
curl https://papers2code-backend.fly.dev/health

# Check app status
flyctl status

# Restart app
flyctl apps restart papers2code-backend
```

### Database Connection Issues

```bash
# SSH into app
flyctl ssh console

# Test MongoDB connection
python -c "from pymongo import MongoClient; client = MongoClient('YOUR_MONGO_URI'); print(client.admin.command('ping'))"
```

### Memory Issues

If app crashes due to memory:

```bash
# Scale memory
flyctl scale memory 512

# Or switch to bigger VM
flyctl scale vm shared-cpu-2x
```

### Deployment Failures

```bash
# View deployment logs
flyctl logs --limit 500

# Rollback to previous version
flyctl releases list
flyctl releases rollback <version>
```

---

## Part 11: Environment Variables Reference

### Required Secrets (set with `flyctl secrets set`)

```bash
MONGO_CONNECTION_STRING=mongodb+srv://...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
FLASK_SECRET_KEY=...
TOKEN_ENCRYPTION_KEY=...
FRONTEND_URL=https://your-vercel-app.vercel.app
OWNER_GITHUB_USERNAME=your_github_username
```

### Optional Secrets

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ATLAS_SEARCH_INDEX_NAME=papers_index
APP_LOG_LEVEL=INFO
```

### Set in fly.toml (not secrets)

```toml
[env]
  PORT = "8080"
  ENV_TYPE = "production"
```

---

## Part 12: Backup & Monitoring

### Application Monitoring

Fly.io provides built-in monitoring:

```bash
# View metrics
flyctl metrics
```

For advanced monitoring, integrate with:
- **Sentry** for error tracking
- **Datadog** for APM
- **Prometheus** for metrics

### Database Backups

Use MongoDB Atlas backups (see VERCEL_DEPLOYMENT.md Part 11).

### Application Snapshots

Fly.io keeps recent releases:

```bash
# List releases
flyctl releases list

# Rollback to specific release
flyctl releases rollback v15
```

---

## Part 13: Security Best Practices

- [ ] All secrets set with `flyctl secrets set` (encrypted at rest)
- [ ] Strong MongoDB password
- [ ] FLASK_SECRET_KEY is randomly generated
- [ ] TOKEN_ENCRYPTION_KEY properly generated with Fernet
- [ ] GitHub OAuth credentials kept secret
- [ ] MongoDB Network Access configured
- [ ] CORS properly configured (FRONTEND_URL)
- [ ] HTTPS enforced (automatic on Fly.io)
- [ ] Regular security updates (rebuild Docker image)

---

## Part 14: Comparison with Other Platforms

| Feature | Fly.io | Railway | Render |
|---------|--------|---------|--------|
| **Free Tier** | 3 VMs (256MB) | $5 credit/month | 750 hours/month |
| **Cold Starts** | Minimal (if auto-stop enabled) | None | ~30 seconds (free tier) |
| **Global Edge** | Yes (25+ regions) | No | Limited |
| **Docker Support** | Native | Yes | Yes |
| **WebSocket** | Excellent | Good | Good |
| **CLI** | Excellent | Good | Limited |
| **Auto-scaling** | Yes | Vertical only | Yes (paid) |
| **Price** | Pay-as-you-go | $5-20/month | $7-19/month |

---

## Part 15: Migration Guide

### From Render to Fly.io

1. Export environment variables from Render
2. Set them as Fly.io secrets
3. Deploy to Fly.io
4. Test thoroughly
5. Update DNS/URLs
6. Delete Render service

### From Railway to Fly.io

1. Export environment variables from Railway
2. Set them as Fly.io secrets
3. Deploy to Fly.io
4. Update Vercel VITE_API_BASE_URL
5. Test and switch over

---

## Support & Resources

- **Fly.io Docs**: [fly.io/docs](https://fly.io/docs)
- **Fly.io Community**: [community.fly.io](https://community.fly.io)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **MongoDB Atlas**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **GitHub Issues**: [github.com/RyanKim17920/Papers2Code/issues](https://github.com/RyanKim17920/Papers2Code/issues)

---

**Congratulations! 🚀 Your Papers2Code application is now running on a global edge network!**
