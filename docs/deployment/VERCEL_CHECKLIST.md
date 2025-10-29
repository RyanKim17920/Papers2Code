# Vercel Deployment Checklist

Use this checklist when deploying Papers2Code to Vercel for the first time or troubleshooting deployment issues.

## Pre-Deployment Checklist

### 1. Repository Setup
- [ ] Code is in a GitHub repository
- [ ] Repository is accessible to your Vercel account
- [ ] `vercel.json` exists in repository root
- [ ] `.vercelignore` exists in repository root
- [ ] Frontend builds successfully locally: `cd papers2code-ui && npm run build`

### 2. MongoDB Atlas Setup
- [ ] MongoDB Atlas account created
- [ ] Database cluster created
- [ ] Database user created with read/write permissions
- [ ] Network access configured (0.0.0.0/0 for production)
- [ ] Connection string copied (mongodb+srv://...)
- [ ] Database name decided (e.g., `papers2code`)

### 3. OAuth Configuration

#### GitHub OAuth App
- [ ] OAuth App created at https://github.com/settings/developers
- [ ] Application name set (e.g., "Papers2Code")
- [ ] Homepage URL set (will update after deployment)
- [ ] Authorization callback URL set (will update after deployment)
- [ ] Client ID saved
- [ ] Client Secret saved securely

#### Google OAuth App (Optional)
- [ ] Google Cloud Project created
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 Client ID created (Web application)
- [ ] Authorized JavaScript origins set (will update after deployment)
- [ ] Authorized redirect URIs set (will update after deployment)
- [ ] Client ID saved
- [ ] Client Secret saved securely

### 4. Backend Deployment (Must Complete Before Frontend)

#### Option A: Render
- [ ] Render account created
- [ ] New Web Service created
- [ ] GitHub repository connected
- [ ] Build command set: `pip install uv && uv sync`
- [ ] Start command set: `uv run run_app2.py`
- [ ] Environment variables configured (see below)
- [ ] Service deployed successfully
- [ ] Backend URL noted (e.g., https://papers2code-api.onrender.com)
- [ ] Health check works: `curl https://your-backend-url/health`

#### Option B: Railway
- [ ] Railway account created
- [ ] New project created from GitHub
- [ ] Environment variables configured (see below)
- [ ] Service deployed successfully
- [ ] Backend URL noted
- [ ] Health check works: `curl https://your-backend-url/health`

#### Backend Environment Variables
```bash
# Required
MONGO_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/papers2code
FLASK_SECRET_KEY=<generate-32-character-random-string>
ENV_TYPE=production
PORT=5000

# OAuth (at least one required)
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Will be updated after frontend deployment
FRONTEND_URL=https://your-app.vercel.app
```

Generate FLASK_SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## Frontend Deployment (Vercel)

### 1. Initial Deployment
- [ ] Vercel account created/logged in
- [ ] New project created from GitHub repository
- [ ] Repository imported successfully
- [ ] Framework preset: Vite (auto-detected)
- [ ] Build settings verified from vercel.json
- [ ] Root directory: `./` (default)

### 2. Environment Variables
- [ ] `VITE_API_BASE_URL` added:
  ```
  Value: https://your-backend-api.onrender.com
  ```
  (Use your actual backend URL from previous step)
- [ ] Environment set to: Production
- [ ] Click "Deploy"

### 3. Wait for Deployment
- [ ] Build started
- [ ] Build completed successfully (usually 2-3 minutes)
- [ ] Deployment URL noted (e.g., https://papers2code-xyz.vercel.app)
- [ ] Site loads successfully

---

## Post-Deployment Configuration

### 1. Update Backend Environment Variable
Go to your backend platform (Render/Railway):
- [ ] Update `FRONTEND_URL` to your Vercel URL
  ```
  FRONTEND_URL=https://papers2code-xyz.vercel.app
  ```
- [ ] Redeploy backend service

### 2. Update GitHub OAuth App
- [ ] Homepage URL: `https://papers2code-xyz.vercel.app`
- [ ] Authorization callback URL: `https://your-backend-api.onrender.com/auth/github/callback`
- [ ] Save changes

### 3. Update Google OAuth App (if applicable)
- [ ] Authorized JavaScript origins:
  ```
  https://papers2code-xyz.vercel.app
  ```
- [ ] Authorized redirect URIs:
  ```
  https://your-backend-api.onrender.com/auth/google/callback
  ```
- [ ] Save changes

---

## Testing Checklist

### Frontend Tests
- [ ] Visit https://your-app.vercel.app
- [ ] Homepage loads correctly
- [ ] No console errors in browser DevTools
- [ ] Images and assets load
- [ ] Navigation works between pages

### API Connection Tests
- [ ] Open browser Network tab
- [ ] Navigate to Papers page
- [ ] API requests show successful (200 status)
- [ ] Papers load from backend
- [ ] Search functionality works

### Authentication Tests
- [ ] Click "Login" button
- [ ] GitHub OAuth login works
  - [ ] Redirects to GitHub
  - [ ] Redirects back to app
  - [ ] User is logged in
  - [ ] User profile displays
- [ ] Google OAuth login works (if configured)
  - [ ] Redirects to Google
  - [ ] Redirects back to app
  - [ ] User is logged in
  - [ ] User profile displays
- [ ] Logout works
- [ ] Re-login works

### Functionality Tests
- [ ] Search papers works
- [ ] View paper details works
- [ ] Vote on papers works (requires login)
- [ ] Add new paper works (requires login)
- [ ] User dashboard displays correctly
- [ ] Profile page displays correctly

---

## Custom Domain (Optional)

### 1. Add Domain in Vercel
- [ ] Go to Project → Settings → Domains
- [ ] Add your custom domain (e.g., papers2code.com)
- [ ] Follow DNS configuration instructions
- [ ] Wait for DNS propagation (up to 48 hours, usually faster)

### 2. Update All OAuth Configurations
- [ ] Update GitHub OAuth homepage and callback URLs
- [ ] Update Google OAuth origins and redirect URIs
- [ ] Update backend `FRONTEND_URL` environment variable
- [ ] Redeploy backend

### 3. Test Custom Domain
- [ ] Visit https://your-custom-domain.com
- [ ] All functionality works
- [ ] SSL certificate is active (padlock icon in browser)

---

## Monitoring & Maintenance

### Regular Checks
- [ ] Set up Vercel deployment notifications (Settings → Git)
- [ ] Monitor Vercel deployment logs for errors
- [ ] Monitor backend logs (Render/Railway dashboard)
- [ ] Check MongoDB Atlas metrics
- [ ] Test OAuth periodically

### Performance
- [ ] Check Vercel Analytics (if available)
- [ ] Monitor Vercel bandwidth usage
- [ ] Monitor backend response times
- [ ] Check database query performance

### Security
- [ ] Rotate FLASK_SECRET_KEY periodically
- [ ] Keep dependencies updated
- [ ] Review MongoDB access logs
- [ ] Monitor for unusual activity

---

## Troubleshooting Quick Reference

### Frontend Not Loading
1. Check Vercel deployment logs
2. Verify build completed successfully
3. Check browser console for errors
4. Verify `vercel.json` configuration

### API Calls Failing (CORS Errors)
1. Verify backend `FRONTEND_URL` matches Vercel URL
2. Check backend is running: `curl https://backend-url/health`
3. Verify `VITE_API_BASE_URL` in Vercel environment variables
4. Check browser Network tab for actual error

### OAuth Not Working
1. Verify callback URLs point to **backend** URL
2. Verify homepage/origins point to **frontend** URL
3. Check backend logs for OAuth errors
4. Ensure cookies are enabled in browser

### Build Failures
1. Check Vercel build logs for specific error
2. Test build locally: `cd papers2code-ui && npm run build`
3. Verify all dependencies in package.json
4. Check for TypeScript errors

### 502/504 Errors
1. Check if backend is running (Render free tier sleeps)
2. Wait 30-60 seconds for backend to wake up
3. Check backend logs for crashes
4. Verify database connection string is correct

---

## Rollback Procedure

If deployment fails or has issues:

### Vercel (Frontend)
1. Go to Vercel dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

### Backend (Render/Railway)
1. Check deployment history
2. Redeploy previous working version
3. Or revert git commit and push

### Environment Variables
1. Keep a backup of all environment variables
2. Document any changes to env vars
3. Can restore from backup if needed

---

## Success Criteria

Deployment is successful when:
- ✅ Frontend loads at https://your-app.vercel.app
- ✅ No console errors
- ✅ API requests work (check Network tab)
- ✅ GitHub OAuth login works end-to-end
- ✅ Google OAuth login works (if configured)
- ✅ Papers can be searched and viewed
- ✅ User can vote on papers (when logged in)
- ✅ Dashboard and profile pages work
- ✅ All links and navigation work
- ✅ SSL/HTTPS works on both frontend and backend

---

## Getting Help

If you encounter issues not covered by this checklist:

1. **Check documentation**:
   - [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Full deployment guide
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - General deployment info

2. **Check logs**:
   - Vercel: Dashboard → Your Project → Deployments → Click deployment → Logs
   - Render: Dashboard → Your Service → Logs tab
   - Railway: Dashboard → Your Project → Deployments → Logs
   - Browser: Open DevTools → Console & Network tabs

3. **Common resources**:
   - [Vercel Documentation](https://vercel.com/docs)
   - [Render Documentation](https://render.com/docs)
   - [Railway Documentation](https://docs.railway.app)

4. **Open an issue**:
   - Include deployment logs
   - Include browser console errors
   - Describe what you've tried
   - Include environment (OS, browser, etc.)

---

**Last Updated**: October 2025
