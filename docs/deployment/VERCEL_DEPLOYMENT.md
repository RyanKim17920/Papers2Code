# Complete Vercel + Railway Deployment Guide

This guide provides detailed instructions for deploying Papers2Code with:
- **Frontend**: Vercel (React/Vite application)
- **Backend**: Railway (FastAPI application) - Recommended over Vercel for Python backends
- **Database**: MongoDB Atlas

## Why This Setup?

**Vercel** is excellent for static sites and serverless functions but not ideal for long-running Python applications like FastAPI. **Railway** offers:
- Native Python/uv support
- Always-on services (no cold starts)
- Better WebSocket support
- Simpler environment management
- Generous free tier ($5/month credit)

## Architecture Overview

```
┌─────────────┐      HTTPS      ┌──────────────┐      HTTPS      ┌─────────────┐
│   Browser   │ ──────────────> │   Vercel     │ ──────────────> │   Railway   │
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

### 1.1 Create MongoDB Atlas Cluster

1. Go to [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
2. Create a free account or sign in
3. Click **"Build a Database"**
4. Choose **M0 Free** tier
5. Select your preferred cloud provider and region (closest to your users)
6. Name your cluster (e.g., `papers2code-cluster`)
7. Click **"Create"**

### 1.2 Configure Database Access

1. In Atlas dashboard, go to **Database Access**
2. Click **"Add New Database User"**
3. Create a user:
   - Username: `papers2code_admin` (or your choice)
   - Password: Generate a strong password (save it securely!)
   - Database User Privileges: **Read and write to any database**
4. Click **"Add User"**

### 1.3 Configure Network Access

1. Go to **Network Access**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - ⚠️ This is necessary for Railway and Vercel deployments
   - Your database is still protected by username/password
4. Click **"Confirm"**

### 1.4 Get Connection String

1. Go to **Database** → **Connect** → **Connect your application**
2. Select **Driver: Python**, **Version: 3.12 or later**
3. Copy the connection string:
   ```
   mongodb+srv://papers2code_admin:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual password
5. Add database name at the end:
   ```
   mongodb+srv://papers2code_admin:YOUR_PASSWORD@cluster.mongodb.net/papers2code?retryWrites=true&w=majority
   ```
6. **Save this connection string securely** - you'll need it for Railway

### 1.5 Create Search Index (Optional but Recommended)

For advanced paper search functionality:

1. In Atlas, go to **Search** tab
2. Click **"Create Search Index"**
3. Choose **JSON Editor**
4. Index Name: `papers_index`
5. Paste this configuration:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "title": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "abstract": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "authors": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "tags": {
        "type": "string",
        "analyzer": "lucene.keyword"
      }
    }
  }
}
```

6. Click **"Create Search Index"**

---

## Part 2: GitHub OAuth Setup

You need to create **TWO** separate GitHub OAuth apps (one for each URL):

### 2.1 OAuth App for Railway Backend

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `Papers2Code Backend`
   - **Homepage URL**: `https://your-railway-url.up.railway.app`
     - You'll get this URL after deploying to Railway (step 3.5)
     - For now, use a placeholder: `https://papers2code-backend.up.railway.app`
   - **Authorization callback URL**: `https://your-railway-url.up.railway.app/api/auth/github/callback`
