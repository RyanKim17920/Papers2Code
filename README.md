# Papers-2-code

A web application for organizing research papers and tracking their implementation progress.

## Development

- Backend: FastAPI service under `papers2code_app2`.
- Frontend: React/Vite app in `papers2code-ui`.

Use `run_app2.py` to start the API and `npm start` inside `papers2code-ui` to launch the UI.

## Repository Layout

- `papers2code_app2/` - FastAPI backend
  - `schemas/` - Pydantic models used throughout the API
  - `auth/` - authentication helpers
  - `routers/` - route declarations
  - `services/` - business logic services
- `papers2code-ui/` - React/Vite front-end
  - `src/assets/` - static assets
  - `src/common/` - shared hooks, services, and components
- `scripts/` - helper scripts for working with the database
