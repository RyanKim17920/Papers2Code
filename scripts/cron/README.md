# Papers2Code Cron Jobs

This directory contains automated background tasks (cron jobs) for the Papers2Code platform.

## Overview

The cron job system handles periodic maintenance tasks like email status updates and popular papers analytics. The system is built on top of the existing `papers2code_app2.background_tasks` module.

## Files

### Core Scripts
- **`email-updater.py`** - Updates email statuses for implementation progress records
- **`../popular-papers.py`** - Calculates and caches popular papers analytics
- **`test.py`** - Test suite for validating cron job functionality

### Deployment
- **`../setup_cron_jobs.sh`** - Bash script to configure cron jobs for different environments

## Email Updater (`email-updater.py`)

### Purpose
Updates email statuses from "Sent" to "No Response" for emails that were sent more than 4 weeks ago without any response.

### Schedule
- **Production**: Every 6 hours (`0 */6 * * *`)
- **Development**: Every 12 hours (`0 */12 * * *`)
- **Test**: Every 30 minutes (`*/30 * * * *`)

### Usage
```bash
# Manual execution
python /path/to/scripts/cron/email-updater.py

# With environment variables
ENV_TYPE=PROD MONGO_URI_PROD=mongodb://... python email-updater.py
```

### Logging
Logs are written to `/var/log/papers2code/email-updater.log` when run via cron.

## Popular Papers Analytics (`../scripts/popular-papers.py`)

### Purpose
Calculates and caches popular papers based on:
- Views in the last 24 hours, 7 days, and 30 days
- Most upvoted papers (all time)
- Recently added papers
- Trending papers (combination of recent views and upvotes)

### Schedule
- **Production**: Every 3 hours (`0 */3 * * *`)
- **Development**: Every 6 hours (`0 */6 * * *`)
- **Test**: Every 15 minutes (`*/15 * * * *`)

### Usage
```bash
# Manual execution
python /path/to/scripts/popular-papers.py
```

### Output
Results are cached in the `popular_papers_cache` collection with the following structure:
```json
{
  "_id": "latest",
  "data": {
    "popular_by_views_24h": [...],
    "popular_by_views_7d": [...],
    "popular_by_views_30d": [...],
    "trending_papers": [...],
    "most_upvoted": [...],
    "recently_added": [...],
    "timestamp": "2025-07-03T..."
  },
  "last_updated": "2025-07-03T..."
}
```

### Logging
Logs are written to `/var/log/papers2code/popular-papers.log` when run via cron.

## Test Suite (`test.py`)

### Purpose
Validates that all cron jobs can execute properly before deployment.

### Usage
```bash
python /path/to/scripts/cron/test.py
```

### Tests
1. **Database Connection** - Verifies async database connectivity
2. **Email Updater** - Tests email status update functionality
3. **View Analytics** - Tests view analytics aggregation

## Deployment

### Quick Setup
```bash
# For production environment
./scripts/setup_cron_jobs.sh production

# For development environment
./scripts/setup_cron_jobs.sh development

# For testing
./scripts/setup_cron_jobs.sh test
```

### Manual Setup
1. Ensure Python environment and dependencies are available
2. Set required environment variables:
   ```bash
   export ENV_TYPE=PROD  # or DEV, PROD_TEST
   export MONGO_URI_PROD=mongodb://...
   # or MONGO_URI_DEV, MONGO_URI_PROD_TEST as appropriate
   ```
3. Add cron entries:
   ```bash
   # Edit crontab
   crontab -e
   
   # Add entries (example for production)
   0 */6 * * * cd /path/to/papers2code && python scripts/cron/email-updater.py >> /var/log/papers2code/email-updater.log 2>&1
   0 */3 * * * cd /path/to/papers2code && python scripts/popular-papers.py >> /var/log/papers2code/popular-papers.log 2>&1
   ```

### Environment Variables

Required environment variables:
- `ENV_TYPE` - Environment type (PROD, DEV, PROD_TEST)
- `MONGO_URI_*` - MongoDB connection string for the corresponding environment
- `LOG_LEVEL` (optional) - Log level (DEBUG, INFO, WARNING, ERROR)

### Log Management

Logs are written to `/var/log/papers2code/` and automatically rotated using logrotate:
- Daily rotation
- Keep 30 days of logs
- Compress old logs
- Don't fail if logs are missing

## Monitoring

### Health Checks
```bash
# Check if cron jobs are running
ps aux | grep python | grep -E "(email-updater|popular-papers)"

# Check recent log entries
tail -f /var/log/papers2code/email-updater.log
tail -f /var/log/papers2code/popular-papers.log

# Test manually
python scripts/cron/test.py
```

### Common Issues

1. **Permission Errors**: Ensure the user running cron has write access to log directory
2. **Environment Variables**: Cron runs with minimal environment; ensure variables are set
3. **Python Path**: Ensure the correct Python interpreter is used in cron
4. **Database Connection**: Verify MongoDB connection strings and network access

### Integration with Render.com

For deployment on Render.com:
1. Use the background tasks router endpoints instead of cron jobs
2. Set up external monitoring service to call endpoints periodically
3. Use Render's environment variables for configuration

## Related Files

- `papers2code_app2/background_tasks.py` - Core background task implementation
- `papers2code_app2/routers/background_tasks_router.py` - HTTP endpoints for background tasks
- `scripts/copy_prod_data_to_test.py` - Enhanced data copying script
- `scripts/update_pwc_data.py` - Database update script
