# SplitWeave — Product Specification

> **Tagline:** Shared expenses, woven fairly.

| Field | Value |
| --- | --- |
| Product | SplitWeave |
| Project type | AI-assisted full-stack web application |
| Version | 1.0 |
| Status | Approved for MVP implementation |
| Specification date | 2026-09-09 |
| Course | DataTalksClub AI Dev Tools Zoomcamp 2026 — Homework 2 |

## 1. Executive summary

SplitWeave is a responsive web application for tracking and settling shared expenses across trips, households, friend groups, and work teams. A user creates a group, adds members, records who paid, selects the people who participated, and divides each expense using one of four methods: equal amounts, exact amounts, percentages, or weighted shares.

The application calculates every member's net position, clearly shows who owes money and who should receive it, and produces a simplified settlement plan. Users can record full or partial repayments without transferring real money through the application.

The MVP is intentionally focused on correct financial calculations, a polished user experience, a clean API boundary, database-agnostic persistence, and meaningful automated tests.

## 2. Problem statement

Shared spending is easy to record informally but difficult to reconcile fairly. Group members may pay different expenses, participate in only some purchases, or agree on unequal shares. Spreadsheets and chat messages make rounding, changing expenses, and tracking repayments error-prone.

SplitWeave provides one consistent source of truth for:

- what the group spent;
- who paid each expense;
- how each expense was divided;
- each member's current net balance; and
- the payments needed to settle the group.

## 3. Product vision

Make shared money management transparent enough that any group can understand and settle its expenses without manual calculations or awkward conversations.

## 4. Goals and success criteria

### 4.1 MVP goals

1. Let users create and manage expense groups and their members.
2. Support four reliable expense-splitting methods.
3. Keep balances mathematically correct after every create, edit, delete, and settlement operation.
4. Suggest a deterministic, simplified set of repayments.
5. Provide a responsive and accessible interface for desktop and mobile browsers.
6. Separate frontend, API, business logic, and persistence concerns.
7. Protect core calculations with automated tests.

### 4.2 Success criteria

- Every valid expense is allocated exactly to its total, including rounding.
- The sum of all member net balances in a group is always zero.
- A user can complete the primary flow—create group, add members, add expense, review balances, and record settlement—without documentation.
- Data remains available after refreshing the browser once database persistence is enabled.
- All required backend tests pass with one documented command.
- The main flow works at a viewport width of 360 px and on a desktop browser.

## 5. Non-goals for the MVP

The following are explicitly outside Homework 2 scope:

- real bank, card, wallet, PayPal, or money-transfer integrations;
- user registration, login, authorization, and email invitations;
- live foreign-exchange conversion or mixed-currency expenses in one group;
- multiple payers for one expense;
- recurring expenses and payment reminders;
- receipt image upload, OCR, or AI categorization;
- real-time collaboration, push notifications, or offline synchronization;
- native iOS or Android applications;
- formal accounting, tax, budgeting, or invoice features.

These may be considered after the course MVP is shipped.

## 6. Users and operating assumptions

### 6.1 Primary users

- **Organizer:** Creates a group, adds members, and records or corrects transactions.
- **Participant:** Reviews expenses and balances and records a repayment.

Authentication and authorization are not implemented in the MVP. The application therefore operates as a trusted demo environment in which all visitors have organizer capabilities. This constraint must be stated in the README.

### 6.2 Group types

Each group has one of the following types:

- Trip
- Household
- Friends
- Work / Team
- Other

The type is descriptive and does not change calculation rules.

### 6.3 Currency model

- Every group has exactly one base currency.
- All expenses and settlements in that group use the base currency.
- The MVP supports two-decimal ISO 4217 currencies, initially TRY, USD, EUR, and GBP.
- Monetary values are represented with decimal arithmetic and stored as fixed-precision values. Binary floating-point arithmetic must not be used for financial calculations.
- Foreign-exchange conversion is not performed.
- A group's currency cannot be changed after its first expense or settlement has been recorded.

## 7. Functional requirements

### FR-01 — Group management

The user can:

1. view all active and archived groups;
2. create a group with a name, optional description, type, and currency;
3. edit the name, description, and type;
4. archive or restore a group; and
5. open a group dashboard.

Validation rules:

- Name is required, trimmed, and between 2 and 80 characters.
- Description is optional and limited to 300 characters.
- Type and currency must be selected from supported values.
- Archived groups are read-only until restored.
- A group with transaction history is archived rather than permanently deleted.

### FR-02 — Member management

