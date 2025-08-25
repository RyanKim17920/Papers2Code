#!/bin/bash
"""
Cron Job Setup Script for Papers2Code

This script helps set up cron jobs for the Papers2Code platform.
It creates the necessary cron entries for email updates and popular papers analytics.

Usage: 
  ./setup_cron_jobs.sh [environment]
  
Where environment can be:
  - development (default)
  - production
  - test
"""

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-development}"

# Python executable (adjust path as needed for your environment)
PYTHON_PATH="${PYTHON_PATH:-/usr/bin/python3}"

# Log directory
LOG_DIR="/var/log/papers2code"
mkdir -p "$LOG_DIR" 2>/dev/null || echo "Warning: Could not create log directory $LOG_DIR"

# Cron job configurations
case "$ENVIRONMENT" in
    "production")
        EMAIL_CRON="0 */6 * * *"  # Every 6 hours
        POPULAR_CRON="0 */3 * * *"  # Every 3 hours
        ARXIV_CRON="0 */12 * * *"  # Every 12 hours
        ;;
    "test")
        EMAIL_CRON="*/30 * * * *"  # Every 30 minutes for testing
        POPULAR_CRON="*/15 * * * *"  # Every 15 minutes for testing
        ARXIV_CRON="0 * * * *"  # Every hour for testing
        ;;
    *)  # development
        EMAIL_CRON="0 */12 * * *"  # Every 12 hours
        POPULAR_CRON="0 */6 * * *"  # Every 6 hours
        ARXIV_CRON="0 0 * * *"  # Every 24 hours
        ;;
esac

echo "Setting up Papers2Code cron jobs for $ENVIRONMENT environment..."
echo "Project root: $PROJECT_ROOT"
echo "Python path: $PYTHON_PATH"

# Email updater cron job
EMAIL_SCRIPT="$PROJECT_ROOT/api/cron/email-updater.py"
POPULAR_SCRIPT="$PROJECT_ROOT/scripts/popular-papers.py"
ARXIV_SCRIPT="$PROJECT_ROOT/api/cron/arxiv-updater.py"

# Check if scripts exist
if [[ ! -f "$EMAIL_SCRIPT" ]]; then
    echo "Error: Email updater script not found at $EMAIL_SCRIPT"
    exit 1
fi

if [[ ! -f "$POPULAR_SCRIPT" ]]; then
    echo "Error: Popular papers script not found at $POPULAR_SCRIPT"
    exit 1
fi

if [[ ! -f "$ARXIV_SCRIPT" ]]; then
    echo "Error: ArXiv updater script not found at $ARXIV_SCRIPT"
    exit 1
fi

# Make scripts executable
chmod +x "$EMAIL_SCRIPT"
chmod +x "$POPULAR_SCRIPT"
chmod +x "$ARXIV_SCRIPT"

# Create temporary cron file
TEMP_CRON=$(mktemp)

# Get existing cron jobs (excluding Papers2Code jobs)
crontab -l 2>/dev/null | grep -v "Papers2Code" > "$TEMP_CRON"

# Add Papers2Code cron jobs
cat >> "$TEMP_CRON" << EOF

# Papers2Code Cron Jobs ($ENVIRONMENT environment)
# Email status updater - updates email statuses for implementation progress
$EMAIL_CRON cd $PROJECT_ROOT && $PYTHON_PATH $EMAIL_SCRIPT >> $LOG_DIR/email-updater.log 2>&1

# Popular papers analytics - calculates and caches popular papers
$POPULAR_CRON cd $PROJECT_ROOT && $PYTHON_PATH $POPULAR_SCRIPT >> $LOG_DIR/popular-papers.log 2>&1

# ArXiv data updater - extracts new papers from ArXiv (replaces Papers with Code)
$ARXIV_CRON cd $PROJECT_ROOT && $PYTHON_PATH $ARXIV_SCRIPT >> $LOG_DIR/arxiv-updater.log 2>&1

EOF

# Install the new crontab
if crontab "$TEMP_CRON"; then
    echo "✅ Cron jobs installed successfully!"
    echo ""
    echo "Installed jobs:"
    echo "  📧 Email updater: $EMAIL_CRON"
    echo "  📊 Popular papers: $POPULAR_CRON"
    echo "  🔬 ArXiv data updater: $ARXIV_CRON"
    echo ""
    echo "Logs will be written to:"
    echo "  $LOG_DIR/email-updater.log"
    echo "  $LOG_DIR/popular-papers.log"
    echo "  $LOG_DIR/arxiv-updater.log"
    echo ""
    echo "To view current cron jobs: crontab -l"
    echo "To edit cron jobs: crontab -e"
    echo "To remove Papers2Code cron jobs: crontab -l | grep -v 'Papers2Code' | crontab -"
else
    echo "❌ Failed to install cron jobs"
    exit 1
fi

# Cleanup
rm "$TEMP_CRON"

# Create log rotation config (optional)
if command -v logrotate >/dev/null 2>&1; then
    LOGROTATE_CONFIG="/etc/logrotate.d/papers2code"
    
    if [[ -w "$(dirname "$LOGROTATE_CONFIG")" ]]; then
        cat > "$LOGROTATE_CONFIG" << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 root root
}
EOF
        echo "📋 Log rotation configured at $LOGROTATE_CONFIG"
    else
        echo "⚠️  Could not set up log rotation (insufficient permissions for $LOGROTATE_CONFIG)"
        echo "   Consider manually setting up log rotation for $LOG_DIR/*.log"
    fi
fi

echo ""
echo "🎉 Setup complete! Cron jobs are now active."
echo ""
echo "Next steps:"
echo "1. Check that environment variables are properly set for the cron environment"
echo "2. Monitor the log files for the first few runs"
echo "3. Test the jobs manually if needed:"
echo "   $PYTHON_PATH $EMAIL_SCRIPT"
echo "   $PYTHON_PATH $POPULAR_SCRIPT"
echo "   $PYTHON_PATH $ARXIV_SCRIPT"
