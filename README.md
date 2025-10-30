# Papers-2-Code

A web application for organizing research papers and tracking their implementation progress with community voting, author contact, and progress tracking.

> **🔓 Open Source & Secure**: This codebase is designed to be 100% public while maintaining production-grade security. See [OPENSOURCE_SECURITY.md](docs/security/OPENSOURCE_SECURITY.md) to learn how we achieve security through design, not obscurity.

## 🚀 Quick Start

### Development Setup
```bash
# Backend (FastAPI)
uv sync
uv run run_app2.py

# Frontend (React/Vite) - in another terminal
cd papers2code-ui
npm install
npm run dev
```

Visit `http://localhost:5173` for the frontend and `http://localhost:5000` for the API.

### Production Deployment

**🚀 Complete Deployment Guide**: [RENDER_COMPLETE_GUIDE.md](docs/deployment/RENDER_COMPLETE_GUIDE.md)

Deploy your own instance to **Render** in 15-20 minutes:
- ✅ Free tier available (backend sleeps after 15 min)
- ✅ $7/month for always-on production backend
- ✅ Frontend always free
- ✅ One-platform solution for frontend + backend
- ✅ Automatic deployments from Git

**Quick overview**: See [DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)

**Automated script**: Run the interactive deployment helper:
```bash
./scripts/deploy_render.sh
```

**🔒 Security Documentation**: 
- **🚀 Quick Start**: [SECURITY_QUICK_START.md](docs/security/SECURITY_QUICK_START.md) - Fast setup guide
- **📖 Full Guide**: [SECURITY.md](docs/security/SECURITY.md) - Complete security documentation
- **🔓 Open Source**: [OPENSOURCE_SECURITY.md](docs/security/OPENSOURCE_SECURITY.md) - How public code stays secure
- **🏗️ Architecture**: [SECURITY_ARCHITECTURE.md](docs/security/SECURITY_ARCHITECTURE.md) - Technical security design
- **⚙️ Configuration**: [.env.example](.env.example) - All environment variables explained
- **🛡️ Policy**: [.github/SECURITY_POLICY.md](.github/SECURITY_POLICY.md) - Vulnerability reporting

## 📁 Project Structure

```
Papers-2-code/
├── papers2code_app2/          # FastAPI Backend
│   ├── schemas/               # Pydantic models & validation
│   ├── routers/              # API route handlers
│   ├── services/             # Business logic services
│   ├── auth/                 # Authentication utilities
│   └── main.py               # FastAPI application entry
├── papers2code-ui/           # React Frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page-level components
│   │   ├── common/          # Shared utilities & services
│   │   └── assets/          # Static assets
├── docs/                     # Documentation
│   ├── security/             # Security documentation
│   └── deployment/           # Deployment guides
├── scripts/                  # Utility scripts & deployment
│   ├── deploy_render.sh      # Render deployment script
│   └── *.py                  # Database utilities
├── pyproject.toml            # Python dependencies & project config
├── uv.lock                   # Locked dependency versions
├── render.yaml               # Render deployment blueprint
└── README.md                 # This file
```

## ✨ Features

### Core Functionality
- **📚 Paper Management**: Add, search, and organize research papers
- **🗳️ Community Voting**: Vote on paper implementability 
- **👥 User Authentication**: GitHub and Google OAuth integration
- **📊 Progress Tracking**: Track implementation progress and status
- **✉️ Author Contact**: Contact paper authors with automated follow-up
- **🔍 Advanced Search**: MongoDB Atlas search with relevance scoring

### User Roles
- **Community Members**: Vote on papers, track progress
- **Moderators**: Manage paper submissions and community content
- **Admins**: Full system access and user management

### Technical Features
- **🔒 Security**: CSRF protection, rate limiting, secure headers
- **📱 Responsive**: Mobile-friendly React interface
- **⚡ Performance**: Efficient caching and optimized queries
- **🔄 Real-time**: Live updates for voting and progress
- **🌐 API-First**: Comprehensive REST API with OpenAPI docs

## 🛠️ Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **uv**: Fast Python package manager and project manager
- **MongoDB**: Document database with Atlas Search
- **Pydantic**: Data validation and serialization
- **JWT**: Secure authentication tokens
- **OAuth 2.0**: GitHub and Google authentication