The user can add, rename, deactivate, and reactivate group members.

Member data:

- unique identifier;
- display name;
- active/inactive status;
- automatically generated initials and display color; and
- creation timestamp.

Validation rules:

- Display name is required, trimmed, and between 1 and 60 characters.
- Member names are unique within a group, case-insensitively.
- A group may be created with one member, but an expense requires at least two active members in the group.
- A member referenced by an expense or settlement cannot be permanently deleted.
- Inactive members remain visible in historical transactions and balance calculations.
- Inactive members cannot be added to new expenses.

### FR-03 — Expense management

The user can list, view, create, edit, and delete expenses.

Each expense contains:

- unique identifier;
- group identifier;
- title;
- positive amount;
- expense date;
- category;
- one paying member;
- one or more participating members;
- split method;
- calculated share for every participant;
- optional note; and
- created and updated timestamps.

Supported categories:

- Food & Drink
- Groceries
- Transport
- Accommodation
- Utilities
- Entertainment
- Health
- Shopping
- Other

Validation rules:

- Title is required, trimmed, and between 2 and 120 characters.
- Amount must be greater than zero, contain no more than two decimal places, and not exceed 9,999,999,999.99.
- Expense date is required and cannot be later than the current date.
- The payer must belong to the group.
- Every participant must be an active member of the same group when the expense is created.
- The participant list cannot contain duplicates.
- The payer does not have to be a participant.
- Note is optional and limited to 500 characters.
- Editing or deleting an expense immediately recalculates all balances and settlement suggestions.
- Expense deletion requires explicit user confirmation.

### FR-04 — Split methods and rounding

#### Equal split

The total is divided equally among all selected participants.

#### Exact amount split

The user enters a non-negative amount for every selected participant. The entered amounts must sum exactly to the expense total.

#### Percentage split

The user enters a percentage greater than zero for every selected participant. Percentages must sum to exactly 100.00% before submission.

#### Weighted-share split

The user enters a positive whole-number weight for every selected participant. Each allocation is proportional to the member's weight divided by the total weight.

#### Rounding rule

Calculated allocations are converted to the currency's smallest supported unit. The largest-remainder method is used:

1. calculate each participant's unrounded allocation;
2. round each allocation down to the nearest minor unit;
3. calculate the remaining minor units; and
4. distribute them one at a time to the participants with the largest fractional remainders.

Ties are resolved by the participant order submitted with the expense. The final shares must always sum exactly to the expense amount.

Examples:

| Method | Expense | Inputs | Final allocations |
| --- | ---: | --- | --- |
| Equal | TRY 100.00 | Ada, Deniz, Mira | TRY 33.34 / 33.33 / 33.33 |
| Exact | TRY 120.00 | 50 / 40 / 30 | TRY 50.00 / 40.00 / 30.00 |
| Percentage | TRY 200.00 | 50% / 30% / 20% | TRY 100.00 / 60.00 / 40.00 |
| Weighted shares | TRY 120.00 | 2 / 1 / 1 | TRY 60.00 / 30.00 / 30.00 |

### FR-05 — Balance calculation

For each member:

```text
net balance = expenses paid
            - expense shares owed
            + settlements sent
            - settlements received
```

Interpretation:

- Positive balance: the member should receive money.
- Negative balance: the member owes money.
- Zero balance: the member is settled.

The group dashboard must show, for each member:

- total paid for expenses;
- total share owed;
- total settlements sent;
- total settlements received; and
- current net balance.

Invariant: member net balances must sum to exactly zero in minor units.

### FR-06 — Settlement suggestions

The application generates a deterministic simplified repayment plan from current net balances.

Algorithm requirements:

1. Separate members with negative balances (debtors) from members with positive balances (creditors).
2. Repeatedly match the largest remaining debtor with the largest remaining creditor.
3. Suggest the smaller of the amount owed and amount receivable.
4. Continue until every balance is zero in minor units.
5. Break equal-balance ties using member creation order.

The plan must:

- settle all balances exactly;
- never suggest a zero or negative payment;
- contain at most `non-zero members - 1` transfers; and
- be clearly labelled as a suggestion, not a real transfer.

The greedy plan reduces unnecessary transfers in typical cases but is not represented as a proof of the mathematical global minimum.

### FR-07 — Recording settlements

The user can record a full or partial repayment between two members.

Each settlement contains:

- unique identifier;
- group identifier;
- sender member;
- receiver member;
- positive amount;
- settlement date;
- optional note; and
- creation timestamp.

