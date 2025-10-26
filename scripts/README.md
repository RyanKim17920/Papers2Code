# Scripts Directory

This directory contains utility scripts and tools for managing the Papers2Code platform.

## Directory Structure

```
scripts/
├── cron/                          # Automated background tasks
│   ├── email-updater.py          # Update email statuses
│   ├── test.py                   # Test suite for cron jobs
│   └── README.md                 # Cron job documentation
├── deploy_render.sh              # Render.com deployment script
├── setup_cron_jobs.sh            # Configure cron jobs
├── LLM_annotator.py              # AI-powered paper annotation
├── paper_annotator.py            # Paper annotation utilities
├── process_pwc_data.py           # Import Papers With Code data
├── update_pwc_data.py            # Update Papers With Code data
├── popular-papers.py             # Calculate popular papers analytics
├── copy_prod_data_to_test.py     # Copy production data to test environment
├── migrate_*.py                  # Database migration scripts
├── run_app2_enhanced.py          # Enhanced application runner (experimental)
├── run_task.py                   # Task runner utility
└── utils_dbkeys.py               # Database key utilities
```

## Core Scripts

### Deployment
- **`deploy_render.sh`** - Automated deployment to Render.com
- **`setup_cron_jobs.sh`** - Configure automated background tasks

### Data Management
- **`process_pwc_data.py`** - Import papers from Papers With Code dataset
- **`update_pwc_data.py`** - Update existing papers with new data
- **`copy_prod_data_to_test.py`** - Copy production database to test environment
- **`popular-papers.py`** - Calculate and cache popular papers metrics

### Database Migrations
- **`migrate_implementation_progress.py`** - Migrate implementation progress data
- **`migrate_remove_user_recent_views.py`** - Clean up user view data

### Utilities
- **`LLM_annotator.py`** - Use AI to annotate and categorize papers
- **`paper_annotator.py`** - Manual paper annotation tools
- **`run_task.py`** - Generic task runner
- **`utils_dbkeys.py`** - Database key management utilities

### Experimental
- **`run_app2_enhanced.py`** - Enhanced version of the main app runner with additional production features (experimental, not used in production)

## Usage

### Import Papers With Code Data
```bash
uv run scripts/process_pwc_data.py
```

### Update Existing Data
```bash
uv run scripts/update_pwc_data.py
```

### Deploy to Render
```bash
./scripts/deploy_render.sh
```

### Setup Cron Jobs
```bash
# Production
./scripts/setup_cron_jobs.sh production

# Development
./scripts/setup_cron_jobs.sh development
```

### Copy Production Data to Test
```bash
uv run scripts/copy_prod_data_to_test.py
```

## Environment Variables

Most scripts respect the following environment variables:
- `ENV_TYPE` - Environment type (DEV, PROD, PROD_TEST)
- `MONGO_CONNECTION_STRING` - MongoDB connection string
- `MONGO_URI_DEV` - Development MongoDB URI
- `MONGO_URI_PROD` - Production MongoDB URI
- `MONGO_URI_PROD_TEST` - Test MongoDB URI

## Background Tasks

See the [cron/README.md](cron/README.md) for detailed information about automated background tasks.

## Adding New Scripts

When adding new scripts:
1. Add appropriate shebang: `#!/usr/bin/env python3`
2. Include docstring explaining purpose
3. Handle environment variables appropriately
4. Update this README with script description
5. Make shell scripts executable: `chmod +x script.sh`

## Related Documentation

- [Deployment Guide](../docs/deployment/DEPLOYMENT.md)
- [Cron Jobs](cron/README.md)
