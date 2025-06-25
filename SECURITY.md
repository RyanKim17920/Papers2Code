# Security Guidelines

## Overview
This document outlines security best practices for the Papers2Code application deployment.

## Deployment Security

### Environment Variables
- **Never commit sensitive data to version control**
- Use platform-specific environment variable management:
  - **Railway**: `railway variables set KEY=value`
  - **Vercel**: `vercel env add KEY`

### Required Environment Variables

#### Backend (Railway)
```bash
# Database
MONGO_CONNECTION_STRING=mongodb+srv://...

# Application
ENV_TYPE=production
PORT=5000 
FRONTEND_URL=https://your-vercel-domain.com

# Authentication
FLASK_SECRET_KEY=your-secret-key-here
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Optional: Logging
APP_LOG_LEVEL=INFO
```

#### Frontend (Vercel)
```bash
# API Configuration
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app
```

## CORS Configuration

The backend automatically configures CORS origins based on:
1. Development origins (localhost:3000, localhost:5173)
2. `FRONTEND_URL` environment variable

**Important**: Always set `FRONTEND_URL` to your actual Vercel domain.

## Authentication Security

### JWT Tokens
- Access tokens expire in 30 minutes
- Refresh tokens expire in 7 days
- Tokens are stored in secure HTTP-only cookies

### CSRF Protection
- Custom CSRF middleware validates tokens
- Tokens required for all state-changing operations
- Exempts safe methods (GET, HEAD, OPTIONS)

### GitHub OAuth
- Uses OAuth 2.0 flow
- Requires valid GitHub client ID and secret
- Redirects to configured frontend URL

## API Security

### Rate Limiting
- Implemented using SlowAPI
- Configurable per-endpoint limits
- Prevents abuse and DoS attacks

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restrictions

## Data Security

### Database
- Use MongoDB Atlas with proper authentication
- Enable network access restrictions
- Regular backups and monitoring

### Sensitive Data
- Never log sensitive information
- Use environment variables for secrets
- Implement proper access controls

## Monitoring and Logging

### Security Monitoring
- Monitor failed authentication attempts
- Track suspicious API usage patterns
- Set up alerts for security events

### Logging Best Practices
- Log security-relevant events
- Avoid logging sensitive data
- Use structured logging format
- Implement log rotation

## Security Checklist

### Pre-Deployment
- [ ] All secrets in environment variables
- [ ] CORS origins properly configured
- [ ] Database connection secured
- [ ] GitHub OAuth configured
- [ ] Security headers enabled

### Post-Deployment
- [ ] Test authentication flow
- [ ] Verify CORS configuration
- [ ] Check security headers
- [ ] Monitor application logs
- [ ] Test rate limiting

### Regular Maintenance
- [ ] Update dependencies regularly
- [ ] Monitor security advisories
- [ ] Review access logs
- [ ] Rotate secrets periodically
- [ ] Update CORS origins as needed

## Incident Response

### Security Incident Steps
1. **Identify**: Detect security issues
2. **Contain**: Isolate affected systems
3. **Investigate**: Analyze the incident
4. **Remediate**: Fix vulnerabilities
5. **Monitor**: Watch for recurring issues

### Emergency Contacts
- Maintain updated contact information
- Document escalation procedures
- Have rollback procedures ready

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security Guide](https://fastapi.tiangolo.com/tutorial/security/)
- [Railway Security Best Practices](https://docs.railway.app/guides/security)
- [Vercel Security Documentation](https://vercel.com/docs/security)
