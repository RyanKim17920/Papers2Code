# Complete Vercel + Render Deployment Guide

This guide provides detailed instructions for deploying Papers2Code with:
- **Frontend**: Vercel (React/Vite application) - Best-in-class CDN
- **Backend**: Render (FastAPI application) - Native Python/uv support
- **Database**: MongoDB Atlas (Free tier)

## 🎯 Why This Setup?

**Perfect if you:**
- ✅ Already have your domain on Vercel
- ✅ Want Vercel's superior frontend CDN (40+ edge locations)
- ✅ Need Render's reliable Python backend hosting
- ✅ Want to keep DNS management on Vercel
- ✅ Prefer splitting frontend and backend for independent scaling

**Advantages:**
- **Vercel Frontend**: Unlimited bandwidth (free), 40+ edge locations, instant deployments
- **Render Backend**: Native Python/uv support, $7/month always-on, simple scaling
- **Clean Separation**: Frontend at `yourdomain.com`, backend at `api-yourdomain.onrender.com`
- **Best of Both**: Vercel's CDN performance + Render's Python expertise

## 📋 Architecture Overview

```
┌─────────────┐      HTTPS      ┌──────────────┐      HTTPS      ┌─────────────┐
│   Browser   │ ──────────────> │   Vercel     │ ──────────────> │   Render    │
│             │                 │  (Frontend)  │                 │  (Backend)  │
│             │                 │ yourdomain   │                 │   FastAPI   │
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

## ⏱️ Time Required

- **Total Setup Time**: 20-25 minutes
- **MongoDB Setup**: 5 minutes
- **Security Keys**: 2 minutes
- **Render Backend**: 8 minutes
- **Vercel Frontend**: 5 minutes
- **GitHub OAuth**: 3 minutes
- **Testing**: 2 minutes

---

## 📚 Table of Contents

1. [Prerequisites](#step-1-prerequisites)
2. [MongoDB Atlas Setup](#step-2-mongodb-atlas-setup)
3. [Generate Security Keys](#step-3-generate-security-keys)
4. [Deploy Backend to Render](#step-4-deploy-backend-to-render)
5. [Deploy Frontend to Vercel](#step-5-deploy-frontend-to-vercel)
6. [GitHub OAuth Setup](#step-6-github-oauth-setup)
7. [Connect Your Domain](#step-7-connect-your-domain-vercel)
8. [Final Configuration](#step-8-final-configuration)
9. [Verify Deployment](#step-9-verify-deployment)
10. [Troubleshooting](#step-10-troubleshooting)

---

## Step 1: Prerequisites

Before you start, ensure you have:

- [ ] **GitHub Account** (for repository and OAuth)
- [ ] **Vercel Account** (free - we'll create/use existing)
- [ ] **Render Account** (free - we'll create)
- [ ] **Domain on Vercel** (your existing domain)
- [ ] **20-25 minutes** of focused time

**What you'll create during setup:**
- MongoDB Atlas account (free)
- GitHub OAuth application
- Security keys

---

## Step 2: MongoDB Atlas Setup

### 2.1 Create MongoDB Atlas Cluster

1. **Go to MongoDB Atlas**  
   🔗 [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)

2. **Sign up** with Google/GitHub or email

3. **Create a Free Cluster**
   - Click **"Build a Database"**
   - Select **M0 Free** tier (512 MB storage)
   - Choose **Cloud Provider**: AWS (recommended)
   - Choose **Region**: Closest to Render backend (e.g., `us-east-1` or `us-west-2`)
   - **Cluster Name**: `papers2code-cluster`
   - Click **"Create"**
   
   ⏱️ Wait 3-5 minutes for cluster to provision

### 2.2 Create Database User

1. In Atlas dashboard, go to **Database Access**
2. Click **"Add New Database User"**
3. **Username**: `papers2code_admin` (save this!)
4. **Password**: Click "Autogenerate Secure Password" and **save it securely**
5. **Privileges**: "Read and write to any database"
6. Click **"Add User"**

### 2.3 Configure Network Access

1. Go to **Network Access**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - This allows Render to connect
   - Your database is protected by username/password
4. Click **"Confirm"**

### 2.4 Get Connection String

1. Go to **Database** → **Connect** → **Connect your application**
2. **Driver**: Python, **Version**: 3.12 or later
3. Copy the connection string:
   ```
   mongodb+srv://papers2code_admin:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
   ```

4. **Modify it**:
   - Replace `<password>` with your actual password
   - Add `/papers2code` before the `?`:
   ```
   mongodb+srv://papers2code_admin:YOUR_PASSWORD@cluster.mongodb.net/papers2code?retryWrites=true&w=majority
   ```

5. **Save this** - you'll need it for Render!

### 2.5 Create Search Index (Optional but Recommended)

1. In Atlas, click your cluster → **Search** tab
2. Click **"Create Search Index"**
3. Choose **"JSON Editor"**
4. **Index Name**: `papers_index`
5. **Database**: `papers2code`, **Collection**: `papers`
6. Paste this configuration:

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

7. Click **"Create Search Index"**

---

## Step 3: Generate Security Keys

Run these commands **on your local machine** and save the output:

### 3.1 FLASK_SECRET_KEY

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Output example:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`

