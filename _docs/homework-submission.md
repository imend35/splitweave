# Homework 2 submission — SplitWeave

This page keeps the final submission answers and verification steps in one place.

## Answers

| Homework prompt | Answer |
| --- | --- |
| Project | Expense splitter |
| Question 1 — application name | SplitWeave |
| Question 2 — specification/foundation commit SHA-1 | `686f22dc23051aaf090e7878eba9ddf195e09674` |
| Question 3 — start the frontend | `cd frontend && npm run dev` |
| Question 4 — start the backend | `cd backend && uv run uvicorn app.main:app --reload --port 8000` |
| Question 5 — frontend API URL | `http://localhost:8000/api/v1` |
| Question 6 — run backend tests | `cd backend && uv run pytest` |

Repository: <https://github.com/imend35/splitweave>

The Question 2 SHA intentionally points to the original repository-foundation commit containing `_docs/specs.md`, `.gitignore`, `README.md`, and `AGENTS.md`. Later commits implement the application without changing that answer.

## Milestone commits

| Stage | Commit |
| --- | --- |
| Repository foundation | [`686f22d`](https://github.com/imend35/splitweave/commit/686f22dc23051aaf090e7878eba9ddf195e09674) |
| Interactive frontend prototype | [`95f3fb0`](https://github.com/imend35/splitweave/commit/95f3fb0698654f40e0ac1212959e698bcf44dcf0) |
| Test-first FastAPI backend | [`66d32e9`](https://github.com/imend35/splitweave/commit/66d32e91d21546920284fbaef273331c8e47d63a) |
| Frontend/backend integration | [`a9b0dab`](https://github.com/imend35/splitweave/commit/a9b0dab397f69ae9a8cd1f5da072435ca09dd6cf) |
| SQLAlchemy persistence | [`15448f0`](https://github.com/imend35/splitweave/commit/15448f0a2b7fd0fcb952aa2a8e178b271cde4377) |

## Automated verification

Run these commands from a fresh clone:

```bash
cd backend
uv sync
uv run ruff check .
uv run pytest
uv lock --check
```

Expected backend result: 17 tests pass and Ruff reports no errors.

```bash
cd frontend
npm install
npm test
npm run build
```

Expected frontend result: 10 tests pass and Vite produces a successful production build.

The persistence acceptance test creates expenses and a partial repayment in a temporary SQLite database, closes the application, opens a new application instance against the same database, and verifies that transactions and recalculated balances are preserved.

## Local browser acceptance walkthrough

Start each application in a separate terminal:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

Then open <http://localhost:5173> in two browser windows and verify:

1. Open the seeded **Aegean Weekend** group in both windows.
2. In the first window, add an expense and confirm that the balances change.
3. Refresh the second window and confirm that the same expense and balances appear.
4. Open **Settle up**, record a full or partial repayment, and confirm the new balances.
5. Refresh the first window and confirm that the repayment appears there too.
6. Stop and restart the backend, refresh the frontend, and confirm that the data remains.

## 60–90 second demo outline

For the exact sample data, second-by-second shot list, narration, and recording checklist, see [`demo-video-guide.md`](demo-video-guide.md).

1. Show the groups screen and open **Aegean Weekend**.
2. Briefly show members, expense history, balances, and settlement suggestions.
3. Add one expense and show the recalculated balances.
4. Refresh a second browser window to demonstrate shared backend state.
5. Record a partial repayment from **Settle up**.
6. Restart the backend and refresh to demonstrate database persistence.

Do not include terminal secrets, personal notifications, or unrelated browser tabs in the recording.