Validation rules:

- Sender and receiver must be different members of the same group.
- Before settlement, the sender must have a negative net balance and the receiver a positive net balance.
- Amount cannot exceed the smaller of the sender's outstanding debt and the receiver's outstanding credit.
- Date is required and cannot be later than the current date.
- Note is optional and limited to 300 characters.
- A recorded settlement changes balances immediately.
- Settlements are immutable. A user may delete an incorrect settlement after confirmation and then record a replacement.
- No external payment is initiated.

### FR-08 — Group dashboard

The group dashboard displays:

- group name, type, currency, and member count;
- total spending, excluding settlements;
- unsettled amount;
- each member's net balance;
- current settlement suggestions;
- spending totals by category;
- five most recent expenses and settlements; and
- clear actions for adding an expense, adding a member, and settling up.

### FR-09 — Expense history and filtering

The expense list supports:

- newest-first and oldest-first sorting;
- search by title or note;
- filtering by category;
- filtering by payer or participant; and
- filtering by date range.

An empty result must distinguish between “no expenses yet” and “no expenses match these filters.”

### FR-10 — Activity history

The application presents a chronological activity feed containing:

- expense created, updated, or deleted;
- settlement recorded or deleted;
- member added or deactivated; and
- group archived or restored.

For the MVP, activity entries may be generated from current transaction data and backend events; a full compliance-grade audit log is not required.

### FR-11 — User feedback and resilience

The interface must provide:

- loading indicators during asynchronous actions;
- field-level validation messages;
- a visible success confirmation after mutations;
- a non-technical error message with a retry action when an API request fails;
- confirmation dialogs for destructive actions; and
- helpful empty states with a primary next action.

Forms must not submit twice when the primary action is already in progress.

## 8. Primary user flows

### Flow A — Create the first group

1. User opens the group list.
2. User selects **Create group**.
3. User enters the group details and initial member names.
4. System validates and creates the group.
5. User lands on the empty group dashboard with an **Add expense** call to action.

### Flow B — Add a shared expense

1. User selects **Add expense**.
2. User enters title, amount, date, category, and payer.
3. User selects participating members.
4. User chooses a split method and enters method-specific values when needed.
5. Interface previews the final allocations.
6. User submits the form.
7. System stores the expense, recalculates balances, and returns to the dashboard with a success message.

### Flow C — Review and settle balances

1. User opens the **Settle up** view.
2. System displays net balances and suggested repayments.
3. User selects a suggestion or starts a custom valid partial repayment.
4. User records the settlement date, amount, and optional note.
5. System validates the repayment and recalculates balances.
6. Fully settled members are shown with zero balances and a settled state.

### Flow D — Correct a mistake

1. User opens an expense or settlement from history.
2. User edits an expense, or deletes an immutable settlement after confirmation.
3. System validates the change.
4. System recalculates balances and suggestions from all remaining transactions.
5. Updated totals appear without a full browser reload.

## 9. User stories and acceptance criteria

### US-01 — Create a group

**As an organizer, I want to create a group with a currency and members so that I can track shared spending.**

Acceptance criteria:

- Valid data creates one group and its initial members.
- Invalid fields are explained next to the relevant inputs.
- Refreshing the application preserves the group after database integration.

### US-02 — Record an equal expense

**As an organizer, I want to split an expense equally so that I do not calculate each share manually.**

Acceptance criteria:

- The allocation preview updates when amount or participants change.
- Rounding follows FR-04.
- The saved shares sum exactly to the expense total.

### US-03 — Record an unequal expense

**As an organizer, I want exact, percentage, and weighted splits so that real-world agreements are represented accurately.**

Acceptance criteria:

- Method-specific inputs appear only for the selected method.
- Invalid totals prevent submission.
- Valid inputs create deterministic final shares.

### US-04 — Understand balances

**As a participant, I want to know whether I owe or should receive money so that I can settle correctly.**

Acceptance criteria:

- Positive, negative, and zero states use text and icons in addition to color.
- Displayed member balances reconcile to zero.
- Expense changes update the balance view.

### US-05 — Record a repayment

**As a participant, I want to record a full or partial payment so that the group balance reflects what has already been paid.**

Acceptance criteria:

- The form prevents invalid member pairs and excessive amounts.
- A valid settlement updates both members' balances exactly once.
- Deleting the settlement reverses its effect.

### US-06 — Use the application on mobile

**As a participant, I want to use SplitWeave from my phone browser so that I can add an expense when it happens.**

Acceptance criteria:

