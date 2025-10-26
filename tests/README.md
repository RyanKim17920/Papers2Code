# Tests

Test files for Papers2Code.

## Files

- **`test_cron_comprehensive.py`** - Cron job tests
- **`test_cron_imports.py`** - Cron import tests
- **`test_performance.py`** - Performance tests
- **`test_copy_script.py`** - Data copy tests
- **`quick_performance_test.py`** - Quick performance check

## Running Tests

```bash
# All tests
uv run pytest tests/

# Specific test
uv run pytest tests/test_cron_comprehensive.py

# Performance check
uv run python tests/quick_performance_test.py
```

Tests use the DEV environment. Set environment variables in `.env`.
