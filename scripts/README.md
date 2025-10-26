# Scripts

Utility scripts for managing Papers2Code.

## Structure

```
scripts/
├── cron/                    # Automated background tasks
├── deploy_render.sh         # Render deployment
├── setup_cron_jobs.sh       # Configure cron jobs
├── process_pwc_data.py      # Import Papers With Code data
├── update_pwc_data.py       # Update PWC data
├── popular-papers.py        # Calculate analytics
├── copy_prod_data_to_test.py # Copy data between environments
└── migrate_*.py             # Database migrations
```

## Main Scripts

### Deployment
- **`deploy_render.sh`** - Deploy to Render.com
- **`setup_cron_jobs.sh`** - Configure automated tasks

### Data Management
- **`process_pwc_data.py`** - Import papers from Papers With Code
- **`update_pwc_data.py`** - Update existing data
- **`copy_prod_data_to_test.py`** - Copy production to test
- **`popular-papers.py`** - Calculate popular papers

### Database
- **`migrate_*.py`** - Various database migrations

## Usage

```bash
# Import data
uv run scripts/process_pwc_data.py

# Deploy
./scripts/deploy_render.sh

# Setup cron
./scripts/setup_cron_jobs.sh production
```

See [cron/README.md](cron/README.md) for background task details.
