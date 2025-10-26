# Repository Reorganization Guide

This document explains the recent reorganization of the Papers2Code repository and helps you navigate the new structure.

## 🎯 What Changed?

The repository has been reorganized to reduce clutter and improve maintainability. Here's a summary:

### Before and After

**Before:**
```
Papers2Code/
├── README.md
├── SECURITY.md, SECURITY_ARCHITECTURE.md, etc. (5 security files)
├── DEPLOYMENT.md, PERFORMANCE_OPTIMIZATIONS.md, etc.
├── GEMINI.md, user_actions_aggregated.md (unused)
├── test_*.py (5 test files in root)
├── cleanup_test_data.py (empty)
├── eslint.config.js, eslint.config.mjs (duplicates)
├── tsconfig*.json (3 files, duplicates)
├── vite.config.ts (duplicate)
├── api/
│   ├── cron/
│   └── index.py (empty)
├── papers2code_app2/
├── papers2code-ui/
├── scripts/
│   └── (some empty files)
└── ...
```

**After:**
```
Papers2Code/
├── README.md, LICENSE, TODO.md, NOTES.md (essentials only)
├── docs/                          # NEW: All documentation
│   ├── README.md
│   ├── security/                  # Security guides
│   └── deployment/                # Deployment guides
├── tests/                         # NEW: All test files
│   ├── README.md
│   └── *.py
├── scripts/                       # Reorganized scripts
│   ├── README.md
│   ├── cron/                      # Background tasks
│   │   ├── README.md
│   │   └── *.py
│   └── *.py
├── papers2code_app2/             # Backend (unchanged)
├── papers2code-ui/               # Frontend (unchanged)
└── ...
```

## 📝 Key Changes

### 1. Documentation Organization
All documentation is now in the `docs/` directory:
- **Security docs**: `docs/security/` (5 files)
- **Deployment docs**: `docs/deployment/` (3 files)
- **Index**: `docs/README.md` - Start here for documentation

### 2. Test Files Consolidated
All test files moved to `tests/` directory:
- `test_cron_comprehensive.py`
- `test_cron_imports.py`
- `test_performance.py`
- `test_copy_script.py`
- `quick_performance_test.py`

### 3. Scripts Reorganized
- Background tasks moved from `api/cron/` to `scripts/cron/`
- Experimental files moved to `scripts/`
- Empty files removed
- Added `scripts/README.md` for guidance

### 4. Removed Items
**Empty files:**
- `cleanup_test_data.py`
- `api/index.py`
- `api/requirements.txt`
- 4 empty scripts in `scripts/`

**Duplicate configs:**
- Root-level `eslint.config.js` and `eslint.config.mjs` (kept in `papers2code-ui/`)
- Root-level `tsconfig*.json` files (kept in `papers2code-ui/`)
- Root-level `vite.config.ts` (kept in `papers2code-ui/`)

**Unused documentation:**
- `GEMINI.md` (Copilot instructions, not needed in repo)
- `user_actions_aggregated.md` (obsolete)

**Build artifacts:**
- `*.tsbuildinfo` files (now in .gitignore)

### 5. Updated References
All path references have been updated:
- `scripts/setup_cron_jobs.sh` - Points to `scripts/cron/`
- `tests/test_cron_imports.py` - Updated paths
- `README.md` - Updated documentation links
- `scripts/cron/README.md` - Updated paths

## 🔍 How to Find Things

### Looking for Documentation?
Start at `docs/README.md` or check these quick links:
- Security: `docs/security/SECURITY.md`
- Deployment: `docs/deployment/DEPLOYMENT.md`
- Performance: `docs/deployment/PERFORMANCE_OPTIMIZATIONS.md`

### Looking for Tests?
All tests are in `tests/` directory. See `tests/README.md` for how to run them.

### Looking for Scripts?
All utility scripts are in `scripts/` directory. See `scripts/README.md` for descriptions.

### Looking for Backend/Frontend Code?
No changes! Still in:
- Backend: `papers2code_app2/`
- Frontend: `papers2code-ui/`

## 🚀 What You Need to Do

### If You're a Developer

**Nothing!** All the changes are organizational. Your development workflow remains the same:

```bash
# Backend still works the same
uv sync
uv run run_app2.py

# Frontend still works the same
cd papers2code-ui
npm install
npm run dev
```

### If You Have Scripts or Automation

**Update paths** if you reference any moved files:
- `api/cron/email-updater.py` → `scripts/cron/email-updater.py`
- Security docs: Check `docs/security/` instead of root
- Deployment docs: Check `docs/deployment/` instead of root

### If You're Deploying

The main deployment files are unchanged:
- `render.yaml` - Still in root
- `pyproject.toml` - Still in root
- `run_app2.py` - Still in root
- Deployment guide: Now at `docs/deployment/DEPLOYMENT.md`

## 📚 README Files

Each directory now has a README for guidance:
- `docs/README.md` - Documentation index
- `scripts/README.md` - Scripts directory guide
- `tests/README.md` - Testing guide
- `scripts/cron/README.md` - Cron jobs documentation

## 🎯 Benefits

1. **Cleaner Root** - 15+ files removed from root directory
2. **Better Organization** - Clear separation: docs/, tests/, scripts/
3. **Easier Navigation** - README in each directory
4. **No Confusion** - Duplicate configs removed
5. **Professional** - Structure matches industry best practices

## ❓ Questions?

- **Breaking changes?** No! Only organizational changes.
- **Backend/Frontend affected?** No changes to application code.
- **Need to update local repo?** Just pull the latest changes.
- **Links broken?** All internal references updated.

## 🔗 Quick Links

- [Main README](../README.md)
- [Documentation Index](README.md)
- [Scripts Guide](../scripts/README.md)
- [Tests Guide](../tests/README.md)
- [Deployment Guide](deployment/DEPLOYMENT.md)
- [Security Guide](security/SECURITY.md)

---

**Last Updated**: October 2025
**Migration**: copilot/organize-repo-structure branch