- Core flows work at 360 px width without horizontal page scrolling.
- Touch targets are at least 44 by 44 CSS pixels where practical.
- Forms and navigation remain keyboard accessible.

## 10. Information architecture and routes

| Route | Purpose |
| --- | --- |
| `/` | Group list and portfolio-level summary |
| `/groups/new` | Create group |
| `/groups/:groupId` | Group dashboard |
| `/groups/:groupId/expenses` | Expense history and filters |
| `/groups/:groupId/expenses/new` | Add expense |
| `/groups/:groupId/expenses/:expenseId` | Expense details and edit action |
| `/groups/:groupId/settlements` | Balances, suggestions, and settlement history |
| `/groups/:groupId/members` | Member management |

Within a group, responsive tabs or equivalent navigation expose **Overview**, **Expenses**, **Settle up**, and **Members**.

## 11. UX and visual direction

### 11.1 Design principles

- Financial information must be immediately understandable.
- Money values, payer, participants, and split method receive strong visual hierarchy.
- Positive and negative balances must never rely on color alone.
- Forms reveal complexity progressively, especially split-method inputs.
- Mobile actions prioritize adding an expense and settling up.

### 11.2 Visual system

- Product personality: trustworthy, modern, calm, and collaborative.
- Primary color: indigo (`#4F46E5`).
- Accent color: teal (`#14B8A6`).
- Positive balance: emerald (`#059669`).
- Negative balance: rose (`#E11D48`).
- Page background: slate (`#F8FAFC`).
- Typography: a clean system or open-source sans-serif stack with tabular numerals for money.
- Components: cards, status chips, avatars with initials, balance rows, modal confirmations, toast notifications, and skeleton loading states.

All final color combinations must meet WCAG AA contrast for normal text.

## 12. Domain model

### 12.1 Group

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary identifier |
| `name` | string | Required, 2–80 chars |
| `description` | string / null | Max 300 chars |
| `group_type` | enum | Trip, Household, Friends, Work, Other |
| `currency` | string | ISO 4217 code supported by MVP |
| `is_archived` | boolean | Default false |
| `created_at` | datetime | UTC |
| `updated_at` | datetime | UTC |

### 12.2 Member

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary identifier |
| `group_id` | UUID | Foreign key to Group |
| `name` | string | Unique per group, case-insensitive |
| `color` | string | Valid display token or hex value |
| `is_active` | boolean | Default true |
| `created_at` | datetime | UTC; also used for deterministic tie-breaking |

### 12.3 Expense

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary identifier |
| `group_id` | UUID | Foreign key to Group |
| `title` | string | Required, 2–120 chars |
| `amount` | decimal | Fixed precision, two decimals |
| `expense_date` | date | Not in the future |
| `category` | enum | Supported category |
| `paid_by_member_id` | UUID | One payer in MVP |
| `split_method` | enum | Equal, Exact, Percentage, Shares |
| `note` | string / null | Max 500 chars |
| `created_at` | datetime | UTC |
| `updated_at` | datetime | UTC |

### 12.4 ExpenseShare

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary identifier |
| `expense_id` | UUID | Foreign key to Expense |
| `member_id` | UUID | Foreign key to Member |
| `input_value` | decimal | Percentage, exact amount, or weight when relevant |
| `allocated_amount` | decimal | Final rounded amount |
| `position` | integer | Deterministic participant order |

Unique constraint: one share per `(expense_id, member_id)`.

### 12.5 Settlement

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary identifier |
| `group_id` | UUID | Foreign key to Group |
| `from_member_id` | UUID | Sender / debtor |
| `to_member_id` | UUID | Receiver / creditor |
| `amount` | decimal | Positive fixed-precision value |
| `settlement_date` | date | Not in the future |
| `note` | string / null | Max 300 chars |
| `created_at` | datetime | UTC |

## 13. API contract overview

The backend exposes JSON REST endpoints under `/api/v1`. FastAPI generates the authoritative OpenAPI document. The contract will be exported to `_docs/openapi.yaml` before backend implementation is considered complete.

