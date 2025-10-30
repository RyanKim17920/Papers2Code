# Complete Render Deployment Guide for Papers2Code

This is the **definitive guide** for deploying Papers2Code on Render - a single platform for both frontend and backend.

## 🎯 Why Render?

**Render is the BEST choice for this application because:**

✅ **One Platform**: Deploy both frontend and backend in one place  
✅ **Blueprint Support**: Automatic setup using `render.yaml`  
✅ **Auto-Linking**: Services automatically connect to each other  
✅ **Free Tier**: Start for free (backend sleeps after 15 min)  
✅ **Easy Upgrade**: $7/month for always-on backend  
✅ **Git Integration**: Auto-deploys on every push  
✅ **Native Python/uv Support**: No Docker needed  
✅ **Free Static Sites**: Frontend is always free  

## 📋 What You'll Deploy

```
┌─────────────────────────────────────────────┐
│             Render Platform                 │
│                                             │
│  ┌──────────────┐      ┌────────────────┐  │
│  │   Frontend   │ ───> │    Backend     │  │
│  │   (Static)   │      │   (FastAPI)    │  │
│  │   Always ON  │      │  Free or $7/mo │  │
│  └──────────────┘      └────────┬───────┘  │
│                                 │           │
└─────────────────────────────────┼───────────┘
                                  │
                                  ▼
                          ┌───────────────┐
                          │  MongoDB      │
                          │  Atlas (Free) │
                          └───────────────┘
```

---

## ⏱️ Time Required

- **Total Setup Time**: 15-20 minutes
- **MongoDB Setup**: 5 minutes
- **GitHub OAuth**: 3 minutes
- **Render Deployment**: 5-7 minutes
- **Testing**: 2-3 minutes

---

## 📚 Table of Contents

