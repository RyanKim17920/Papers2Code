# Security Guidelines

## Overview
This document outlines security best practices for the Papers2Code application deployment.

## ⚠️ Can This Code Be 100% Open Source and Still Be Secure?

**YES!** This codebase is designed to be fully open-source and public while maintaining production-grade security. Here's how:

### Security Through Design, Not Obscurity

Our security model follows industry best practices:

1. **Zero Hardcoded Secrets**: All sensitive data (API keys, database credentials, OAuth secrets) are stored in environment variables, never in code
2. **Environment-Based Configuration**: Each deployment uses its own isolated configuration through environment variables
3. **Defense in Depth**: Multiple security layers protect the application even if one layer is compromised
4. **Open Security Review**: Public code allows community security audits and faster vulnerability detection

### What's Public (Safe to Share)
✅ Application source code
✅ Security middleware and headers configuration  
✅ Authentication flow logic (OAuth, JWT structure)
✅ Database schema and query patterns
✅ API endpoint definitions
✅ Frontend UI components
✅ Deployment configuration templates
✅ This security documentation

### What's Private (Never in Code)
🔒 Database connection strings
🔒 JWT signing secrets (FLASK_SECRET_KEY)
🔒 GitHub OAuth client secrets
🔒 API keys (Google, OpenAI, etc.)
🔒 User passwords (hashed with bcrypt/scrypt)
🔒 Session tokens and cookies
🔒 Environment-specific URLs

### Why Open Source Improves Security

1. **Community Audits**: More eyes reviewing code means vulnerabilities are found faster
2. **Transparency**: Users can verify security measures are implemented correctly
3. **Best Practices**: Following established patterns that are peer-reviewed
4. **Faster Patches**: Security issues can be reported and fixed quickly
5. **Trust**: Users can see exactly what the application does with their data

### Deployment Security Model

Each deployment is isolated:

```
┌─────────────────────────────────────────────────────────┐
│  Public GitHub Repository (Code Only)                   │
│  ├── Source Code ✓                                      │
│  ├── Security Logic ✓                                   │
│  ├── .env.example (Template) ✓                          │
│  └── Documentation ✓                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Your Private Deployment (Your Secrets)                 │
│  ├── Your Database Credentials 🔒                       │
│  ├── Your OAuth Secrets 🔒                              │
│  ├── Your JWT Secret 🔒                                 │
│  └── Your Environment Variables 🔒                      │
└─────────────────────────────────────────────────────────┘
```

### Multiple Deployments, Multiple Secrets

Anyone can deploy their own instance with their own secrets:

| Instance | Database | OAuth App | JWT Secret | Independent |
|----------|----------|-----------|------------|-------------|
| Production | DB1 🔒 | App1 🔒 | Key1 🔒 | ✓ |
| Staging | DB2 🔒 | App2 🔒 | Key2 🔒 | ✓ |
| Dev/Local | DB3 🔒 | App3 🔒 | Key3 🔒 | ✓ |

Each instance is completely isolated. Compromising one doesn't affect others.

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

## Contributing Securely to Open Source

### For Contributors

When contributing to this project:

1. **Never Commit Secrets**: 
   - Double-check your commits don't include `.env` files
   - Use `git diff` before committing
   - Configure git hooks to prevent secret commits

2. **Review Security Changes Carefully**:
   - Security-related PRs require extra scrutiny
   - Test authentication flows thoroughly
   - Verify CORS and CSRF protections remain intact

3. **Report Vulnerabilities Responsibly**:
   - See "Vulnerability Reporting" section below
   - DO NOT open public issues for security vulnerabilities
   - Contact maintainers privately first

4. **Test Locally with Your Own Secrets**:
   - Use your own test MongoDB instance
   - Create your own GitHub OAuth app for testing
   - Never share your test credentials

### For Maintainers

1. **Secret Scanning**:
   - Enable GitHub Secret Scanning
   - Use tools like GitGuardian or TruffleHog
   - Regularly audit commit history

2. **Dependency Updates**:
   - Monitor security advisories
   - Keep dependencies updated
   - Use `uv lock --upgrade` regularly
   - Review dependency CVEs before merging

3. **Code Review**:
   - Require reviews for security-related changes
   - Test authentication changes locally
   - Verify environment variable handling

## Vulnerability Reporting

### Responsible Disclosure

We take security vulnerabilities seriously. If you discover a security issue:

1. **DO NOT** open a public GitHub issue
2. **DO** email the maintainers privately (see repository for contact)
3. **DO** provide detailed reproduction steps
4. **DO** give us reasonable time to fix before public disclosure (typically 90 days)

### What to Report

Please report:
- Authentication or authorization bypasses
- SQL/NoSQL injection vulnerabilities
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF) bypasses
- Insecure direct object references
- Sensitive data exposure
- Security misconfiguration
- Server-Side Request Forgery (SSRF)