4. Click **"Register application"**
5. **Save** your Client ID and Client Secret (you'll need these for Railway)

### 2.2 OAuth App for Local Development (Optional)

Create another OAuth app for testing locally:
- Homepage URL: `http://localhost:5173`
- Callback URL: `http://localhost:5000/api/auth/github/callback`

---

## Part 3: Railway Backend Deployment

### 3.1 Sign Up for Railway

1. Go to [railway.app](https://railway.app)
2. Click **"Login"** and sign in with GitHub
3. Authorize Railway to access your GitHub account

### 3.2 Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your `Papers2Code` repository
4. Railway will detect the project automatically

### 3.3 Configure Build Settings

Railway should auto-detect Python. If not:

1. Click on your service
2. Go to **Settings**
3. Under **Build**, ensure:
   - **Builder**: Nixpacks (default)
   - **Build Command**: `pip install uv && uv sync`
   - **Start Command**: `uv run run_app2.py`

### 3.4 Set Environment Variables

1. Click on your service → **Variables** tab
2. Add the following variables:

**Required Variables:**

```bash
# Database
MONGO_CONNECTION_STRING=mongodb+srv://papers2code_admin:YOUR_PASSWORD@cluster.mongodb.net/papers2code?retryWrites=true&w=majority

# GitHub OAuth (from Part 2.1)
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# Security Keys
FLASK_SECRET_KEY=generate_random_64_char_hex_string_here
TOKEN_ENCRYPTION_KEY=generate_fernet_key_here

# Application Settings
ENV_TYPE=production
PORT=5000

# Owner Configuration
OWNER_GITHUB_USERNAME=your_github_username
```

**Generate Security Keys:**

```bash
# For FLASK_SECRET_KEY (run locally):
python -c "import secrets; print(secrets.token_hex(32))"

# For TOKEN_ENCRYPTION_KEY (run locally):
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Optional Variables:**

```bash
# Google OAuth (if you want Google login)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# MongoDB Atlas Search
ATLAS_SEARCH_INDEX_NAME=papers_index
ATLAS_SEARCH_SCORE_THRESHOLD=0.5

# Performance Settings
APP_LOG_LEVEL=INFO
MONGO_MAX_POOL_SIZE=50
MONGO_MIN_POOL_SIZE=5
```

3. Click **"Add"** for each variable

### 3.5 Get Your Railway URL

1. After deployment completes (check **Deployments** tab)
2. Go to **Settings** → **Networking**
3. Click **"Generate Domain"**
4. Copy your Railway URL (e.g., `papers2code-api-production.up.railway.app`)
5. **Important**: Update your GitHub OAuth app with this URL:
   - Go back to GitHub OAuth app settings
   - Update Homepage URL: `https://papers2code-api-production.up.railway.app`
   - Update Callback URL: `https://papers2code-api-production.up.railway.app/api/auth/github/callback`

### 3.6 Add Frontend URL

After deploying frontend (Part 4), add this variable:

```bash
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### 3.7 Verify Backend Deployment

1. Visit your Railway URL + `/health`:
   ```
   https://papers2code-api-production.up.railway.app/health
   ```
2. You should see a JSON response:
   ```json
   {
     "status": "healthy",
     "database": "connected"
   }
   ```

3. Check API docs:
   ```
   https://papers2code-api-production.up.railway.app/docs
   ```

---

## Part 4: Vercel Frontend Deployment

### 4.1 Sign Up for Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** and sign in with GitHub
3. Authorize Vercel to access your GitHub account

### 4.2 Import Project

1. From Vercel dashboard, click **"Add New..." → "Project"**
2. Select your `Papers2Code` repository
3. Click **"Import"**

### 4.3 Configure Project Settings

1. **Framework Preset**: Vite
2. **Root Directory**: `./` (leave as default)
3. **Build Command**: `cd papers2code-ui && npm install && npm run build`
4. **Output Directory**: `papers2code-ui/dist`
5. **Install Command**: `npm install --prefix papers2code-ui`

### 4.4 Add Environment Variables

1. In Vercel project settings, go to **Environment Variables**
2. Add the following:

**Production Environment:**

```bash
VITE_API_BASE_URL=https://papers2code-api-production.up.railway.app
```

**Important**: Replace with your actual Railway URL from Part 3.5

3. Click **"Add"**

### 4.5 Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-3 minutes)
3. Vercel will provide a URL like: `papers2code.vercel.app`

### 4.6 Configure Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Enable **Automatic HTTPS**

### 4.7 Update Railway with Frontend URL

1. Go back to Railway → Your backend service → **Variables**
2. Add/Update:
   ```bash
   FRONTEND_URL=https://papers2code.vercel.app
   ```
3. Redeploy if necessary

---

## Part 5: Final Configuration

### 5.1 Update OAuth Redirect URLs

Now that you have both URLs, update GitHub OAuth:

1. Go to GitHub OAuth app settings
2. Update **Homepage URL**: Your Vercel URL
3. Keep **Authorization callback URL**: Your Railway URL + `/api/auth/github/callback`

### 5.2 Test the Deployment

1. **Visit your Vercel URL**: `https://papers2code.vercel.app`
2. **Test GitHub Login**:
   - Click "Sign In with GitHub"
   - Should redirect to GitHub authorization
   - After authorization, should redirect back and log you in
3. **Test API Connection**:
   - Try searching for papers
   - Try voting on papers (requires login)
4. **Check Browser Console**:
   - No CORS errors
   - API calls going to Railway URL

### 5.3 Common Issues & Solutions

**Issue: CORS Errors**
```
Solution: Ensure FRONTEND_URL in Railway matches your Vercel URL exactly
```

**Issue: GitHub OAuth Fails**
```
Solution: 
1. Verify GitHub OAuth callback URL matches Railway URL exactly
2. Check GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Railway
3. Ensure FRONTEND_URL in Railway is correct
```

**Issue: API Calls Fail (Network Error)**
```
Solution:
1. Verify VITE_API_BASE_URL in Vercel matches Railway URL
2. Check Railway backend is running: visit /health endpoint
3. Check Railway logs for errors
```

**Issue: Database Connection Failed**
```
Solution:
1. Verify MONGO_CONNECTION_STRING in Railway is correct
2. Check MongoDB Atlas Network Access allows 0.0.0.0/0
3. Ensure database user has read/write permissions
```

**Issue: "Access to this site has been denied" on Railway**
```
Solution: Railway's free tier has usage limits. Upgrade to Hobby plan ($5/month) for production use.
```

---

## Part 6: Monitoring & Maintenance

### 6.1 Railway Monitoring

1. **View Logs**: Click on service → **Logs** tab
2. **Monitor Metrics**: Check CPU, Memory, Network usage
3. **Set up Alerts**: Railway can notify you of deployment failures

### 6.2 Vercel Monitoring

1. **View Deployments**: All builds are logged
2. **Analytics**: Available on Pro plan
3. **Function Logs**: Not applicable (static site)

### 6.3 MongoDB Atlas Monitoring

1. **Performance**: Monitor query performance
2. **Alerts**: Set up alerts for high CPU/memory
3. **Backups**: Atlas provides automatic backups

---

## Part 7: Cost Breakdown

### Free Tier Limits

| Service | Free Tier | Limits | Upgrade Cost |
|---------|-----------|--------|--------------|
| **Railway** | $5/month credit | 500 hours/month, shared across projects | $5/month (Hobby) - $20/month (Pro) |
| **Vercel** | Unlimited bandwidth | 100 GB bandwidth/month, 6000 build minutes/month | $20/month (Pro) |
| **MongoDB Atlas** | M0 Free | 512 MB storage, shared cluster | $9/month (M2) - $57/month (M10) |

### Estimated Monthly Costs

**Hobby Setup (Recommended for Production):**
- Railway Hobby: $5/month
- Vercel Free: $0
- MongoDB M0: $0
- **Total: $5/month**

**Production Setup:**
- Railway Pro: $20/month
- Vercel Pro: $20/month
- MongoDB M10: $57/month
- **Total: $97/month**

---

## Part 8: Environment Variables Reference

### Backend (Railway)

```bash
# === REQUIRED ===
MONGO_CONNECTION_STRING=mongodb+srv://...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
FLASK_SECRET_KEY=...
TOKEN_ENCRYPTION_KEY=...
ENV_TYPE=production
PORT=5000
FRONTEND_URL=https://your-vercel-app.vercel.app
OWNER_GITHUB_USERNAME=your_github_username

# === OPTIONAL ===
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APP_LOG_LEVEL=INFO
ATLAS_SEARCH_INDEX_NAME=papers_index
ATLAS_SEARCH_SCORE_THRESHOLD=0.5
MONGO_MAX_POOL_SIZE=50
MONGO_MIN_POOL_SIZE=5
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=10080
NOT_IMPLEMENTABLE_CONFIRM_THRESHOLD=3
IMPLEMENTABLE_CONFIRM_THRESHOLD=2
```

### Frontend (Vercel)

```bash
# === REQUIRED ===
VITE_API_BASE_URL=https://your-railway-app.up.railway.app
```

---

## Part 9: CI/CD & Automatic Deployments

### 9.1 Railway Auto-Deployments

Railway automatically deploys when you push to your main branch:

1. Make changes to backend code
2. Commit and push to GitHub
3. Railway detects changes and redeploys
4. Monitor deployment in Railway dashboard

### 9.2 Vercel Auto-Deployments

Vercel automatically deploys on every push:

1. Make changes to frontend code (papers2code-ui/)
2. Commit and push to GitHub
3. Vercel builds and deploys automatically
4. Preview deployments for pull requests

### 9.3 Manual Deployments

**Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

**Vercel:**
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

---

## Part 10: Security Checklist

- [ ] All environment variables are set correctly
- [ ] Strong passwords for MongoDB database user
- [ ] FLASK_SECRET_KEY is randomly generated (64 characters)
- [ ] TOKEN_ENCRYPTION_KEY is properly generated with Fernet
- [ ] GitHub OAuth credentials are kept secret
- [ ] MongoDB Network Access allows Railway/Vercel IPs
- [ ] CORS is properly configured (FRONTEND_URL matches Vercel URL)
- [ ] HTTPS is enabled on all services (default for Railway/Vercel)
- [ ] Rate limiting is configured (built into backend)
- [ ] CSRF protection is enabled (built into backend)

---

## Part 11: Backup & Recovery

### Database Backups (MongoDB Atlas)

1. Go to **Clusters** → **Backup**
2. Enable **Continuous Backup** (available on paid tiers)
3. Or use **Cloud Backup** snapshots
4. Test restore process regularly

### Manual Database Export

```bash
# Install MongoDB tools
brew install mongodb-database-tools  # macOS
# or apt-get install mongodb-database-tools  # Linux

# Export database
mongodump --uri="mongodb+srv://papers2code_admin:PASSWORD@cluster.mongodb.net/papers2code" --out=./backup

# Import database
mongorestore --uri="mongodb+srv://papers2code_admin:PASSWORD@cluster.mongodb.net/papers2code" ./backup/papers2code
```

---

## Part 12: Troubleshooting Guide

### Logs

**Railway Logs:**
```bash
# View logs in dashboard
Railway Dashboard → Service → Logs

# Or via CLI
railway logs
```

**Vercel Logs:**
```bash
# View in dashboard
Vercel Dashboard → Project → Deployments → [Click deployment] → Build Logs

# Or via CLI
vercel logs
```

### Health Checks

**Backend Health Check:**
```bash
curl https://your-railway-url.up.railway.app/health
```

**Frontend Health Check:**
```bash
curl https://your-vercel-url.vercel.app
```

### Common Error Messages

**"Database connection failed"**
- Check MONGO_CONNECTION_STRING
- Verify MongoDB Atlas Network Access
- Ensure database user exists with correct permissions

**"CORS policy: No 'Access-Control-Allow-Origin' header"**
- Verify FRONTEND_URL in Railway matches Vercel URL
- Check CORS middleware in backend code

**"OAuth redirect_uri mismatch"**
- Verify GitHub OAuth callback URL matches Railway URL exactly
- Must include `/api/auth/github/callback` path

---

## Part 13: Scaling & Performance

### Database Optimization

1. **Indexes**: Ensure all collections have proper indexes
2. **Connection Pooling**: Adjust MONGO_MAX_POOL_SIZE based on load
3. **Atlas Search**: Use for better search performance

### Backend Scaling

Railway automatically scales vertically. For horizontal scaling:
1. Upgrade to Railway Pro
2. Use Railway's built-in load balancing
3. Consider caching with Redis (add as Railway service)

### Frontend Optimization

Vercel automatically:
- Serves from global CDN
- Compresses assets
- Caches static files
- Provides automatic image optimization

---

## Part 14: Alternative Deployment Options

If you prefer different platforms:

### Option 1: All-in-One Render

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Render-specific instructions.

### Option 2: Fly.io Backend

See [FLY_DEPLOYMENT.md](./FLY_DEPLOYMENT.md) (if created).

### Option 3: Self-Hosted

Deploy on your own VPS (DigitalOcean, Linode, AWS EC2):
- Use Docker containers
- Set up nginx reverse proxy
- Configure SSL certificates with Let's Encrypt
- Manage PM2 or systemd for process management

---

## Support & Resources

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **MongoDB Atlas Docs**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **Papers2Code Issues**: [github.com/RyanKim17920/Papers2Code/issues](https://github.com/RyanKim17920/Papers2Code/issues)

---

**Congratulations! 🎉 Your Papers2Code application is now deployed and accessible worldwide!**
