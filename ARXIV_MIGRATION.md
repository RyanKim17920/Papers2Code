# ArXiv Migration Guide

This document explains the migration from Papers with Code to ArXiv as the primary data source for the Papers2Code platform.

## Background

Papers with Code was sunsetted in 2024, making their data dumps no longer available. To continue providing fresh research papers to the community, we've migrated to using ArXiv as our primary data source.

## What Changed

### Data Source
- **Before**: Papers with Code API and data dumps
- **After**: ArXiv API with focused categories (cs.CV, cs.LG, cs.AI, etc.)

### Data Extraction Scripts
- **Deprecated**: `scripts/process_pwc_data.py`, `scripts/update_pwc_data.py`
- **New**: `scripts/arxiv_extractor.py`, `scripts/update_arxiv_data.py`

### Cron Jobs
- **Added**: `api/cron/arxiv-updater.py` for periodic ArXiv data extraction
- **Schedule**: Every 12 hours in production, daily in development

### Database Schema
- **No changes** - Existing schema maintained for compatibility
- ArXiv papers use `arxiv_id` field and ArXiv URLs as `paper_url`
- All new papers default to "Needs Code" status for community curation

## Configuration

### Environment Variables (Optional)
```bash
# ArXiv categories to extract (comma-separated)
ARXIV_CATEGORIES="cs.CV,cs.LG,cs.AI,cs.CL,cs.IR,cs.NE,cs.RO,stat.ML,eess.IV,eess.SP"

# Maximum papers to fetch per update
ARXIV_MAX_RESULTS=1000

# Days to look back for first run
ARXIV_DAYS_BACK=30
```

### Cron Job Setup
```bash
# Install all cron jobs including ArXiv updater
./scripts/setup_cron_jobs.sh production

# Or manually add ArXiv updater
# Production: every 12 hours
0 */12 * * * cd /path/to/papers2code && python api/cron/arxiv-updater.py >> /var/log/papers2code/arxiv-updater.log 2>&1
```

## Manual Operations

### Extract New Papers
```bash
# Run ArXiv update manually
uv run scripts/update_arxiv_data.py

# Or via cron wrapper
python api/cron/arxiv-updater.py
```

### Monitor Updates
```bash
# Check logs
tail -f /var/log/papers2code/arxiv-updater.log

# Check update metadata in database
# Collection: update_metadata
# Filter: {"update_type": "arxiv_extraction"}
```

## Migration Impact

### Positive Changes
- ✅ Fresh data source that won't be deprecated
- ✅ Faster updates (ArXiv publishes daily)
- ✅ Better category filtering for ML/AI papers
- ✅ Proper incremental update tracking

### Considerations
- ⚠️ No automatic code repository linking (PWC's main feature)
- ⚠️ All new papers require community curation
- ⚠️ Different paper metadata structure (ArXiv vs PWC)

### Data Quality
- ArXiv focuses on preprints, so quality varies
- Community voting on implementability becomes more important
- May need ML-based filtering for paper relevance (planned)

## Troubleshooting

### Common Issues

1. **Network errors**: ArXiv API may be temporarily unavailable
   - Solution: Retry mechanisms built-in, check logs

2. **Rate limiting**: ArXiv has API rate limits
   - Solution: Built-in delays and batch processing

3. **No new papers**: Normal if run frequently
   - Solution: Check `since_date` in logs

### Log Analysis
```bash
# Successful update
grep "completed successfully" /var/log/papers2code/arxiv-updater.log

# Errors
grep "ERROR" /var/log/papers2code/arxiv-updater.log

# Papers added
grep "papers added" /var/log/papers2code/arxiv-updater.log
```

## Future Enhancements

- [ ] ML-based paper relevance filtering
- [ ] Integration with GitHub API for automatic code detection
- [ ] Enhanced paper categorization using ArXiv categories
- [ ] Community-driven paper source suggestions

## Support

For issues with the ArXiv migration:
1. Check the logs first
2. Verify network connectivity to ArXiv API
3. Test manual extraction: `python api/cron/arxiv-updater.py`
4. Create an issue with log excerpts if problems persist