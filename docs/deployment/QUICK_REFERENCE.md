# Deployment Quick Reference

Quick commands and troubleshooting for Papers2Code deployment.

## 🚀 Quick Deploy Commands

### Deploy to Vercel (Frontend)

```bash
# Via CLI
npm install -g vercel
vercel login
vercel                    # Deploy to preview
vercel --prod            # Deploy to production

# Set environment variable
vercel env add VITE_API_BASE_URL production
```

### Deploy to Render (Backend)

```bash
# Via Blueprint (Recommended)
# 1. Push code to GitHub
# 2. Go to render.com
# 3. New → Blueprint
# 4. Select repository
# 5. Apply

# Via CLI
render deploy
```

### Deploy to Railway (Backend Alternative)

```bash
# Via CLI
npm install -g @railway/cli
railway login
railway up
```

---

## 📝 Environment Variables

### Frontend (Vercel)

```bash
# Required
VITE_API_BASE_URL=https://your-backend-api.onrender.com

# Set via CLI
vercel env add VITE_API_BASE_URL
```

### Backend (Render/Railway)

```bash
# Required
MONGO_CONNECTION_STRING=mongodb+srv://user:pass@cluster.mongodb.net/papers2code
FLASK_SECRET_KEY=<64-character-hex-string>
ENV_TYPE=production
PORT=5000

# OAuth (at least one)
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-secret>

# CORS
FRONTEND_URL=https://your-app.vercel.app

# Generate secret key
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 🔍 Health Checks

### Check Backend is Running

```bash
# Basic health check
curl https://your-backend.onrender.com/health

# Expected response
{"status": "healthy"}

# Check API docs
curl https://your-backend.onrender.com/docs
```

### Check Frontend is Deployed

```bash
# Check if site is up
curl -I https://your-app.vercel.app

# Expected response
HTTP/2 200
```

### Check Database Connection

```bash
# From backend logs, should see:
"MongoDB connection established successfully"
```

---

## 🐛 Common Issues & Fixes

### Issue: "API calls failing (CORS error)"

**Symptoms:**
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Fix:**
```bash
# 1. Check backend FRONTEND_URL matches your Vercel URL
# On Render: Settings → Environment → Edit FRONTEND_URL

# 2. Verify no trailing slash
FRONTEND_URL=https://your-app.vercel.app  ✅
FRONTEND_URL=https://your-app.vercel.app/ ❌

# 3. Redeploy backend after changing
```

---

### Issue: "OAuth redirect not working"

**Symptoms:**
- Redirects to wrong URL after OAuth
- "Invalid redirect URI" error

**Fix:**
```bash
# GitHub OAuth App:
# Homepage URL: https://your-app.vercel.app
# Callback URL: https://your-backend.onrender.com/auth/github/callback

# Google OAuth App:
# Authorized JavaScript origins: https://your-app.vercel.app
# Authorized redirect URIs: https://your-backend.onrender.com/auth/google/callback

# Note: Callback URLs point to BACKEND, not frontend
```

---

### Issue: "502 Bad Gateway"

**Symptoms:**
- Backend returns 502 error
- "Service unavailable"

**Fix:**
```bash
# If using Render Free tier:
# 1. Backend sleeps after 15 minutes
# 2. First request wakes it up (30-60 seconds)
# 3. Just wait and retry

# If persistent:
# 1. Check Render logs for crashes
# 2. Check database connection
# 3. Verify environment variables are set
```

---

### Issue: "Build failing on Vercel"

**Symptoms:**
```
Error: Cannot find module 'react'
```

**Fix:**
```bash
# 1. Verify package.json has all dependencies
cd papers2code-ui
npm install

# 2. Test build locally
npm run build

# 3. If local build works but Vercel fails:
# - Check Node version in Vercel (should be 18+)
# - Clear Vercel cache: Deployments → More → Clear Cache → Redeploy
```

---

### Issue: "Environment variable not working"

**Symptoms:**
- API calls go to wrong URL
- Features not working as expected

**Fix:**
```bash
# Frontend (Vercel):
# 1. Must start with VITE_
VITE_API_BASE_URL=...  ✅
API_BASE_URL=...       ❌

# 2. Redeploy after adding env vars
vercel --prod

# Backend (Render):
# 1. Check spelling exactly matches code
# 2. No extra spaces in values
# 3. Save and redeploy
```

---

### Issue: "Database connection timeout"

**Symptoms:**
```
pymongo.errors.ServerSelectionTimeoutError
```

**Fix:**
```bash
# 1. Check MongoDB Atlas connection string
# Format: mongodb+srv://username:password@cluster.mongodb.net/database

# 2. Verify network access (MongoDB Atlas):
# - Go to Network Access
# - Add IP: 0.0.0.0/0 (allow all)
# - Or add Render/Railway IP ranges

