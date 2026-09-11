# SplitWeave backend

FastAPI service for SplitWeave, managed with `uv`. The default repository uses SQLAlchemy and SQLite behind a database-agnostic persistence interface. An in-memory implementation remains available for isolated tests.

## Start

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

- API root: `http://localhost:8000/api/v1`
- Health check: `http://localhost:8000/api/v1/health`
- Swagger UI: `http://localhost:8000/docs`

The default database is `sqlite:///./splitweave.db`. Override it with `SPLITWEAVE_DATABASE_URL`; the service and API layers do not depend on SQLite-specific models or queries.

## Verify

```bash
uv run pytest
uv run ruff check .
uv lock --check
```

## Regenerate OpenAPI

```bash
uv run python scripts/export_openapi.py
```

The generated contract is committed at `_docs/openapi.yaml` in the repository root.
