# SplitWeave frontend

Responsive React, TypeScript, and Vite client for SplitWeave.

## Start

Start the backend first, then run:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The client uses `http://localhost:8000/api/v1` unless `VITE_API_BASE_URL` is configured.

## Data-source modes

- `VITE_USE_MOCK_API=false` (default): use the FastAPI backend through `src/api/httpApi.ts`.
- `VITE_USE_MOCK_API=true`: use the standalone in-memory prototype through `src/api/mockApi.ts`.

UI components depend only on the common `SplitWeaveApi` interface and never call `fetch` directly.

## Verify

```bash
npm test
npm run build
```