1. [Prerequisites](#prerequisites)
2. [MongoDB Atlas Setup](#step-1-mongodb-atlas-setup)
3. [Generate Security Keys](#step-2-generate-security-keys)
4. [Deploy to Render](#step-3-deploy-to-render)
5. [GitHub OAuth Setup](#step-4-github-oauth-setup)
6. [Configure Environment Variables](#step-5-configure-environment-variables)
7. [Verify Deployment](#step-6-verify-deployment)
8. [Testing & Troubleshooting](#step-7-testing--troubleshooting)
9. [Going to Production](#step-8-going-to-production)
10. [Monitoring & Maintenance](#step-9-monitoring--maintenance)

---

## Prerequisites

Before you start, you need:

- [ ] **GitHub Account** (to sign up for Render and OAuth)
- [ ] **MongoDB Atlas Account** (free - we'll create this)
- [ ] **5-10 minutes** of focused time
- [ ] **A computer** with internet access
- [ ] **Your repository** pushed to GitHub

**Optional:**
- Google account (if you want Google OAuth login)
- Custom domain (for production)

---

## Step 1: MongoDB Atlas Setup

### 1.1 Create Account & Cluster

1. **Go to MongoDB Atlas**  
   🔗 [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)

2. **Sign up** with Google/GitHub or email

3. **Create a Free Cluster**
   - Click **"Build a Database"**
   - Select **M0 Free** tier (512 MB storage)
   - Choose **Cloud Provider**: AWS (recommended)
   - Choose **Region**: Closest to your users (e.g., `us-east-1` for US East Coast)
   - **Cluster Name**: `papers2code-cluster` (or your choice)
   - Click **"Create"**
   
   ⏱️ Wait 3-5 minutes for cluster to provision

### 1.2 Create Database User

1. When prompted, or go to **Database Access** (left sidebar)
2. Click **"Add New Database User"**
3. **Authentication Method**: Password
4. **Username**: `papers2code_admin` (save this!)
5. **Password**: Click "Autogenerate Secure Password" (save this securely!)
   - Or create your own strong password (16+ characters, mixed case, numbers, symbols)
6. **Database User Privileges**: "Read and write to any database"
7. Click **"Add User"**

**⚠️ IMPORTANT**: Save your username and password - you'll need them for the connection string!

### 1.3 Configure Network Access

1. Go to **Network Access** (left sidebar)
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** button
   - This adds `0.0.0.0/0` to allow connections from Render
   - Don't worry - your database is still protected by username/password
4. Click **"Confirm"**

### 1.4 Get Connection String

1. Go to **Database** → Click **"Connect"** button
2. Select **"Connect your application"**
3. **Driver**: Python
4. **Version**: 3.12 or later
5. **Copy** the connection string:
   ```
   mongodb+srv://papers2code_admin:<password>@papers2code-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

6. **Modify** the connection string:
   - Replace `<password>` with your actual password from step 1.2
   - Add `/papers2code` before the `?` to specify the database name:
   
   ```
   mongodb+srv://papers2code_admin:YOUR_ACTUAL_PASSWORD@papers2code-cluster.xxxxx.mongodb.net/papers2code?retryWrites=true&w=majority
   ```

7. **Save this connection string** - you'll add it to Render in Step 5!

**Example of a complete connection string:**
```
mongodb+srv://papers2code_admin:MySecureP@ssw0rd123@papers2code-cluster.abc123.mongodb.net/papers2code?retryWrites=true&w=majority
```

### 1.5 Create Search Index (Optional but Recommended)

For advanced paper search functionality:

1. In Atlas, go to your cluster
2. Click on **"Search"** tab
3. Click **"Create Search Index"**
4. Choose **"JSON Editor"**
5. **Configuration**:
   - **Database**: `papers2code`
   - **Collection**: `papers`
   - **Index Name**: `papers_index`

6. **Paste this JSON configuration:**

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
      },
      "venue": {
        "type": "string",
        "analyzer": "lucene.keyword"
      }
    }
  }
}
```

7. Click **"Create Search Index"**
8. Wait for index to build (shows "Active" when ready)

---

## Step 2: Generate Security Keys

You need to generate two security keys **before** deploying to Render.

### 2.1 Generate FLASK_SECRET_KEY

**On your local machine**, open terminal and run:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Output example:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Save this key** - you'll add it to Render as `FLASK_SECRET_KEY`

### 2.2 Generate TOKEN_ENCRYPTION_KEY

**In the same terminal**, run:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Output example:**
```
xK3ZqP8vN2mW9jL5sT7rY4hG6uB1nM0cV8dF3kQ5wE2aZ9xR7yU4iO6pA2sD1fG=
```

**Save this key** - you'll add it to Render as `TOKEN_ENCRYPTION_KEY`

**⚠️ CRITICAL**: These keys must be kept secret. Never commit them to Git or share them publicly!

---

## Step 3: Deploy to Render

### 3.1 Sign Up for Render

1. **Go to Render**  
   🔗 [render.com](https://render.com)

2. Click **"Get Started"** or **"Sign Up"**

3. **Sign up with GitHub** (recommended)
   - Click "GitHub" button
   - Authorize Render to access your repositories
   - You can limit access to specific repositories

### 3.2 Deploy Using Blueprint

1. **From Render Dashboard**:
   - Click **"New +"** (top right)
   - Select **"Blueprint"**

2. **Connect Repository**:
   - If not already connected, click **"Connect GitHub"**
   - Search for `Papers2Code` repository
   - Click **"Connect"**

3. **Review Blueprint**:
   - Render automatically detects `render.yaml`
   - You'll see 2 services:
     - **papers2code-api** (Web Service - Python)
     - **papers2code-frontend** (Static Site)
   
4. **Blueprint Name**: `papers2code` (or your choice)

5. **Click "Apply"**

⏱️ Render will now create both services. This takes 2-3 minutes.

**⚠️ The services will fail initially** - this is normal! We need to add environment variables.

---

## Step 4: GitHub OAuth Setup

You need to create a GitHub OAuth application for user authentication.

### 4.1 Get Your Render URLs First

Before creating the OAuth app, you need your Render URLs:

1. In Render Dashboard, click on **"papers2code-api"**
2. Look for the URL at the top (e.g., `https://papers2code-api.onrender.com`)
3. **Copy this URL** - this is your **BACKEND_URL**

4. Go back to Dashboard, click on **"papers2code-frontend"**
5. Look for the URL at the top (e.g., `https://papers2code.onrender.com`)
6. **Copy this URL** - this is your **FRONTEND_URL**

### 4.2 Create GitHub OAuth App

1. **Go to GitHub Developer Settings**  
   🔗 [github.com/settings/developers](https://github.com/settings/developers)

2. Click **"New OAuth App"** (or "Register a new application")

3. **Fill in the form**:

   ```
   Application name: Papers2Code
   
   Homepage URL: https://papers2code.onrender.com
   (Use your FRONTEND_URL from above)
   
   Application description: Research paper tracking and implementation
   (Optional but recommended)
   
   Authorization callback URL: https://papers2code-api.onrender.com/api/auth/github/callback
   (Use your BACKEND_URL + /api/auth/github/callback)
   ```

4. Click **"Register application"**

5. **Save Your Credentials**:
   - **Client ID**: Copy this (e.g., `Iv1.a1b2c3d4e5f6g7h8`)
   - **Client Secret**: Click "Generate a new client secret"
     - Copy the secret immediately (you won't see it again!)
     - Example: `abc123def456ghi789jkl012mno345pqr678stu901`

**⚠️ IMPORTANT**: Save both Client ID and Client Secret - you'll add them to Render!

---

## Step 5: Configure Environment Variables

Now add all the required environment variables to Render.

### 5.1 Configure Backend Service

1. **In Render Dashboard**, click on **"papers2code-api"**
2. Go to **"Environment"** (left sidebar)
3. Click **"Add Environment Variable"** and add each of these:

#### Required Variables

| Key | Value | Notes |
|-----|-------|-------|
| `MONGO_CONNECTION_STRING` | Your MongoDB connection string from Step 1.4 | The full string with username, password, and database name |
| `TOKEN_ENCRYPTION_KEY` | Your generated key from Step 2.2 | Keep this secret! |
| `GITHUB_CLIENT_ID` | Your GitHub OAuth Client ID from Step 4.2 | Example: `Iv1.a1b2c3d4e5f6g7h8` |
| `GITHUB_CLIENT_SECRET` | Your GitHub OAuth Client Secret from Step 4.2 | Keep this secret! |
| `OWNER_GITHUB_USERNAME` | Your GitHub username | This gives you admin privileges |

**Example:**
```
Key: MONGO_CONNECTION_STRING
Value: mongodb+srv://papers2code_admin:MySecureP@ssw0rd123@papers2code-cluster.abc123.mongodb.net/papers2code?retryWrites=true&w=majority

Key: TOKEN_ENCRYPTION_KEY
Value: xK3ZqP8vN2mW9jL5sT7rY4hG6uB1nM0cV8dF3kQ5wE2aZ9xR7yU4iO6pA2sD1fG=

Key: GITHUB_CLIENT_ID
Value: Iv1.a1b2c3d4e5f6g7h8

Key: GITHUB_CLIENT_SECRET
Value: abc123def456ghi789jkl012mno345pqr678stu901

Key: OWNER_GITHUB_USERNAME
Value: yourusername
```

4. **Click "Save Changes"**

**Note**: `FLASK_SECRET_KEY` and `FRONTEND_URL` are automatically generated/linked by Render!

#### Optional Variables (for Google OAuth)

If you want to enable Google login, add these:

| Key | Value | Notes |
|-----|-------|-------|
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret | Keep this secret! |

To get Google OAuth credentials:
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://papers2code-api.onrender.com/api/auth/google/callback`

### 5.2 Verify Frontend Environment Variables

1. **In Render Dashboard**, click on **"papers2code-frontend"**
2. Go to **"Environment"** (left sidebar)
3. Verify that `VITE_API_BASE_URL` is automatically set
   - It should link to your backend service
   - Value should be: `https://papers2code-api.onrender.com`

If it's not set automatically:
1. Click **"Add Environment Variable"**
2. Key: `VITE_API_BASE_URL`
3. Value: Your backend URL (e.g., `https://papers2code-api.onrender.com`)

### 5.3 Trigger Redeployment

After adding all environment variables:

1. **Backend**: Click **"Manual Deploy"** → **"Deploy latest commit"**
2. **Frontend**: Click **"Manual Deploy"** → **"Deploy latest commit"**

⏱️ Wait 5-7 minutes for both services to build and deploy.

---

## Step 6: Verify Deployment

### 6.1 Check Backend Health

1. **Open your backend URL in browser**:
   ```
   https://papers2code-api.onrender.com/health
   ```

2. **You should see JSON response**:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "timestamp": "2025-01-15T10:30:00Z"
   }
   ```

3. **Check API Documentation**:
   ```
   https://papers2code-api.onrender.com/docs
   ```
   You should see the interactive API documentation (Swagger UI)

### 6.2 Check Frontend

1. **Open your frontend URL in browser**:
   ```
   https://papers2code.onrender.com
   ```

2. **You should see**:
   - Papers2Code homepage
   - Navigation bar
   - Search functionality
   - Paper listings

### 6.3 Test GitHub Login

1. **On the frontend**, click **"Sign In with GitHub"**
2. You'll be redirected to GitHub
3. Authorize the application
4. You should be redirected back and logged in
5. Your username should appear in the navigation

**If login fails**, check the logs (Step 7.2)

---

## Step 7: Testing & Troubleshooting

### 7.1 Common Issues

#### Issue: Backend Health Check Fails

**Symptoms**: `/health` endpoint returns 503 or error

**Solutions**:
1. Check Render logs: Dashboard → papers2code-api → Logs
2. Verify `MONGO_CONNECTION_STRING` is correct
3. Check MongoDB Atlas allows 0.0.0.0/0 in Network Access
4. Ensure database user has correct permissions

#### Issue: GitHub OAuth Fails

**Symptoms**: Login redirects but shows error

**Solutions**:
1. Verify GitHub OAuth callback URL matches:
   ```
   https://papers2code-api.onrender.com/api/auth/github/callback
   ```
2. Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correct
3. Ensure no extra spaces in environment variables
4. Check backend logs for authentication errors

#### Issue: Frontend Can't Connect to Backend

**Symptoms**: Papers don't load, network errors in console

**Solutions**:
1. Check `VITE_API_BASE_URL` is set correctly in frontend
2. Open browser console (F12) and check for CORS errors
3. Verify backend is running (check /health endpoint)
4. Check that frontend `VITE_API_BASE_URL` matches backend URL exactly

#### Issue: CORS Errors

**Symptoms**: "No 'Access-Control-Allow-Origin' header" in console

**Solutions**:
1. Backend logs should show the `FRONTEND_URL`
2. Verify `FRONTEND_URL` environment variable in backend
3. It should automatically be set by Render from the `render.yaml`
4. Manually set if needed:
   ```
   Key: FRONTEND_URL
   Value: https://papers2code.onrender.com
   ```

### 7.2 View Logs

**Backend Logs**:
1. Dashboard → papers2code-api → **"Logs"** tab
2. Look for errors marked with `ERROR` or `WARNING`
3. Common things to check:
   - Database connection errors
   - Authentication errors
   - Environment variable missing errors

**Frontend Build Logs**:
1. Dashboard → papers2code-frontend → **"Events"** tab
2. Click on latest deployment
3. View build logs for any npm errors

### 7.3 Test Checklist

- [ ] Backend `/health` endpoint returns healthy status
- [ ] Backend `/docs` shows API documentation
- [ ] Frontend loads successfully
- [ ] GitHub login redirects to GitHub
- [ ] After authorization, user is logged in
- [ ] Can search for papers
- [ ] Can view paper details
- [ ] Can vote on papers (when logged in)
- [ ] Browser console has no errors

---

## Step 8: Going to Production

### 8.1 Upgrade to Always-On Backend

The free tier puts your backend to sleep after 15 minutes of inactivity. This causes:
- **Cold starts**: First request takes 30-60 seconds
- **Poor user experience** for low-traffic periods

**To upgrade to always-on ($7/month)**:

1. Dashboard → papers2code-api → **"Settings"**
2. Scroll to **"Instance Type"**
3. Change from **"Free"** to **"Starter"** ($7/month)
4. Click **"Save Changes"**

**Benefits**:
- ✅ Zero cold starts
- ✅ Better performance
- ✅ More reliable for users
- ✅ Still very affordable

### 8.2 Add Custom Domain

**For Frontend**:
1. Dashboard → papers2code-frontend → **"Settings"**
2. Scroll to **"Custom Domain"**
3. Click **"Add Custom Domain"**
4. Enter your domain: `papers2code.com`
5. Follow DNS instructions:
   - Add CNAME record: `papers2code.com` → `papers2code.onrender.com`
6. Wait for SSL certificate (automatic, takes 5-10 minutes)

**For Backend (Optional)**:
1. Dashboard → papers2code-api → **"Settings"**
2. Add custom domain: `api.papers2code.com`
3. Update GitHub OAuth callback URL
4. Update frontend `VITE_API_BASE_URL`

### 8.3 Enable Auto-Deploy

Render automatically deploys when you push to GitHub (already enabled by default).

**To disable auto-deploy**:
1. Dashboard → Service → **"Settings"**
2. Scroll to **"Build & Deploy"**
3. Toggle **"Auto-Deploy"** off

**To manually deploy**:
1. Dashboard → Service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

### 8.4 Set Up Notifications

Get notified of deployment failures:

1. Dashboard → Account Settings → **"Notifications"**
2. Enable email notifications
3. Add webhook for Slack/Discord (optional)

---

## Step 9: Monitoring & Maintenance

### 9.1 Monitor Service Health

**Render Dashboard provides**:
- **Metrics**: CPU, Memory, Bandwidth usage
- **Logs**: Real-time application logs
- **Events**: Deployment history

**Check regularly**:
1. Dashboard → Service → **"Metrics"** tab
2. Look for:
   - High CPU usage (might need upgrade)
   - High memory usage (might need optimization)
   - Deployment failures

### 9.2 Database Monitoring

**MongoDB Atlas Dashboard**:
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Click on your cluster
3. View **"Metrics"** tab
4. Monitor:
   - Storage usage (free tier: 512 MB)
   - Connection count
   - Query performance

**Set up alerts**:
1. Atlas → Alerts → **"Add Alert"**
2. Alert on:
   - Storage > 80% full
   - High connection count
   - Slow queries

### 9.3 Backup Your Database

**MongoDB Atlas Backups** (Paid feature):
- Available on M10+ clusters ($9+/month)
- Automatic continuous backups
- Point-in-time recovery

**Manual Backups** (Free):
```bash
# Install MongoDB tools
brew install mongodb-database-tools  # macOS
# or: apt-get install mongodb-database-tools  # Linux

# Export database
mongodump --uri="mongodb+srv://papers2code_admin:PASSWORD@cluster.mongodb.net/papers2code" --out=./backup

# Import database (restore)
mongorestore --uri="mongodb+srv://papers2code_admin:PASSWORD@cluster.mongodb.net/papers2code" ./backup/papers2code
```

**Recommendation**: Backup monthly or before major updates.

### 9.4 Update Dependencies

**Backend**:
```bash
# Update dependencies locally
uv sync --upgrade

# Test locally
uv run run_app2.py

# If working, commit and push
git add uv.lock pyproject.toml
git commit -m "Update backend dependencies"
git push

# Render will auto-deploy
```

**Frontend**:
```bash
# Update dependencies
cd papers2code-ui
npm update

# Test locally
npm run dev

# If working, commit and push
git add package-lock.json package.json
git commit -m "Update frontend dependencies"
git push

# Render will auto-deploy
```

### 9.5 Security Updates

**Set calendar reminders**:
- **Monthly**: Check for security updates
- **Quarterly**: Review MongoDB Atlas security
- **Yearly**: Rotate secrets (FLASK_SECRET_KEY, OAuth secrets)

**When rotating secrets**:
1. Generate new keys (Step 2)
2. Update in Render environment variables
3. Redeploy services
4. Monitor logs for issues

---

## 📊 Cost Summary

| Service | Free Tier | Paid Tier | Recommended |
|---------|-----------|-----------|-------------|
| **Backend** | Free (sleeps after 15 min) | $7/month (Starter) | Paid for production |
| **Frontend** | Free (always on) | Free | Free |
| **MongoDB Atlas** | Free M0 (512 MB) | $9/month (M2) - $57/month (M10) | Free for small apps |
| **Total** | **$0/month** | **$7-16/month** | **$7/month** |

**Free Tier Limits**:
- Backend: Sleeps after 15 min inactivity, 750 hours/month
- Frontend: Unlimited bandwidth, 100 GB/month
- MongoDB: 512 MB storage, shared cluster

**Production Setup** ($7/month):
- Backend Starter: Always-on, better performance
- Frontend: Still free
- MongoDB M0: Still free (upgrade to M2 if you need more storage)

---

## 🎉 Congratulations!

Your Papers2Code application is now **live and accessible to the world**!

### What You've Accomplished

✅ Deployed a full-stack application (FastAPI + React)  
✅ Set up MongoDB Atlas database  
✅ Configured GitHub OAuth authentication  
✅ Automated deployments from Git  
✅ Added security best practices  
✅ Created a production-ready system  

### Next Steps

1. **Test thoroughly** with real users
2. **Monitor logs** for any issues
3. **Share your app** with the research community
4. **Gather feedback** and iterate
5. **Consider upgrading** to always-on backend

### Getting Help

**Issues with this guide?**
- Check [Render Documentation](https://render.com/docs)
- Open an issue on [GitHub](https://github.com/RyanKim17920/Papers2Code/issues)

**Issues with the application?**
- Check application logs in Render dashboard
- Review MongoDB Atlas metrics
- Test locally first to isolate issues

### Share Your Success

If this guide helped you, consider:
- ⭐ Starring the repository on GitHub
- 📝 Contributing improvements to this guide
- 🐦 Sharing your deployment on social media

---

## 📚 Additional Resources

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **MongoDB Atlas**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **FastAPI**: [fastapi.tiangolo.com](https://fastapi.tiangolo.com)
- **React + Vite**: [vitejs.dev](https://vitejs.dev)
- **GitHub OAuth**: [docs.github.com/en/developers/apps](https://docs.github.com/en/developers/apps)

---

**Built with ❤️ for the research community**

*Last updated: January 2025*