**Save this** - you'll add it to Render!

### 3.2 TOKEN_ENCRYPTION_KEY

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Output example:** `xK3ZqP8vN2mW9jL5sT7rY4hG6uB1nM0cV8dF3kQ5wE2aZ9xR7yU4iO6pA2sD1fG=`

**Save this** - you'll add it to Render!

⚠️ **Keep these keys secret!** Never commit them to Git.

---

## Step 4: Deploy Backend to Render

### 4.1 Sign Up for Render

1. Go to [render.com](https://render.com)
2. Click **"Get Started"** → **"Sign Up with GitHub"**
3. Authorize Render to access your repositories
4. You can limit access to just the Papers2Code repository

### 4.2 Create Web Service

1. From Render Dashboard, click **"New +"** → **"Web Service"**
2. **Connect Repository**:
   - Find your `Papers2Code` repository
   - Click **"Connect"**

3. **Configure Service**:
   - **Name**: `papers2code-api` (or your choice)
   - **Region**: Oregon (or closest to you)
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave blank
   - **Runtime**: Python 3
   - **Build Command**: `pip install uv && uv sync`
   - **Start Command**: `uv run run_app2.py`
   - **Plan**: Free (upgrade to Starter $7/mo for always-on)

4. Click **"Advanced"** to add environment variables

### 4.3 Add Environment Variables

Click **"Add Environment Variable"** and add each of these:

| Key | Value | Notes |
|-----|-------|-------|
| `ENV_TYPE` | `production` | |
| `PORT` | `5000` | |
| `MONGO_CONNECTION_STRING` | Your MongoDB connection string from Step 2.4 | Paste the full string |
| `FLASK_SECRET_KEY` | Your generated key from Step 3.1 | 64 characters |
| `TOKEN_ENCRYPTION_KEY` | Your generated key from Step 3.2 | 44 characters |
| `GITHUB_CLIENT_ID` | (Leave empty for now) | Add after Step 6 |
| `GITHUB_CLIENT_SECRET` | (Leave empty for now) | Add after Step 6 |
| `OWNER_GITHUB_USERNAME` | Your GitHub username | e.g., `yourusername` |
| `APP_LOG_LEVEL` | `INFO` | |
| `FRONTEND_URL` | (Leave empty for now) | Add after Step 5 |

5. Click **"Create Web Service"**

### 4.4 Get Your Render Backend URL

1. Wait for deployment to complete (5-7 minutes)
2. Check the **Logs** tab for any errors
3. Once deployed, copy your backend URL from the top:
   - Format: `https://papers2code-api.onrender.com`
   - **Save this** - you'll need it for Vercel and GitHub OAuth!

4. Test the backend:
   ```
   https://papers2code-api.onrender.com/health
   ```
   Should return: `{"status": "healthy"}`

---

## Step 5: Deploy Frontend to Vercel

### 5.1 Sign In to Vercel

1. Go to [vercel.com](https://vercel.com)
2. **Sign in** with your existing Vercel account (where your domain is)

### 5.2 Import Project

1. Click **"Add New..."** → **"Project"**
2. **Import Git Repository**:
   - Find your `Papers2Code` repository
   - Click **"Import"**

3. **Configure Project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `cd papers2code-ui && npm install && npm run build`
   - **Output Directory**: `papers2code-ui/dist`
   - **Install Command**: `npm install --prefix papers2code-ui`

### 5.3 Add Environment Variables

1. Expand **"Environment Variables"**
2. Add this variable:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_API_BASE_URL` | Your Render backend URL (e.g., `https://papers2code-api.onrender.com`) | Production, Preview, Development |

**Important**: Use your actual Render URL from Step 4.4!

3. Click **"Deploy"**

### 5.4 Get Your Vercel Frontend URL

1. Wait for build to complete (2-3 minutes)
2. Vercel will provide a URL like: `https://papers2code.vercel.app`
3. **Save this** - you'll update your domain next!

---

## Step 6: GitHub OAuth Setup

### 6.1 Create GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **"New OAuth App"** (or "Register a new application")

3. **Fill in the form**:
   ```
   Application name: Papers2Code
   
   Homepage URL: https://yourdomain.com
   (Use your Vercel domain from Step 7, or temporary Vercel URL for now)
   
   Application description: Research paper tracking and implementation
   (Optional but recommended)
   
   Authorization callback URL: https://papers2code-api.onrender.com/api/auth/github/callback
   (Use your Render backend URL from Step 4.4)
   ```

4. Click **"Register application"**

5. **Save Your Credentials**:
   - **Client ID**: Copy this (e.g., `Iv1.a1b2c3d4e5f6g7h8`)
   - **Client Secret**: Click "Generate a new client secret"
     - Copy immediately (you won't see it again!)
     - Example: `abc123def456ghi789jkl012mno345pqr678stu901`

### 6.2 Update Render Environment Variables

1. Go back to Render Dashboard → Your backend service
2. Go to **Environment** tab
3. **Edit** these variables:
   - `GITHUB_CLIENT_ID`: Paste your Client ID
   - `GITHUB_CLIENT_SECRET`: Paste your Client Secret
4. Click **"Save Changes"**
5. Service will automatically redeploy (wait 2-3 minutes)

---

## Step 7: Connect Your Domain (Vercel)

Since you already have your domain on Vercel, let's connect it to your frontend.

### 7.1 Add Domain to Project

1. In Vercel, go to your project → **Settings** → **Domains**
2. **Add Domain**:
   - Enter your domain: `yourdomain.com`
   - Click **"Add"**

3. If domain is already on Vercel:
   - It should auto-configure
   - Wait for SSL certificate (automatic, 5-10 minutes)

4. **Optional subdomain**:
   - Add `www.yourdomain.com` if desired
   - Vercel will handle www redirect automatically

### 7.2 Update GitHub OAuth Homepage

1. Go back to [github.com/settings/developers](https://github.com/settings/developers)
2. Click on your **Papers2Code** OAuth app
3. Update **Homepage URL** to: `https://yourdomain.com`
4. Click **"Update application"**

---

## Step 8: Final Configuration

### 8.1 Update Render FRONTEND_URL

1. Go to Render Dashboard → Your backend service
2. Go to **Environment** tab
3. **Add/Edit** variable:
   - Key: `FRONTEND_URL`
   - Value: `https://yourdomain.com` (or your Vercel domain)
4. Click **"Save Changes"**
5. Wait for redeploy (2-3 minutes)

### 8.2 Verify CORS Configuration

The backend should now accept requests from your Vercel frontend because `FRONTEND_URL` is set.

---

## Step 9: Verify Deployment

### 9.1 Test Backend

1. **Health Check**:
   ```
   https://papers2code-api.onrender.com/health
   ```
   Should return:
   ```json
   {
     "status": "healthy",
     "database": "connected"
   }
   ```

2. **API Documentation**:
   ```
   https://papers2code-api.onrender.com/docs
   ```
   Should show Swagger UI

### 9.2 Test Frontend

1. **Visit your domain**:
   ```
   https://yourdomain.com
   ```
   Should show Papers2Code homepage

2. **Check Browser Console** (F12):
   - No CORS errors
   - API calls going to `papers2code-api.onrender.com`

### 9.3 Test GitHub Login

1. Click **"Sign In with GitHub"**
2. Authorize on GitHub
3. Should redirect back and log you in
4. Your username should appear in navigation

### 9.4 Test Full Functionality

- [ ] Search for papers works
- [ ] View paper details works
- [ ] Vote on papers works (when logged in)
- [ ] No errors in browser console
- [ ] Backend logs show no errors

---

## Step 10: Troubleshooting

### Issue: CORS Errors in Browser Console

**Symptoms**: `No 'Access-Control-Allow-Origin' header`

**Solutions**:
1. Verify `FRONTEND_URL` in Render matches your Vercel domain exactly
2. Check Render logs for CORS configuration
3. Ensure no trailing slashes in URLs
4. Redeploy backend after changing `FRONTEND_URL`

### Issue: GitHub OAuth Fails

**Symptoms**: Login redirects but shows error

**Solutions**:
1. Verify callback URL in GitHub app:
   ```
   https://papers2code-api.onrender.com/api/auth/github/callback
   ```
2. Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in Render
3. Ensure no extra spaces in environment variables
4. Check backend logs for auth errors

### Issue: Frontend Can't Reach Backend

**Symptoms**: API calls fail, network errors

**Solutions**:
1. Verify `VITE_API_BASE_URL` in Vercel settings
2. Check Render backend is running (visit /health endpoint)
3. Ensure Render service is not sleeping (upgrade to Starter $7/mo)
4. Check backend logs for errors

### Issue: Database Connection Failed

**Symptoms**: Backend health check shows database error

**Solutions**:
1. Verify `MONGO_CONNECTION_STRING` in Render
2. Check MongoDB Atlas Network Access allows 0.0.0.0/0
3. Ensure database user has correct password
4. Test connection string format

### Issue: Render Backend Sleeps (Free Tier)

**Symptoms**: First request takes 30-60 seconds

**Solutions**:
1. This is normal on free tier (sleeps after 15 min)
2. Upgrade to Starter plan ($7/mo) for always-on
3. Or accept cold starts for development

### Issue: Custom Domain Not Working

**Symptoms**: Domain doesn't resolve or shows error

**Solutions**:
1. Wait for SSL certificate (can take 10-20 minutes)
2. Check DNS records in Vercel dashboard
3. Verify domain is added to project in Vercel
4. Clear browser cache and try incognito mode

---

## 💰 Cost Breakdown

### Free Tier (Development)

| Service | Cost | Features |
|---------|------|----------|
| **Vercel Frontend** | $0 | Unlimited bandwidth, 40+ edge locations |
| **Render Backend** | $0 | 750 hours/month, sleeps after 15 min |
| **MongoDB Atlas** | $0 | 512 MB storage, M0 free tier |
| **Total** | **$0/month** | Perfect for testing and low traffic |

### Production Setup (Recommended)

| Service | Cost | Features |
|---------|------|----------|
| **Vercel Frontend** | $0 | Unlimited bandwidth (stays free!) |
| **Render Backend** | $7/month | Always-on, no cold starts, 512 MB RAM |
| **MongoDB Atlas** | $0 | 512 MB storage (upgrade to M2 at $9/mo if needed) |
| **Total** | **$7/month** | Production-ready |

### When to Upgrade

**Backend (Render):**
- Upgrade to Starter ($7/mo) immediately for production
- Eliminates cold starts
- Better for user experience

**Database (MongoDB):**
- Upgrade to M2 ($9/mo) when you exceed 512 MB storage
- Or M10 ($57/mo) for backups and better performance

**Frontend (Vercel):**
- Stays free even with high traffic!
- Upgrade to Pro ($20/mo) only if you need:
  - Advanced analytics
  - Password protection
  - Team features

---

## 📊 Scaling Path

### Small (0-1K users/day)
- **Cost**: $7/month
- **Vercel**: Free tier (unlimited bandwidth)
- **Render**: Starter plan ($7/mo, always-on)
- **MongoDB**: M0 free (512 MB)

### Medium (1K-10K users/day)
- **Cost**: $7-25/month
- **Vercel**: Still free! (unlimited bandwidth)
- **Render**: Standard plan ($25/mo, 2 GB RAM) if needed
- **MongoDB**: M0 or M2 ($9/mo) if more storage needed

### Large (10K+ users/day)
- **Cost**: $25-80/month
- **Vercel**: Still free or Pro ($20/mo for team features)
- **Render**: Standard+ plan ($25+/mo)
- **MongoDB**: M10 ($57/mo) for production features

**Key Advantage**: Vercel frontend stays free at any scale!

---

## 🔒 Security Checklist

- [ ] `FLASK_SECRET_KEY` is randomly generated (64 characters)
- [ ] `TOKEN_ENCRYPTION_KEY` is properly generated with Fernet
- [ ] MongoDB connection string uses strong password
- [ ] GitHub OAuth credentials are kept secret
- [ ] MongoDB Atlas allows 0.0.0.0/0 but requires password
- [ ] HTTPS is enabled on all services (automatic)
- [ ] CORS is properly configured (`FRONTEND_URL` matches)
- [ ] All environment variables are set in platform dashboards
- [ ] No secrets committed to Git

---

## 🎯 Advantages of This Setup

### Vercel Frontend
✅ **Unlimited bandwidth** (free forever)  
✅ **40+ edge locations** (fastest global performance)  
✅ **Instant deployments** (30 seconds)  
✅ **Auto-preview** for pull requests  
✅ **Domain management** already set up  

### Render Backend
✅ **Native Python/uv support** (no Docker needed)  
✅ **Simple scaling** (just upgrade plan)  
✅ **Always-on** for $7/month (no cold starts)  
✅ **Health checks** built in  
✅ **Easy logs** access  

### Clean Separation
✅ **Independent scaling** (scale backend without touching frontend)  
✅ **Independent deploys** (frontend/backend can deploy separately)  
✅ **Clear responsibility** (Vercel = CDN, Render = compute)  

---

## 📝 Post-Deployment

### Monitor Your Services

**Render:**
- Dashboard → Your service → **Metrics**
- Check CPU, Memory usage
- View logs for errors

**Vercel:**
- Dashboard → Your project → **Analytics** (on Pro plan)
- Monitor deployment success rate
- Check build times

**MongoDB:**
- Atlas Dashboard → Metrics
- Monitor storage usage (free tier: 512 MB)
- Check connection count

### Update GitHub OAuth for Production

If you update your domain later:
1. Go to GitHub OAuth app settings
2. Update **Homepage URL** to new domain
3. Callback URL stays the same (Render backend)

### Backup Your Database

**Manual backup**:
```bash
# Install MongoDB tools
brew install mongodb-database-tools  # macOS

# Backup
mongodump --uri="your-mongo-connection-string" --out=./backup

# Restore
mongorestore --uri="your-mongo-connection-string" ./backup/papers2code
```

**Automated backups**: Available on MongoDB M10+ tiers ($57/mo)

---

## 🆘 Getting Help

### Platform-Specific Support

- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Render**: [render.com/docs](https://render.com/docs) (has live chat!)
- **MongoDB**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)

### Application Issues

- **GitHub Issues**: [github.com/RyanKim17920/Papers2Code/issues](https://github.com/RyanKim17920/Papers2Code/issues)
- Check Render logs for backend errors
- Check browser console for frontend errors

---

## 🎉 Congratulations!

Your Papers2Code application is now deployed with:
- ✅ **Frontend on Vercel** (your domain, unlimited bandwidth)
- ✅ **Backend on Render** (Python/uv, $7/mo always-on)
- ✅ **MongoDB Atlas** (free tier, 512 MB)
- ✅ **GitHub OAuth** (user authentication)
- ✅ **HTTPS everywhere** (automatic)
- ✅ **Auto-deployments** (push to GitHub)

**Your URLs:**
- Frontend: `https://yourdomain.com`
- Backend: `https://papers2code-api.onrender.com`
- API Docs: `https://papers2code-api.onrender.com/docs`

**Total Cost**: $0 (development) or $7/month (production)

---

## 📚 Next Steps

1. **Test thoroughly** with real users
2. **Monitor** Render backend performance
3. **Upgrade** to Starter ($7/mo) when ready for production
4. **Set up** automated backups for MongoDB (when on paid tier)
5. **Share** your app with the research community!

---

**Need the quick version?** See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

**Prefer single platform?** See [RENDER_COMPLETE_GUIDE.md](./RENDER_COMPLETE_GUIDE.md)

**Questions?** Open an issue on [GitHub](https://github.com/RyanKim17920/Papers2Code/issues)
