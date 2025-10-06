# Security Quick Start Guide

## 🚀 For New Deployers

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Generate Secure Secrets
```bash
# Generate JWT secret
python3 -c "import secrets; print('FLASK_SECRET_KEY=' + secrets.token_hex(32))"

# Add to your .env file
```

### 3. Set Up External Services

#### MongoDB Atlas
1. Create free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create database user
3. Whitelist IP: `0.0.0.0/0` (or specific IPs)
4. Copy connection string to `.env`:
   ```
   MONGO_CONNECTION_STRING=mongodb+srv://user:pass@cluster.mongodb.net/papers2code
   ```

#### GitHub OAuth
1. Create OAuth app at [github.com/settings/applications/new](https://github.com/settings/applications/new)
2. Set callback URL: `http://localhost:5173/auth/github/callback` (dev) or `https://your-domain.com/auth/github/callback` (prod)
3. Copy credentials to `.env`:
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   ```

### 4. Run Locally
```bash
# Backend
uv sync
uv run run_app2.py

# Frontend (new terminal)
cd papers2code-ui
npm install
npm run dev
```

### 5. Deploy to Production
See [DEPLOYMENT.md](DEPLOYMENT.md) for platform-specific instructions.

**Important**: Use different secrets for production!

## 🔒 Security Checklist

Before deploying:
- [ ] Generated strong, random JWT secret
- [ ] Created separate OAuth apps for dev/prod
- [ ] Using different databases for dev/prod
- [ ] Never committed `.env` file
- [ ] Set `ENV_TYPE=production` in production
- [ ] Enabled MongoDB authentication
- [ ] Configured CORS origins correctly

## 📚 Full Documentation

| Document | Purpose |
|----------|---------|
| [OPENSOURCE_SECURITY.md](OPENSOURCE_SECURITY.md) | **Start here** - Understand how public code stays secure |
| [SECURITY.md](SECURITY.md) | Complete security guidelines |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment guide |
| [.env.example](.env.example) | All environment variables explained |
| [.github/SECURITY_POLICY.md](.github/SECURITY_POLICY.md) | Vulnerability reporting |

## ❓ Quick Questions

**Q: Is it safe to have public code?**
A: Yes! Read [OPENSOURCE_SECURITY.md](OPENSOURCE_SECURITY.md) to understand why.

**Q: What secrets do I need?**
A: See [.env.example](.env.example) for the complete list.

**Q: How do I deploy securely?**
A: Follow [DEPLOYMENT.md](DEPLOYMENT.md) and use platform environment variables.

**Q: I found a security issue!**
A: Follow [.github/SECURITY_POLICY.md](.github/SECURITY_POLICY.md) for responsible disclosure.

## 🛡️ Security Layers

Even with public code, you're protected by:

1. **Transport Security**: HTTPS/TLS encryption
2. **Origin Control**: CORS whitelisting  
3. **Request Validation**: CSRF tokens
4. **Rate Limiting**: Per-endpoint limits
5. **Authentication**: OAuth + JWT
6. **Session Security**: HTTP-only cookies
7. **Input Validation**: Pydantic models
8. **Query Safety**: Parameterized queries
9. **Security Headers**: Multiple browser protections
10. **Secret Management**: Environment-based configuration

## 🆘 Getting Help

- **General questions**: [GitHub Discussions](../../discussions)
- **Security concerns**: See [SECURITY_POLICY.md](.github/SECURITY_POLICY.md)
- **Deployment issues**: Check [DEPLOYMENT.md](DEPLOYMENT.md)

---

**Remember**: Security through design, not obscurity! 🔐
