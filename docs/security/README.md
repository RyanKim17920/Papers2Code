# Security Documentation

This directory contains security-related documentation for Papers2Code.

## Documents

### [CSRF Protection](./CSRF_PROTECTION.md)
Comprehensive guide to the CSRF protection implementation, including:
- Security model and guarantees
- Implementation details (backend and frontend)
- Cross-domain configuration
- Testing and troubleshooting
- Best practices

## Security Features

Papers2Code implements multiple layers of security:

### 🔒 Authentication & Authorization
- OAuth 2.0 with GitHub and Google
- JWT tokens with refresh mechanism
- HttpOnly cookies for token storage
- Encrypted tokens at rest (Fernet encryption)

### 🛡️ CSRF Protection
- **Double-submit cookie pattern** with HttpOnly cookies
- **256-bit cryptographically secure tokens**
- **In-memory token storage** on frontend (no localStorage)
- **Origin validation middleware**
- Cross-domain support (Render + Vercel)

### 🔐 XSS Protection
- HttpOnly cookies prevent JavaScript access
- Content Security Policy (CSP) headers
- X-XSS-Protection header
- Strict output encoding

### 🌐 Transport Security
- HTTPS enforced in production
- HTTP Strict Transport Security (HSTS)
- SameSite=None + Secure cookies for cross-domain
- TLS 1.2+ only

### 📊 Rate Limiting
- Per-endpoint rate limits
- IP-based throttling
- Distributed rate limiting support (Redis)

### 🔍 Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` for feature control
- `Content-Security-Policy` (strict in production)

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **DO NOT** open a public issue
2. Email security concerns to: [Your security contact email]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Security Best Practices

### For Developers

1. **Never commit secrets**
   - Use `.env` files (in `.gitignore`)
   - Use environment variables in CI/CD
   - Rotate secrets regularly

2. **Validate all inputs**
   - Use Pydantic models for validation
   - Sanitize user-generated content
   - Implement strict type checking

3. **Keep dependencies updated**
   - Run `npm audit` and `pip-audit` regularly
   - Enable Dependabot for automated updates
   - Review security advisories

4. **Test security features**
   - Run CSRF protection tests
   - Test authentication flows
   - Verify CORS configuration

### For Administrators

1. **Secure database access**
   - Use strong passwords
   - Enable MongoDB authentication
   - Restrict network access
   - Regular backups

2. **Monitor logs**
   - Review authentication failures
   - Monitor for suspicious activity
   - Set up alerts for errors

3. **Regular security audits**
   - Review access controls
   - Audit OAuth app permissions
   - Check for exposed secrets

## Security Tools

### Automated Scanning
- **GitHub Secret Scanning**: Automatically detects committed secrets
- **Dependabot**: Automated dependency updates and security alerts
- **npm audit**: Scans npm dependencies for vulnerabilities
- **Safety** (Python): Scans Python dependencies for vulnerabilities

### Manual Testing
- **OWASP ZAP**: Web application security scanner
- **Burp Suite**: Web vulnerability scanner
- **curl**: Test API security manually

### Monitoring
- **Sentry**: Error tracking and monitoring
- **LogRocket**: Frontend monitoring
- **Datadog**: Infrastructure monitoring

## Compliance

Papers2Code follows these security standards and best practices:

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [CWE/SANS Top 25](https://www.sans.org/top25-software-errors/)

## Security Roadmap

### Planned Improvements
- [ ] Implement Content Security Policy reporting
- [ ] Add two-factor authentication (2FA)
- [ ] Implement session management improvements
- [ ] Add security headers testing in CI/CD
- [ ] Implement automated security scanning in pipeline
- [ ] Add intrusion detection system

### Under Consideration
- [ ] WebAuthn/FIDO2 support
- [ ] OAuth scope refinement
- [ ] Advanced bot detection
- [ ] DDoS mitigation improvements

## Resources

### External Resources
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Google Web Fundamentals - Security](https://developers.google.com/web/fundamentals/security)
- [CWE - Common Weakness Enumeration](https://cwe.mitre.org/)

### Tools
- [OWASP ZAP](https://www.zaproxy.org/)
- [Burp Suite](https://portswigger.net/burp)
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) - Secret scanning
- [GitGuardian](https://www.gitguardian.com/) - Secret detection

## Version History

- **v1.0** (Current): HttpOnly cookies, in-memory token storage, 256-bit tokens
- **v0.9**: localStorage token storage (deprecated due to XSS vulnerability)

## License

See [LICENSE](../../LICENSE) for details.
