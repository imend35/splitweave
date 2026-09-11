# SplitWeave

> **Shared expenses, woven fairly.**

SplitWeave is an AI-assisted full-stack web application for tracking and settling shared expenses across trips, households, friend groups, and work teams. It is being built for **Homework 2 of the DataTalksClub AI Dev Tools Zoomcamp 2026**.

## Project status

🧭 **Current phase:** Frontend/backend integration complete — SQLAlchemy persistence is next.

The application will be delivered incrementally: interactive frontend prototype, test-first FastAPI backend, frontend/backend integration, and SQLAlchemy persistence.

## Why SplitWeave?

Shared expenses become difficult to reconcile when different people pay, only some members participate, or costs are divided unequally. SplitWeave provides a transparent source of truth for:

- what the group spent;
- who paid each expense;
- how every expense was divided;
- who owes and who should receive money; and
- which repayments can settle the group.

## MVP capabilities

- Create groups for trips, households, friends, or work teams.
- Add, rename, deactivate, and reactivate group members.
- Record expenses with one payer and selected participants.
- Split by equal amounts, exact amounts, percentages, or weighted shares.
- Handle financial rounding deterministically with decimal arithmetic.
- Calculate per-member balances that always reconcile to zero.
- Generate simplified settlement suggestions.
- Record full or partial repayments without moving real money.
- Filter expense history and review group activity.
- Use the main flows from desktop and mobile browsers.

## Planned architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | Responsive UI and centralized API client |
| Backend | Python, FastAPI, Pydantic | REST API, validation, and business rules |
| Persistence | SQLAlchemy, SQLite | Database-agnostic repository implementation |
| Tooling | `uv`, npm | Reproducible dependency and command management |
| Testing | pytest, frontend test tooling | Calculation, endpoint, and user-flow verification |

## Financial correctness

Money is never calculated with binary floating-point arithmetic. SplitWeave uses fixed-precision decimal or integer minor-unit calculations and applies deterministic largest-remainder allocation when a split produces rounding differences.

Core invariant:

```text
sum(member net balances) = 0
```

## Repository structure

```text
splitweave/
├── _docs/
│   ├── specs.md          # Product requirements and acceptance criteria
│   └── openapi.yaml      # Generated during backend development
├── backend/              # FastAPI application and tests
├── frontend/             # React application and tests
├── .gitignore
├── AGENTS.md
└── README.md
```

The `frontend/` application is implemented. The `backend/` folder and OpenAPI document will be added during the backend stage.

## Product specification

The complete MVP scope, business rules, domain model, API outline, acceptance criteria, and test strategy are documented in [`_docs/specs.md`](_docs/specs.md).

## Delivery roadmap

- [x] Choose project and product name.
- [x] Write the product specification.
- [x] Establish repository documentation and agent guidance.
- [x] Build an interactive frontend against a centralized mock API.
- [x] Build a test-first FastAPI backend with an in-memory repository.
- [x] Connect the frontend to the backend.
- [ ] Replace the mock repository with SQLAlchemy persistence.
- [ ] Run automated and manual end-to-end verification.
- [ ] Record a short product demo and publish the learning summary.

## Frontend development

Requirements: Node.js 22.12+ and npm.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend talks to FastAPI at `http://localhost:8000/api/v1` by default. Backend access remains centralized in `frontend/src/api/`; set `VITE_USE_MOCK_API=true` only when demonstrating the standalone mocked prototype.

Available verification commands:

```bash
cd frontend
npm test
npm run build
```

## Backend development

Requirements: Python 3.12+ and [`uv`](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

The API is available at [http://localhost:8000/api/v1](http://localhost:8000/api/v1), with interactive documentation at [http://localhost:8000/docs](http://localhost:8000/docs). During this homework stage, the backend uses a deterministic in-memory repository seeded with an **Aegean Weekend** demo group; data resets when the process restarts.

Run the frontend and backend commands in separate terminals for full-stack development. The allowed browser origins and frontend API URL can be overridden with the variables documented in `.env.example`.

Run the backend quality checks with:

```bash
cd backend
uv run pytest
uv run ruff check .
```

Regenerate the committed API contract after route or schema changes:

```bash
cd backend
uv run python scripts/export_openapi.py
```

## Scope boundary

The Homework 2 MVP records expenses and repayments but does **not** transfer money. Authentication, invitations, live foreign-exchange conversion, receipt OCR, and native mobile applications are intentionally outside the initial scope.

## AI-assisted development

This project follows a spec-first, test-conscious workflow using an AI coding assistant. Product decisions, validation rules, and financial invariants are written down before implementation so generated code can be reviewed against explicit acceptance criteria.

## Author

**Esila Nur Demirci**  
[GitHub: @imend35](https://github.com/imend35)