### Frontend  
- **React 18**: Modern UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **React Query**: Server state management

### Infrastructure
- **Render**: Full-stack hosting (recommended)
- **MongoDB Atlas**: Managed database service
- **OAuth Providers**: GitHub and Google authentication

## 📖 API Documentation

When running locally, visit:
- **Interactive Docs**: `http://localhost:5000/docs`
- **ReDoc**: `http://localhost:5000/redoc` 
- **OpenAPI Schema**: `http://localhost:5000/openapi.json`

### Key API Endpoints

```
Authentication:
GET    /api/auth/github/login     # GitHub OAuth login
GET    /api/auth/google/login     # Google OAuth login
POST   /api/auth/logout           # User logout
GET    /api/auth/me               # Current user info
GET    /api/auth/csrf-token       # Get CSRF token

Papers:
GET    /api/papers                # List papers with search/filter
POST   /api/papers                # Add new paper
GET    /api/papers/{id}           # Get paper details
PUT    /api/papers/{id}           # Update paper

Voting & Progress:
POST   /api/papers/{id}/vote      # Vote on implementability  
GET    /api/papers/{id}/progress  # Get implementation progress
POST   /api/papers/{id}/progress  # Update progress

User Management:
GET    /api/users/profile         # User profile
PUT    /api/users/profile         # Update profile
GET    /api/admin/users           # Admin: list users
```

## 🔧 Development

### Prerequisites
- **Python 3.12+** with uv
- **Node.js 16+** with npm
- **MongoDB** (local or Atlas)
- **OAuth Apps** (GitHub and/or Google for authentication)

### Environment Setup

Create `.env` in the project root:
```bash
# Database
MONGO_CONNECTION_STRING=mongodb://localhost:27017/papers2code

# Authentication  
FLASK_SECRET_KEY=your-secret-key-here

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your-github-oauth-id  
GITHUB_CLIENT_SECRET=your-github-oauth-secret

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (for author outreach - manual sending)
OUTREACH_EMAIL_ADDRESS=your-email@example.com

# Application
ENV_TYPE=DEV
FRONTEND_URL=http://localhost:5173
APP_LOG_LEVEL=INFO
```

**Note**: See [GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md) for detailed Google OAuth configuration.

### Backend Development
```bash
# Install dependencies
uv sync

# Run development server
uv run run_app2.py

# Run with auto-reload
uv run uvicorn papers2code_app2.main:app --reload --port 5000
```

### Frontend Development  
```bash
cd papers2code-ui

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Setup

The application will automatically create indexes on startup. For manual database management:

```bash
# Run database utilities
uv run scripts/process_pwc_data.py      # Import Papers With Code data
uv run scripts/update_pwc_data.py       # Update existing data
```

## 🧪 Testing

```bash
# Backend tests
uv run pytest

# Frontend tests  
cd papers2code-ui
npm test

# E2E tests
npm run test:e2e
```

## 📊 Monitoring & Analytics

### Health Checks
- **Backend**: `GET /health` - Application health status
- **Database**: Connection monitoring and query performance
- **Frontend**: Build status and deployment health

### Logging
- **Structured logging** with configurable levels
- **Request/response logging** for API calls
- **Error tracking** with stack traces
- **Performance metrics** for optimization

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`  
5. **Open** a Pull Request

### Development Guidelines
- Follow **PEP 8** for Python code
- Use **TypeScript** for all frontend code
- Write **tests** for new features
- Update **documentation** as needed
- Follow **semantic commit** messages

## 🐛 Troubleshooting

### Common Issues

**Backend won't start:**
- Check MongoDB connection string
- Verify environment variables are set
- Ensure dependencies are installed: `uv sync`

**Frontend build fails:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run type-check`
- Verify API_BASE_URL in config.ts

**Authentication not working:**
- Verify GitHub OAuth app configuration
- Check FRONTEND_URL matches your domain
- Ensure cookies are enabled in browser

### Getting Help
- **Issues**: Open a GitHub issue with detailed description
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Report security issues privately

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Papers With Code** for research paper data
- **FastAPI** and **React** communities  
- **MongoDB Atlas** for search capabilities
- **Render** for hosting infrastructure

---

**Built with ❤️ for the research community**
