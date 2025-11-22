# Security Policy

## 🔒 Security Commitment

Papers2Code takes security seriously. This project is designed to be fully open-source while maintaining production-grade security through proper architectural design and secret management.

## 📋 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest (main branch) | ✅ |
| Development branches | ⚠️ (use at own risk) |
| Archived releases | ❌ |

## 🐛 Reporting a Vulnerability

We appreciate responsible disclosure of security vulnerabilities.

### What to Report

Please report:
- Authentication or authorization bypasses
- SQL/NoSQL injection vulnerabilities  
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF) bypasses
- Insecure direct object references (IDOR)
- Sensitive data exposure
- Security misconfiguration
- Server-Side Request Forgery (SSRF)
- Dependency vulnerabilities with known exploits

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead:

1. **Private Disclosure**: Email security contact (check repository for current email)
2. **GitHub Security Advisories**: Use GitHub's [private vulnerability reporting](https://github.com/RyanKim17920/Papers2code/security/advisories/new)

### Include in Your Report

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)
- Your contact information (for credit/questions)

### Response Timeline

- **48 hours**: Initial response acknowledging receipt
- **7 days**: Preliminary assessment and severity classification
- **30-90 days**: Fix development and deployment
- **Public disclosure**: After fix is deployed and users have time to update

### What Happens Next

1. We'll acknowledge your report
2. We'll investigate and confirm the issue
3. We'll develop a fix (with your input if helpful)
4. We'll deploy the fix to production
5. We'll credit you in release notes (unless you prefer anonymity)
6. We'll publicly disclose after the fix is widely deployed

## ✅ Security Best Practices

### For Deployers

When deploying this application:

1. **Never commit secrets**: Use [.env.example](.env.example) as template
2. **Generate strong secrets**: Use cryptographically secure random generation
3. **Separate environments**: Different secrets for dev/staging/prod
4. **Enable platform security**: MongoDB auth, network restrictions, etc.
5. **Monitor logs**: Watch for suspicious activity
6. **Keep updated**: Regularly update dependencies

See [SECURITY.md](../SECURITY.md) for complete deployment security guidelines.

### For Contributors

When contributing code:

1. **Never commit secrets**: Double-check diffs before pushing
2. **Review security changes**: Extra scrutiny for auth/security code
3. **Test thoroughly**: Verify security controls work as intended
4. **Update documentation**: Document security-relevant changes
5. **Use secure practices**: Follow OWASP guidelines

See [OPENSOURCE_SECURITY.md](../OPENSOURCE_SECURITY.md) for open-source security principles.

## 🛡️ Security Features

This application implements multiple security layers:

| Layer | Implementation |
|-------|---------------|
| **Transport** | HTTPS/TLS encryption |
| **Origin Control** | CORS with whitelist |
| **Request Validation** | CSRF token validation |
| **Rate Limiting** | SlowAPI per-endpoint limits |
| **Authentication** | GitHub OAuth + JWT |
| **Session Security** | HTTP-only cookies |
| **Input Validation** | Pydantic models |
| **Query Safety** | Parameterized queries |
| **Security Headers** | X-Frame, CSP, etc. |
| **Secrets Management** | Environment variables |

## 📚 Security Documentation

- **[SECURITY.md](../SECURITY.md)** - Comprehensive security guidelines
- **[OPENSOURCE_SECURITY.md](../OPENSOURCE_SECURITY.md)** - Open source security model
- **[DEPLOYMENT.md](../DEPLOYMENT.md)** - Secure deployment instructions
- **[.env.example](../.env.example)** - Configuration template

## 🏆 Security Hall of Fame

We recognize and thank security researchers who help improve this project:

<!-- Add names here as vulnerabilities are reported and fixed -->

*Be the first to responsibly disclose a vulnerability!*

## ❓ Questions?

For general security questions (non-sensitive):
- Open a [GitHub Discussion](../../discussions)
- Reference our [SECURITY.md](../SECURITY.md) documentation

For vulnerabilities or sensitive security concerns:
- Use private disclosure methods above
- Do not discuss publicly until fixed

---

**Thank you for helping keep Papers2Code secure!** 🙏
