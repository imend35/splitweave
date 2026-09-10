# SplitWeave backend

FastAPI service for SplitWeave, managed with `uv`. This stage uses an in-memory repository behind a persistence interface; SQLAlchemy will replace only that implementation in the database stage.

## Start

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

- API root: `http://localhost:8000/api/v1`
- Health check: `http://localhost:8000/api/v1/health`
- Swagger UI: `http://localhost:8000/docs`

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
