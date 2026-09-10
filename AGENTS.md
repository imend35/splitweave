# AGENTS.md — SplitWeave Engineering Guide

This file defines the working rules for AI coding agents and human contributors in this repository.

## 1. Source of truth

- Read [`_docs/specs.md`](_docs/specs.md) before planning or implementing a feature.
- Treat the approved MVP scope, validation rules, financial formulas, API behavior, and acceptance criteria in the specification as authoritative.
- Do not silently broaden the scope. Record a proposed product change in the specification before implementing it.
- Keep `README.md`, the OpenAPI contract, tests, and implementation aligned with the current behavior.

## 2. Delivery order

Follow this sequence unless the user explicitly changes it:

1. Repository foundation and product documentation.
2. Interactive React frontend using a centralized mock API.
3. OpenAPI contract and test-first FastAPI backend using an in-memory repository.
4. Frontend/backend integration.
5. SQLAlchemy repository replacing the in-memory backend store.
6. Automated tests, manual browser verification, and final documentation.

Do not implement later phases in a way that prevents the required staged homework evidence.

## 3. Repository boundaries

```text
frontend/   React + TypeScript + Vite application
backend/    FastAPI application, persistence, and backend tests
_docs/      Product and API documentation
```

- Keep frontend and backend dependency manifests inside their own directories.
- Do not commit secrets, `.env` files, virtual environments, dependency folders, build output, coverage output, caches, logs, or local databases.
- Commit lock files such as `uv.lock` and `package-lock.json` for reproducibility.

## 4. Frontend rules

- Use React with TypeScript in strict mode and Vite.
- Put all backend access behind the centralized interface in `frontend/src/api/`.
- Presentation components must not call `fetch` directly.
- The mock and HTTP implementations must satisfy the same API interface.
- Keep money values as decimal strings at the API boundary; do not introduce floating-point financial calculations.
- Provide explicit loading, empty, success, validation, and unexpected-error states.
- Support the main user flows at 360 px width and on desktop.
- Do not communicate positive, negative, or settled states through color alone.
- Prefer small, reusable components and accessible native controls.

## 5. Backend rules

- Use Python, FastAPI, Pydantic, SQLAlchemy, and `uv`.
- Organize the backend into clear boundaries: API routers, schemas, domain/services, and repositories/persistence.
- Route handlers coordinate HTTP concerns; they must not contain split or balance algorithms.
- Domain services must not depend directly on FastAPI or a concrete database.
- Repositories provide the persistence boundary so the in-memory and SQLAlchemy implementations remain interchangeable.
- Use `Decimal` or integer minor units for all money calculations. Never use `float` for monetary domain logic.
- Serialize money as strings with exactly two decimal places.
- Use UTC for stored datetimes and ISO 8601 at the API boundary.
- Return the documented status codes and stable error shape.
- Keep CORS origins and the database URL configurable through environment variables.

## 6. Financial invariants

Every implementation and refactor must preserve these rules:

- Allocated expense shares sum exactly to the expense total.
- Group member net balances sum exactly to zero.
- Settlement suggestions settle every non-zero balance in minor units.
- Editing or deleting an expense recalculates balances from source transactions.
- Recording or deleting a settlement affects each involved member exactly once.
- Equal fractional remainders are resolved deterministically by submitted participant order.

Reject invalid data rather than silently correcting user-entered exact amounts or percentages.

## 7. Testing expectations

- Write or update tests before implementing backend behavior whenever practical.
- Add a regression test for every defect fixed.
- Test business rules at the service level and HTTP behavior at the API level.
- Keep tests deterministic, isolated, and independent of execution order.
- Use temporary databases or isolated transactions; never depend on the developer's local database.
- Cover success, validation, not-found, conflict, and boundary cases.
- Run the relevant focused tests while developing and the full suite before declaring a task complete.

## 8. Change workflow

For each task:

1. Read the relevant specification sections and existing tests.
2. State the intended behavior and affected files.
3. Make the smallest coherent change that satisfies the acceptance criteria.
4. Format and lint changed code.
5. Run relevant tests, followed by the full available suite.
6. Review the diff for unrelated changes, generated files, secrets, and stale documentation.
7. Report what changed, what was verified, and any remaining limitation.

Do not claim that a command, test, integration, or browser flow passed unless it was actually run successfully.

## 9. API and data changes

- Update schemas, OpenAPI documentation, service logic, persistence mappings, frontend types, and tests together when a contract changes.
- Prefer additive, backwards-compatible API changes during the MVP.
- Validate that referenced group and member resources belong to the same group.
- Use database constraints as a second line of defense, not a substitute for domain validation.
- Avoid destructive migrations while the MVP data model is stabilizing.

## 10. Code quality

- Choose descriptive names over comments that repeat the code.
- Keep functions focused and avoid duplicated business rules.
- Add comments for non-obvious financial reasoning and deterministic tie-breaking.
- Use structured exceptions/errors for expected domain failures.
- Avoid premature abstractions unrelated to the current delivery phase.
- Preserve user-authored changes and keep commits focused.

## 11. Definition of complete

A task is complete only when:

- implementation matches the approved specification;
- relevant automated tests pass;
- required documentation is current;
- no secrets or ignored artifacts are staged;
- the final diff contains only intended changes; and
- the exact commands and verification results can be reported truthfully.