### 13.1 Core endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Service health |
| `GET` | `/api/v1/groups` | List groups |
| `POST` | `/api/v1/groups` | Create group and optional initial members |
| `GET` | `/api/v1/groups/{group_id}` | Group details |
| `PATCH` | `/api/v1/groups/{group_id}` | Update or archive/restore group |
| `GET` | `/api/v1/groups/{group_id}/members` | List members |
| `POST` | `/api/v1/groups/{group_id}/members` | Add member |
| `PATCH` | `/api/v1/groups/{group_id}/members/{member_id}` | Rename or activate/deactivate member |
| `GET` | `/api/v1/groups/{group_id}/expenses` | List and filter expenses |
| `POST` | `/api/v1/groups/{group_id}/expenses` | Create expense |
| `GET` | `/api/v1/groups/{group_id}/expenses/{expense_id}` | Expense details |
| `PUT` | `/api/v1/groups/{group_id}/expenses/{expense_id}` | Replace expense and shares |
| `DELETE` | `/api/v1/groups/{group_id}/expenses/{expense_id}` | Delete expense |
| `GET` | `/api/v1/groups/{group_id}/balances` | Totals and member balances |
| `GET` | `/api/v1/groups/{group_id}/settlement-suggestions` | Simplified repayment plan |
| `GET` | `/api/v1/groups/{group_id}/settlements` | Settlement history |
| `POST` | `/api/v1/groups/{group_id}/settlements` | Record settlement |
| `DELETE` | `/api/v1/groups/{group_id}/settlements/{settlement_id}` | Delete settlement |

### 13.2 API behavior

- Dates use ISO 8601 `YYYY-MM-DD`.
- Datetimes are returned in UTC ISO 8601 format.
- Money is serialized as a two-decimal string to avoid floating-point ambiguity, for example `"125.40"`.
- Create endpoints return HTTP 201.
- Successful delete endpoints return HTTP 204.
- Missing resources return HTTP 404.
- Conflicting state, such as changing a locked currency, returns HTTP 409.
- Schema validation failures return HTTP 422.
- Domain-rule failures return HTTP 400 or 409 with a stable error code.

Error shape:

```json
{
  "error": {
    "code": "SPLIT_TOTAL_MISMATCH",
    "message": "The participant allocations must equal the expense total.",
    "details": []
  }
}
```

## 14. Technical architecture

### 14.1 Frontend

- React with TypeScript and Vite
- Responsive component-based UI
- Centralized API client in `frontend/src/api/`
- Mock implementation behind the same API interface during prototype stage
- Route-based screens and reusable form components
- No direct backend calls from presentation components

### 14.2 Backend

- Python and FastAPI
- `uv` for dependency and command management
- Pydantic request/response schemas
- Service layer for split, balance, and settlement logic
- Repository abstraction separating services from persistence
- Configurable CORS origin and database URL

### 14.3 Persistence

- SQLAlchemy ORM
- SQLite for local development and automated tests
- Database URL configured through environment variables so another SQLAlchemy-supported database can be adopted without changing domain logic
- Monetary columns use fixed precision such as `Numeric(12, 2)`
- Database constraints and application validation protect referential and financial integrity

### 14.4 Planned repository structure

```text
splitweave/
├── _docs/
│   ├── specs.md
│   └── openapi.yaml
├── backend/
│   ├── app/
│   ├── tests/
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/
│   ├── package.json
│   └── package-lock.json
├── .env.example
├── .gitignore
├── AGENTS.md
└── README.md
```

## 15. Mock-to-database delivery strategy

1. Build the interactive frontend against a centralized mock API.
2. Define and export the backend OpenAPI contract.
3. Write backend endpoint and domain tests first.
4. Implement FastAPI endpoints using an in-memory repository.
5. Connect the frontend API client to the FastAPI base URL.
6. Replace only the repository implementation with SQLAlchemy.
7. Run the same domain and endpoint test suite against the real persistence layer.

The frontend must not require component rewrites when switching from mock data to the backend.

## 16. Non-functional requirements

### NFR-01 — Correctness

- All financial logic uses decimal or integer minor-unit arithmetic.
- Core invariants are checked in tests and, where appropriate, at runtime.
- Identical inputs produce identical allocations and settlement suggestions.

### NFR-02 — Performance

- Common API requests should complete within 300 ms in local development for a seeded group containing up to 100 members and 1,000 transactions, excluding first-start overhead.
- Filtering and balance calculations must not cause one database query per member or expense.

### NFR-03 — Accessibility

- Forms have programmatic labels and useful error associations.
- Core flows are keyboard accessible.
- Focus is managed when dialogs open and close.
- Status meaning is not communicated by color alone.
- Text and interactive controls target WCAG 2.1 AA contrast.

### NFR-04 — Responsive behavior

- Supported viewport range begins at 360 px width.
- Tables transform into readable cards or allow contained horizontal scrolling on small screens.
- No core page produces document-level horizontal scrolling.

