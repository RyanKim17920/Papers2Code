# Papers2Code Documentation

Complete documentation for the Papers2Code platform.

## 🚀 Quick Start

**New to Papers2Code?** Start here:
1. [Main README](../README.md) - Project overview and quick start
2. [Security Quick Start](security/SECURITY_QUICK_START.md) - Fast security setup
3. [Deployment Guide](deployment/DEPLOYMENT.md) - How to deploy

## 📖 Documentation Structure

### Security Documentation
Located in `docs/security/`
- **[SECURITY_QUICK_START.md](security/SECURITY_QUICK_START.md)** - Fast setup guide for security
- **[SECURITY.md](security/SECURITY.md)** - Complete security documentation
- **[OPENSOURCE_SECURITY.md](security/OPENSOURCE_SECURITY.md)** - How we maintain security in public code
- **[SECURITY_ARCHITECTURE.md](security/SECURITY_ARCHITECTURE.md)** - Technical security design
- **[SECURITY_INDEX.md](security/SECURITY_INDEX.md)** - Security documentation index

### Deployment Documentation
Located in `docs/deployment/`
- **[DEPLOYMENT.md](deployment/DEPLOYMENT.md)** - Production deployment guide
- **[PERFORMANCE_OPTIMIZATIONS.md](deployment/PERFORMANCE_OPTIMIZATIONS.md)** - Performance tuning guide
- **[BACKEND_VERIFICATION_SUMMARY.md](deployment/BACKEND_VERIFICATION_SUMMARY.md)** - Backend verification details

## 🛠️ Developer Resources

### Getting Started
- [Main README](../README.md) - Setup instructions and project structure
- [Scripts README](../scripts/README.md) - Available utility scripts
- [Tests README](../tests/README.md) - How to run and write tests

### Code Organization
```
Papers2Code/
├── docs/                      # Documentation (you are here)
│   ├── security/             # Security guides
│   └── deployment/           # Deployment guides
├── papers2code_app2/         # FastAPI backend
├── papers2code-ui/           # React frontend
├── scripts/                  # Utility scripts
└── tests/                    # Test files
```

### API Documentation
When running locally, interactive API docs are available at:
- **Swagger UI**: http://localhost:5000/docs
- **ReDoc**: http://localhost:5000/redoc
- **OpenAPI Schema**: http://localhost:5000/openapi.json

## 🔒 Security

Security is a top priority. We maintain production-grade security while keeping our codebase 100% open source.

**Quick Links:**
- [How to report security issues](../.github/SECURITY_POLICY.md)
- [Security architecture overview](security/SECURITY_ARCHITECTURE.md)
- [Open source security approach](security/OPENSOURCE_SECURITY.md)

## 📊 Operations

### Deployment
- [Render.com deployment](deployment/DEPLOYMENT.md)
- [Environment setup](deployment/DEPLOYMENT.md#environment-variables)
- [Performance tuning](deployment/PERFORMANCE_OPTIMIZATIONS.md)

### Monitoring
- [Health checks](../README.md#monitoring--analytics)
- [Logging configuration](../README.md#monitoring--analytics)
- [Performance metrics](deployment/PERFORMANCE_OPTIMIZATIONS.md)

## 🤝 Contributing

Guidelines for contributing to Papers2Code:
1. Follow code style (PEP 8 for Python, ESLint for TypeScript)
2. Write tests for new features
3. Update documentation as needed
4. Follow semantic commit messages
5. Open a pull request

See [README.md](../README.md#contributing) for detailed contribution guidelines.

## 📝 Additional Resources

- [License](../LICENSE) - MIT License
- [TODO](../TODO.md) - Current development tasks
- [NOTES](../NOTES.md) - Development notes and observations

## 🆘 Getting Help

- **Issues**: [GitHub Issues](https://github.com/RyanKim17920/Papers2Code/issues)
- **Discussions**: [GitHub Discussions](https://github.com/RyanKim17920/Papers2Code/discussions)
- **Security**: See [SECURITY_POLICY.md](../.github/SECURITY_POLICY.md)

---

**Last Updated**: October 2025