# 3. Check database user permissions:
# - User must have read/write access
# - Password must not contain special characters that need escaping
```

---

## 📊 Monitoring Commands

### View Recent Logs

```bash
# Vercel
vercel logs

# Render (via dashboard)
# Go to your service → Logs tab

# Railway
railway logs
```

### Check Deployment Status

```bash
# Vercel
vercel ls

# Get deployment URL
vercel inspect

# Render (via dashboard)
# Dashboard → Your Service → Latest Deploy
```

### Monitor Performance

```bash
# Test frontend load time
curl -w "@-" -o /dev/null -s https://your-app.vercel.app <<EOF
    time_namelookup:  %{time_namelookup}s\n
       time_connect:  %{time_connect}s\n
    time_appconnect:  %{time_appconnect}s\n
      time_redirect:  %{time_redirect}s\n
   time_starttransfer:  %{time_starttransfer}s\n
       time_total:  %{time_total}s\n
EOF

# Test API response time
time curl https://your-backend.onrender.com/health
```

---

## 🔄 Update & Rollback

### Deploy New Version

```bash
# Frontend (automatic via git)
git push origin main
# Vercel auto-deploys from main branch

# Backend (automatic via git)
git push origin main
# Render auto-deploys from main branch

# Or manual via CLI
vercel --prod
```

### Rollback to Previous Version

```bash
# Vercel (via dashboard)
# 1. Go to Deployments
# 2. Find working deployment
# 3. Click "..." → Promote to Production

# Render (via dashboard)
# 1. Go to your service
# 2. Manual Deploy → Deploy commit <hash>

# Or via git
git revert <commit-hash>
git push origin main
```

---

## 🎯 Quick Deployment Checklist

```bash
# Before deploying:
□ Code builds locally: cd papers2code-ui && npm run build
□ Backend runs locally: uv run run_app2.py
□ Environment variables documented
□ MongoDB Atlas cluster ready
□ OAuth apps configured

# After deploying:
□ Frontend loads: curl -I https://your-app.vercel.app
□ Backend responds: curl https://your-backend.onrender.com/health
□ OAuth login works
□ API calls work (check browser Network tab)
□ Database queries work (check papers list)

# Post-deployment:
□ Update OAuth callback URLs
□ Test all major features
□ Monitor logs for errors
□ Set up uptime monitoring (optional)
```

---

## 🔗 Quick Links

### Dashboards

- **Vercel**: [vercel.com/dashboard](https://vercel.com/dashboard)
- **Render**: [dashboard.render.com](https://dashboard.render.com)
- **Railway**: [railway.app/dashboard](https://railway.app/dashboard)
- **MongoDB Atlas**: [cloud.mongodb.com](https://cloud.mongodb.com)

### OAuth Setup

- **GitHub OAuth**: [github.com/settings/developers](https://github.com/settings/developers)
- **Google OAuth**: [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)

### Documentation

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Render Docs**: [render.com/docs](https://render.com/docs)
- **Railway Docs**: [docs.railway.app](https://docs.railway.app)

---

## 💡 Pro Tips

### Performance Optimization

```bash
# Frontend bundle analysis
cd papers2code-ui
npm run build -- --analyze

# Check lighthouse score
npx lighthouse https://your-app.vercel.app

# Optimize images
# Use WebP format, compress before uploading
```

### Cost Optimization

```bash
# Monitor Vercel bandwidth
# Dashboard → Usage (stay within free tier)

# Check Render usage
# Dashboard → Your Service → Metrics

# MongoDB storage
# Check cluster size in MongoDB Atlas
```

### Security Best Practices

```bash
# Rotate secrets periodically
# Generate new FLASK_SECRET_KEY every 90 days
python -c "import secrets; print(secrets.token_hex(32))"

# Update dependencies
npm audit fix                    # Frontend
pip list --outdated             # Backend

# Review access logs regularly
# Check MongoDB Atlas → Activity Feed
# Check Render/Vercel logs for suspicious activity
```

---

## 📞 Getting Help

### Check Documentation
1. [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Full Vercel guide
2. [DEPLOYMENT.md](./DEPLOYMENT.md) - Render guide
3. [VERCEL_CHECKLIST.md](./VERCEL_CHECKLIST.md) - Step-by-step checklist

### Debug Checklist
1. ✅ Check browser console (F12)
2. ✅ Check browser Network tab (F12)
3. ✅ Check backend logs
4. ✅ Check database connection
5. ✅ Verify environment variables
6. ✅ Test with curl commands above

### Community Support
- Open GitHub Issue with logs and error messages
- Include: Browser, OS, what you tried
- Provide: Console errors, network requests, backend logs

---

**Last Updated**: October 2025
**Bookmark this page**: Quick reference for all deployment tasks
