# Backups Directory

This directory contains backup files created during migrations and data operations.

## Files

- `user_recent_views_backup_*.json` - Backups created when removing the user_recent_views collection during migration

## Retention Policy

- Keep backups for at least 30 days after migration
- Archive older backups to external storage if needed
- Safe to delete backups after verifying migration success and system stability

## Restore Instructions

If you need to restore from a backup:

1. Stop the application
2. Use MongoDB tools to restore the collection:
   ```bash
   mongoimport --db papers2code --collection user_recent_views --file backup_file.json --jsonArray
   ```
3. Revert code changes if necessary
4. Restart the application