### NFR-05 — Reliability and observability

- Backend errors are logged with context and without sensitive data.
- A health endpoint is available.
- The UI distinguishes validation, not-found, conflict, and unexpected failures.

### NFR-06 — Security baseline

- Validate all client input on the backend.
- Do not interpolate user input into SQL.
- Restrict CORS to configured frontend origins.
- Do not commit secrets or local database files.
- Because the MVP has no authentication, it must not be deployed with sensitive or real financial data.

### NFR-07 — Maintainability

- Python uses type hints and small service functions.
- TypeScript runs in strict mode.
- Business logic is not duplicated across UI components, API routes, and repositories.
- Linting and formatting commands are documented.

## 17. Testing strategy

### 17.1 Backend unit tests

Required calculation cases:

- equal split with and without a remainder;
- exact split total match and mismatch;
- percentage split total match and mismatch;
- weighted split with rounding;
- deterministic tie-breaking;
- payer included and excluded from participants;
- balance invariant after multiple expenses;
- full and partial settlements;
- invalid and excessive settlements;
- expense update and delete recalculation;
- simplified settlement plan correctness.

### 17.2 Backend API tests

- successful CRUD flows;
- HTTP status codes and response schemas;
- group/member ownership validation;
- archived group restrictions;
- duplicate member conflicts;
- invalid split payloads;
- not-found paths;
- persistence after application/session refresh; and
- isolation between tests.

### 17.3 Frontend tests

- split allocation preview;
- method-specific form fields;
- validation and disabled submit states;
- positive/negative/settled balance rendering;
- API error and empty states; and
- the primary create-group-to-settlement flow with a mocked API.

### 17.4 Manual acceptance test

Using two browser windows against the same backend database:

1. Open the same group in both windows.
2. Add an expense in the first window.
3. Refresh the second window and verify the new expense and balances.
4. Record a settlement in the second window.
5. Refresh the first window and verify updated balances.
6. Restart the backend and confirm that the data remains.

## 18. Seed/demo scenario

Development data should include one group named **Aegean Weekend** using TRY with four members: Ada, Deniz, Mira, and Can.

Suggested demo transactions:

1. Ada pays TRY 1,200.00 for accommodation, split equally among four members.
2. Deniz pays TRY 640.00 for dinner, split by percentages 40/20/20/20.
3. Mira pays TRY 275.50 for transport, split exactly among three participants.
4. Can records a partial repayment from the generated settlement suggestions.

The seed must be deterministic and safe to recreate.

## 19. Definition of done

The Homework 2 MVP is done when:

- [ ] `_docs/specs.md` reflects the implemented scope.
- [ ] `.gitignore`, `README.md`, and `AGENTS.md` are present.
- [ ] Frontend starts with the documented Node.js command.
- [ ] Backend starts with the documented `uv` command.
- [ ] Frontend uses the configured FastAPI base URL.
- [ ] SQLAlchemy persistence replaces the mock backend repository.
- [ ] A fresh install can be completed from README instructions.
- [ ] Automated backend tests pass with one documented command.
- [ ] The main user flow passes manual browser verification.
- [ ] Data persists after refresh and backend restart.
- [ ] Empty, loading, validation, success, and error states are handled.
- [ ] No secrets, environment files, local databases, caches, or build outputs are committed.
- [ ] The repository contains a final commit whose SHA can be submitted.

## 20. Future roadmap

Potential post-homework enhancements:

- accounts, authentication, roles, and invitation links;
- real-time multi-user updates;
- recurring expenses and reminders;
- receipt images and OCR-assisted data entry;
- multiple payers per expense;
- mixed currencies with explicit exchange rates;
- configurable categories, tags, and analytics;
- CSV/PDF export;
- progressive web application and offline mode;
- native mobile applications; and
- optional external payment deep links.

## 21. Final product decisions

| Decision | Selected option |
| --- | --- |
| Homework project | Expense splitter |
| Product name | SplitWeave |
| Audience | Trips, households, friends, and work teams |
| Split methods | Equal, exact amount, percentage, and weighted shares |
| Delivery scope | Professional MVP |
| Currency | One two-decimal currency per group; TRY/USD/EUR/GBP initially |
| Authentication | Out of scope for MVP |
| Money transfer | Record-only; no real transfer |
| Frontend | React + TypeScript + Vite |
| Backend | FastAPI managed with `uv` |
| Database | SQLAlchemy; SQLite locally |

There are no unresolved product decisions blocking MVP implementation.
