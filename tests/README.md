# Tests Directory

This directory contains test files for the Papers2Code platform.

## Test Files

### Backend Tests
- **`test_cron_comprehensive.py`** - Comprehensive test suite for cron job functionality
- **`test_cron_imports.py`** - Tests for cron job imports and dependencies
- **`test_performance.py`** - Performance benchmarks and tests
- **`quick_performance_test.py`** - Quick performance verification for optimized operations

### Integration Tests
- **`test_copy_script.py`** - Tests for the data copy script functionality

## Running Tests

### All Tests
```bash
# Using pytest
uv run pytest tests/

# With coverage
uv run pytest tests/ --cov=papers2code_app2
```

### Specific Test Files
```bash
# Cron job tests
uv run pytest tests/test_cron_comprehensive.py

# Performance tests
uv run python tests/test_performance.py

# Quick performance check
uv run python tests/quick_performance_test.py
```

## Test Environment

Tests use the `DEV` environment by default. Ensure you have:
- MongoDB instance running (local or test database)
- Required environment variables set in `.env`
- Test dependencies installed via `uv sync`

## Environment Variables

Tests respect these environment variables:
- `ENV_TYPE=DEV` - Set automatically for test environment
- `MONGO_CONNECTION_STRING` - Test database connection
- `MONGO_URI_DEV` - Development/test MongoDB URI

## Writing New Tests

When adding new tests:
1. Follow pytest conventions
2. Use appropriate fixtures for database setup/teardown
3. Mock external services (email, APIs, etc.)
4. Add docstrings explaining test purpose
5. Update this README with new test descriptions

## Related Documentation

- [Backend README](../papers2code_app2/README.md) (if exists)
- [Scripts README](../scripts/README.md)
