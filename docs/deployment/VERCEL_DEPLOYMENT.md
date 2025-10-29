# Vercel Deployment Guide

## Overview

This guide covers deploying Papers2Code on Vercel. Due to the architecture of the application, we use a **hybrid deployment approach**:

- **Frontend (React/Vite)**: Deployed on Vercel ✅
- **Backend (FastAPI)**: Deployed on Render, Railway, or similar platform ✅

## Why Hybrid Deployment?

### Vercel's Strengths
- ✅ Excellent for static sites and frontend frameworks (React, Vue, Next.js)
- ✅ Global CDN and edge network
- ✅ Automatic HTTPS and SSL certificates
- ✅ Great CI/CD integration with GitHub
- ✅ Free tier with generous limits for frontend hosting

### Vercel's Limitations for Our Backend
- ❌ Serverless functions have 10-second timeout (Hobby) / 60-second timeout (Pro)
- ❌ Not ideal for long-running FastAPI applications
- ❌ Complex to adapt stateful web servers to serverless
- ❌ Limited support for Python web frameworks compared to Node.js

### Our Solution
Deploy frontend on Vercel (optimal) + backend on Render/Railway (optimal for FastAPI)

---

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Backend Deployed**: Deploy your FastAPI backend first (see [Backend Deployment](#backend-deployment))
4. **MongoDB Atlas**: Set up as per [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Part 1: Deploy Backend (FastAPI)

### Option A: Deploy on Render (Recommended)

Render is excellent for Python web applications and offers a generous free tier.

1. **Create Render Account**: [render.com](https://render.com)

2. **Create Web Service**:
   - Go to Dashboard → New → Web Service
   - Connect your GitHub repository
   - Configure:
     - **Name**: `papers2code-api`
     - **Environment**: `Python 3`
     - **Build Command**: `pip install uv && uv sync`
     - **Start Command**: `uv run run_app2.py`

3. **Set Environment Variables** in Render Dashboard:
   ```bash
   ENV_TYPE=production
   PORT=5000
   MONGO_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/papers2code
   FLASK_SECRET_KEY=<generate-random-secure-key>
   GITHUB_CLIENT_ID=<your-github-oauth-id>
   GITHUB_CLIENT_SECRET=<your-github-oauth-secret>
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   FRONTEND_URL=https://your-app.vercel.app
   ```

4. **Deploy** and note your backend URL (e.g., `https://papers2code-api.onrender.com`)

### Option B: Deploy on Railway

Railway is another great option for Python applications.

1. **Create Railway Account**: [railway.app](https://railway.app)

2. **Create New Project**:
   - Connect GitHub repository
   - Railway auto-detects Python

3. **Set Environment Variables**:
   ```bash
   ENV_TYPE=production
   MONGO_CONNECTION_STRING=mongodb+srv://...
   FLASK_SECRET_KEY=<generate-random-key>
   GITHUB_CLIENT_ID=<your-github-oauth-id>
   GITHUB_CLIENT_SECRET=<your-github-oauth-secret>
   FRONTEND_URL=https://your-app.vercel.app
   ```

4. **Deploy** and note your backend URL

---

## Part 2: Deploy Frontend on Vercel

### Step 1: Prepare Repository

The repository is already configured with `vercel.json` at the root level.

**Key Files**:
- `/vercel.json` - Vercel configuration
- `/.vercelignore` - Files to exclude from deployment
- `/papers2code-ui/.env.example` - Environment variable template

### Step 2: Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard (Easiest)

1. **Go to Vercel Dashboard**: [vercel.com/dashboard](https://vercel.com/dashboard)

2. **Import Project**:
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect the configuration from `vercel.json`

3. **Configure Project**:
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: Uses vercel.json config
   - **Output Directory**: Uses vercel.json config

4. **Set Environment Variables**:
   - Click "Environment Variables"
   - Add:
     ```
     Name: VITE_API_BASE_URL
     Value: https://your-backend-api.onrender.com
     ```
     (Use your actual backend URL from Part 1)

5. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete (~2-3 minutes)
   - Your app will be live at `https://your-project.vercel.app`

#### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   cd /path/to/Papers2Code
   vercel
   ```

4. **Set Environment Variables**:
   ```bash
   vercel env add VITE_API_BASE_URL production
   # Enter your backend URL when prompted
   ```

5. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

### Step 3: Update OAuth Callback URLs

After deployment, update your OAuth app settings:

#### GitHub OAuth App
1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Edit your app
3. Update:
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://your-backend-api.onrender.com/auth/github/callback`

#### Google OAuth App
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to "Credentials"
3. Edit your OAuth 2.0 Client ID
4. Update:
   - **Authorized JavaScript origins**: `https://your-app.vercel.app`
   - **Authorized redirect URIs**: `https://your-backend-api.onrender.com/auth/google/callback`

### Step 4: Update Backend Environment Variable

Update your backend's `FRONTEND_URL` environment variable:

**On Render**:
```bash
FRONTEND_URL=https://your-app.vercel.app
```

This ensures CORS and OAuth redirects work correctly.

---

## Post-Deployment Configuration

### 1. Test the Deployment

Visit your Vercel URL: `https://your-app.vercel.app`

Test the following:
- ✅ Frontend loads correctly
- ✅ API calls reach the backend
- ✅ GitHub OAuth login works
- ✅ Google OAuth login works
- ✅ Paper search and submission work
- ✅ User profile and dashboard load

### 2. Custom Domain (Optional)

Add a custom domain in Vercel:

1. Go to your project → Settings → Domains
2. Add your domain (e.g., `papers2code.com`)
3. Follow DNS configuration instructions
4. Update `FRONTEND_URL` in backend to your custom domain

### 3. Environment Variables Management

**View all environment variables**:
```bash
vercel env ls
```

**Add a new environment variable**:
```bash
vercel env add VARIABLE_NAME
```

**Remove an environment variable**:
```bash
vercel env rm VARIABLE_NAME
```

---

## Continuous Deployment

Vercel automatically deploys:
- **Production**: When you push to `main` branch
- **Preview**: For every pull request

### Branch Configuration

Configure in Vercel Dashboard → Settings → Git:
- **Production Branch**: `main` (or your default branch)
- **Preview Branches**: All branches (or specific patterns)

---

## Troubleshooting

### Frontend Not Loading
1. Check build logs in Vercel dashboard
2. Verify `vercel.json` configuration
3. Check if all dependencies are in `package.json`

### API Calls Failing
1. **Check CORS**: Ensure backend `FRONTEND_URL` matches your Vercel URL
2. **Check API URL**: Verify `VITE_API_BASE_URL` environment variable
3. **Check Network**: Open browser console and check network requests
4. **Test Backend**: `curl https://your-backend-api.onrender.com/health`

### OAuth Not Working
1. **GitHub/Google OAuth Callback URLs**: Must match your backend URL
2. **FRONTEND_URL**: Must match your Vercel frontend URL
3. **Cookies**: Ensure SameSite cookie settings are correct

### Build Failures
1. **Check Node version**: Vercel uses Node 18+ by default
2. **Check build command**: Verify in `vercel.json`
3. **Check dependencies**: Run `npm install` locally to test
4. **View logs**: Check deployment logs in Vercel dashboard

### Environment Variables Not Working
1. **Redeploy**: After adding env vars, trigger a new deployment
2. **Check scope**: Ensure variables are set for correct environment (production/preview)
3. **Check names**: Vite requires `VITE_` prefix for env vars

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                          │
│                  https://your-app.vercel.app                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  VERCEL CDN (Frontend)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React + Vite App (Static Files)                     │  │
│  │  • HTML, JS, CSS, Images                             │  │
│  │  • Global CDN Distribution                           │  │
│  │  • Auto HTTPS                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ API Requests
                         ↓
┌─────────────────────────────────────────────────────────────┐
│           RENDER/RAILWAY (Backend API)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FastAPI Application                                 │  │
│  │  • REST API Endpoints                                │  │
│  │  • OAuth Authentication                              │  │
│  │  • Business Logic                                    │  │
│  └──────────────────┬───────────────────────────────────┘  │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                  MongoDB Atlas                              │
│  • User Data                                                │
│  • Papers Database                                          │
│  • Implementation Progress                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Cost Breakdown

### Vercel (Frontend)
| Tier | Cost | Limits |
|------|------|--------|
| Hobby (Free) | $0/month | 100GB bandwidth, Unlimited deployments |
| Pro | $20/month | 1TB bandwidth, Advanced features |

### Render (Backend)
| Tier | Cost | Limits |
|------|------|--------|
| Free | $0/month | Sleeps after 15min inactivity |
| Starter | $7/month | Always on, 512MB RAM |
| Standard | $25/month | Always on, 2GB RAM |

### Railway (Alternative Backend)
| Tier | Cost | Limits |
|------|------|--------|
| Trial | $5 credit | Good for testing |
| Developer | $5/month + usage | Pay-as-you-go |

### Total Estimated Cost
- **Development/Hobby**: $0-5/month (Free tiers)
- **Production**: $7-20/month (Vercel Hobby + Render Starter)
- **Professional**: $27-45/month (Vercel Pro + Render Standard)

---

## Production Checklist

Before going live, ensure:

- [ ] Backend deployed and accessible
- [ ] Frontend deployed on Vercel
- [ ] MongoDB Atlas configured with proper security
- [ ] All environment variables set correctly
- [ ] OAuth apps configured with production URLs
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS working on both frontend and backend
- [ ] CORS configured correctly
- [ ] Test all authentication flows
- [ ] Test API endpoints
- [ ] Monitor logs for errors
- [ ] Set up monitoring/alerting (optional)
- [ ] Backup strategy for database

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Git Integration](https://vercel.com/docs/concepts/git)
- [Render Python Guide](https://render.com/docs/deploy-fastapi)
- [Railway Python Guide](https://docs.railway.app/languages/python)
- [MongoDB Atlas Setup](https://www.mongodb.com/docs/atlas/)

---

## Support

For issues specific to this deployment:
1. Check the [Troubleshooting](#troubleshooting) section above
2. Review [DEPLOYMENT.md](./DEPLOYMENT.md) for general deployment guidance
3. Check Vercel deployment logs
4. Check backend service logs (Render/Railway)
5. Open an issue on GitHub with deployment logs

---

**Last Updated**: October 2025