### What We'll Do

1. **Acknowledge** your report within 48 hours
2. **Investigate** and confirm the vulnerability
3. **Develop** a fix (coordinating with you if helpful)
4. **Release** a security patch
5. **Credit** you in release notes (if desired)
6. **Disclose** publicly after fix is deployed

### Bug Bounty

While we don't currently offer monetary rewards, we deeply appreciate security research and will:
- Credit you in our security acknowledgments
- Feature you in release notes
- Provide a recommendation if requested

## Security Features Implementation

### Current Security Controls

| Control | Implemented | Purpose |
|---------|-------------|---------|
| HTTPS Redirect | ✓ (Production) | Encrypt all traffic |
| CORS | ✓ | Prevent unauthorized origins |
| CSRF Protection | ✓ | Prevent forged requests |
| Rate Limiting | ✓ | Prevent abuse/DoS |
| Security Headers | ✓ | Browser-level protections |
| JWT Tokens | ✓ | Stateless authentication |
| HTTP-Only Cookies | ✓ | Prevent XSS token theft |
| OAuth 2.0 | ✓ | Secure third-party auth |
| Input Validation | ✓ | Prevent injection attacks |
| Parameterized Queries | ✓ | Prevent NoSQL injection |
| Error Handling | ✓ | Prevent info leakage |
| Password Hashing | N/A | GitHub OAuth only |

### Security Headers Explained

```python
# Prevents MIME type sniffing
X-Content-Type-Options: nosniff

# Prevents clickjacking
X-Frame-Options: DENY

# Controls referrer information
Referrer-Policy: strict-origin-when-cross-origin

# Restricts browser features
Permissions-Policy: geolocation=(), microphone=(), camera=()

# Legacy XSS protection
X-XSS-Protection: 1; mode=block

# Content Security Policy (Production)
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https://avatars.githubusercontent.com;
  connect-src 'self';
  ...
```

## Security Testing

### Pre-Deployment Testing

Before deploying:

1. **Authentication Flow**:
   ```bash
   # Test OAuth login
   curl -I https://your-domain.com/api/auth/github/login
   
   # Verify CSRF token endpoint
   curl https://your-domain.com/api/auth/csrf-token
   ```

2. **Security Headers**:
   ```bash
   # Check all security headers are present
   curl -I https://your-domain.com | grep -E "X-|Content-Security|Referrer"
   ```

3. **CORS Configuration**:
   ```bash
   # Verify CORS blocks unauthorized origins
   curl -H "Origin: https://evil.com" \
        -H "Access-Control-Request-Method: POST" \
        -X OPTIONS https://your-domain.com/api/papers
   ```

4. **Rate Limiting**:
   ```bash
   # Test rate limits trigger
   for i in {1..100}; do 
     curl https://your-domain.com/api/papers
   done
   ```

### Security Scanning Tools

Recommended tools for security testing:

1. **OWASP ZAP**: Web application security scanner
2. **Burp Suite**: Comprehensive security testing
3. **npm audit**: Frontend dependency vulnerabilities
4. **Safety** or **pip-audit**: Python dependency scanning
5. **Trivy**: Container and code vulnerability scanning
6. **GitGuardian**: Secret detection in code

### Automated Security Testing

```bash
# Scan Python dependencies
uv pip list --format=json | safety check --stdin

# Scan npm dependencies
cd papers2code-ui && npm audit

# Check for secrets in git history
trufflehog git file://. --only-verified

# Scan with OWASP ZAP (requires ZAP installed)
zap-cli quick-scan --self-contained \
  --start-options '-config api.disablekey=true' \
  https://your-domain.com
```

## Additional Resources

### Security Standards & Guidelines
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

### Framework & Platform Security
- [FastAPI Security Guide](https://fastapi.tiangolo.com/tutorial/security/)
- [React Security Best Practices](https://reactjs.org/docs/security.html)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)

### Deployment Platform Security
- [Render Security Documentation](https://render.com/docs/security)
- [Railway Security Best Practices](https://docs.railway.app/guides/security)
- [Vercel Security Documentation](https://vercel.com/docs/security)

### Tools & Utilities
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [GitGuardian](https://www.gitguardian.com/)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog)
- [OWASP ZAP](https://www.zaproxy.org/)
- [Safety](https://github.com/pyupio/safety)

### Learning Resources
- [PortSwigger Web Security Academy](https://portswigger.net/web-security)
- [OWASP WebGoat](https://owasp.org/www-project-webgoat/)
- [SANS Secure Coding](https://www.sans.org/secure-coding/)

## Questions?

For security questions or concerns:
- Review this document and [DEPLOYMENT.md](DEPLOYMENT.md)
- Check [GitHub Discussions](../../discussions) for community support
- For vulnerabilities, follow the Responsible Disclosure process above
