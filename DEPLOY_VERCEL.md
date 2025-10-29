# Quick Start: Deploy on Vercel

This is a quick guide to deploy Papers2Code using Vercel for the frontend. For complete documentation, see [docs/deployment/VERCEL_DEPLOYMENT.md](docs/deployment/VERCEL_DEPLOYMENT.md).

## Architecture

- **Frontend**: Vercel (React/Vite) ← You're deploying this
- **Backend**: Render/Railway (FastAPI) ← Deploy separately
- **Database**: MongoDB Atlas

## Prerequisites

✅ Backend already deployed (Render/Railway)  
✅ MongoDB Atlas cluster set up  
✅ GitHub/Google OAuth apps configured  

## Deploy Frontend to Vercel in 5 Steps

### 1️⃣ Fork/Clone Repository
```bash
git clone https://github.com/RyanKim17920/Papers2Code.git
cd Papers2Code
```

### 2️⃣ Deploy Backend First
If you haven't deployed your backend yet:

**Option A: Render (Recommended)**
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect your GitHub repo
4. Set build command: `pip install uv && uv sync`
5. Set start command: `uv run run_app2.py`
6. Add environment variables (see below)

**Option B: Railway**
1. Go to [railway.app](https://railway.app)
2. Create new project from GitHub
3. Railway auto-detects Python
4. Add environment variables (see below)

**Backend Environment Variables:**
```
MONGO_CONNECTION_STRING=mongodb+srv://user:pass@cluster.mongodb.net/papers2code
FLASK_SECRET_KEY=<generate-random-secure-key>
GITHUB_CLIENT_ID=<your-github-oauth-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
FRONTEND_URL=https://your-app.vercel.app
ENV_TYPE=production
```

**Note your backend URL** (e.g., `https://papers2code-api.onrender.com`)

### 3️⃣ Deploy to Vercel

**Via Vercel Dashboard (Easiest):**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects configuration from `vercel.json`
4. Add environment variable:
   ```
   VITE_API_BASE_URL=https://your-backend-api.onrender.com
   ```
   *(Use your actual backend URL from step 2)*
5. Click "Deploy"
6. Wait 2-3 minutes ⏳

**Via CLI:**
```bash
npm install -g vercel
vercel login
vercel
vercel env add VITE_API_BASE_URL production
# Enter your backend URL when prompted
vercel --prod
```

### 4️⃣ Update OAuth Callback URLs

After deployment, update your OAuth apps:

**GitHub OAuth:**
- Go to GitHub → Settings → Developer settings → OAuth Apps
- Edit your app:
  - Homepage URL: `https://your-app.vercel.app`
  - Callback URL: `https://your-backend-api.onrender.com/auth/github/callback`

**Google OAuth:**
- Go to [Google Cloud Console](https://console.cloud.google.com) → Credentials
- Edit OAuth 2.0 Client:
  - Authorized JavaScript origins: `https://your-app.vercel.app`
  - Authorized redirect URIs: `https://your-backend-api.onrender.com/auth/google/callback`

### 5️⃣ Update Backend FRONTEND_URL

In your backend platform (Render/Railway), update:
```
FRONTEND_URL=https://your-app.vercel.app
```

Then redeploy your backend.

## ✅ Test Your Deployment

Visit `https://your-app.vercel.app` and test:
- ✅ Frontend loads
- ✅ GitHub OAuth login
- ✅ Google OAuth login  
- ✅ Paper search
- ✅ User dashboard

## 🎉 You're Live!

Your app is now deployed:
- **Frontend**: https://your-app.vercel.app
- **Backend**: https://your-backend-api.onrender.com
- **API Docs**: https://your-backend-api.onrender.com/docs

## 🔄 Continuous Deployment

Vercel automatically deploys:
- `main` branch → Production
- Pull requests → Preview deployments

## 🆘 Troubleshooting

**Frontend not loading?**
- Check build logs in Vercel dashboard
- Verify `vercel.json` exists

**API calls failing?**
- Check `VITE_API_BASE_URL` in Vercel environment variables
- Verify backend is running: `curl https://your-backend-api.onrender.com/health`
- Check CORS: backend `FRONTEND_URL` must match Vercel URL

**OAuth not working?**
- Double-check callback URLs in GitHub/Google OAuth apps
- Ensure they point to your backend URL, not frontend

## 📚 Full Documentation

For complete details, troubleshooting, and advanced configuration:
→ [docs/deployment/VERCEL_DEPLOYMENT.md](docs/deployment/VERCEL_DEPLOYMENT.md)

## 💰 Cost

- **Vercel (Frontend)**: Free forever for hobby projects
- **Render (Backend)**: Free (sleeps after 15min) or $7/month (always-on)
- **MongoDB Atlas**: Free tier (512MB)

**Total**: $0-7/month

---

**Need help?** Open an issue on GitHub or check the [full deployment guide](docs/deployment/VERCEL_DEPLOYMENT.md).
