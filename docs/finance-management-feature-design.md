# Feature Design Document

As a user, I want a mobile-first Finance Dashboard that gives me a current view of my financial health across accounts, cashflow, budgets, and reminders, so I can understand where my money is, what changed this month, what needs attention, and where to drill down.

Finance remains one backend domain with focused subareas for accounts, ledger, budgets, reminders, and dashboard reporting. Investments are deferred until a later feature slice. The design replaces the current manual transaction MVP through forward PostgreSQL migrations rather than maintaining old and new finance models in parallel.

## Scope

- Show net worth and account balances grouped by account type.
- Track income, expenses, expense reversals, and transfers through one Finance ledger foundation.
- Support financial accounts for cash, bank accounts, credit accounts, and loan accounts.
- Support balance snapshots for setup and reconciliation.
- Support global categories with optional parent categories for reporting rollups.
- Support monthly budgets with category-level expense allocations and no automatic carryover.
- Support recurring plans for expected income, expenses, and transfers, with reminders that require confirmation.
- Provide drill-down workflows for accounts, ledger entries, budgets, and reminders.
- Keep manual entry first while leaving room for future imports, bank sync, and quote providers.

## Out Of Scope

- Bank sync and CSV import workflows.
- Investment accounts, securities, positions, investment transactions, and price snapshots.
- Automated market quote provider integration.
- Exchange-rate management and cross-currency net worth reporting.
- Tax lots, taxable gain calculations, withholding reports, and tax exports.
- Multi-user/auth hardening.
- Automatic budget carryover.
- Immutable accounting-style audit history.

## User Experience

### Primary Navigation

Finance should expose one top-level dashboard and focused drill-down workflows:

- Dashboard: current financial health and action summary.
- Accounts: financial accounts, balances, snapshots, and reconciliation.
- Ledger: income, expenses, expense reversals, and transfers.
- Budgets: monthly budget allocations and actuals.
- Reminders: recurring plans and pending confirmations.
- Categories: global category management with optional parent rollups.

### Dashboard

The dashboard is the first finance screen. It should be dense, calm, and operational rather than promotional. It should prioritize:

- Net worth and account groups.
- Month-to-date income, expenses, expense reversals, and net cashflow.
- Current budget progress and over-budget categories.
- Upcoming reminders requiring confirmation.

The dashboard separates confirmed actuals from upcoming reminders. Expected salary, rent, transfers, and other planned activity must appear as upcoming work until confirmed.

### Mobile-First Behavior

The main workflows should be usable on mobile first:

- Dashboard sections stack vertically with compact summaries.
- Entry forms use full-width controls and minimize required typing.
- Tables collapse into cards or lists.
- Destructive actions require clear confirmation.
- Desktop layouts use additional space for richer comparison and overview, but remain work-focused.

## Domain Model

### Financial Accounts

A **Financial Account** represents a real-world place where money or assets are held. Supported account types are:

- Cash account.
- Bank account.
- Credit account.
- Loan account.

Financial accounts have a primary currency. Account type and primary currency are chosen at creation and cannot change afterward; name and display order remain editable. Cash and bank accounts contribute to net worth as assets. Credit and loan accounts contribute as liabilities. Used accounts are archived instead of deleted.

### Ledger

**Ledger Entry** is the broad balance-changing record. **Transaction** remains the user-facing cashflow term for income and expenses.

Ledger entry kinds include:

- Income.
- Expense.
- Expense reversal.
- Transfer.

Income, expenses, and expense reversals belong to exactly one financial account. Categories are optional in the foundation and can be required by later UI rules where useful. Transfers move value between two accounts and do not affect income, expense, or budget actuals. Expense reversals reduce expense actuals and may stand alone or optionally reference a related expense.

The foundation should support split entries even if the first UI stays simple. A split entry allows one user-entered event to produce multiple categorized or account-affecting parts.

Manually entered ledger entries can be edited or deleted directly in the first version.

### Balances And Reconciliation

Account balance truth is:

```text
latest balance snapshot + later ledger entries
```

Balance snapshots establish initial balances and later reconciliation points. If a snapshot differs from the calculated balance, the system surfaces a reconciliation difference. It does not generate automatic adjustment entries.

### Categories

Categories are global within Finance, not scoped to accounts. They classify cashflow for review, reporting, and budgeting.

Categories may have an optional parent category. Parent categories are reporting rollups only. Transactions and budget allocations target specific child categories.

Used categories are archived instead of deleted.

### Budgets

A budget covers one calendar month. Budget allocations assign planned expense amounts to specific expense categories.

Budget actuals include expenses and expense reversals in the budget month. Transfers and balance snapshots are excluded. Budgets do not automatically carry unused or overspent amounts into future months.

### Recurring Plans And Reminders

A recurring plan represents expected income, expense, or transfer activity. Supported recurring schedules in the first version are:

- Monthly.
- Weekly.
- Yearly.

Recurring plans produce reminders. Reminders do not affect cashflow or balances until confirmed. Confirming a reminder creates the corresponding ledger entry.

### Imported Candidates

Imports are out of scope for the first phase, but the foundation should reserve source/import metadata. Imported records should be represented as imported candidates until confirmed or matched. Imported candidates do not affect ledger, cashflow, balance, or budgets.

## Backend Design

### Module Structure

Keep code under `services/backend/src/domains/finance`, split by subarea:

- `accounts`
- `ledger`
- `categories`
- `balances`
- `budgets`
- `recurring`
- `dashboard`

Each subarea should follow the existing backend style: domain model, service/use-case layer, repository contract, PostgreSQL repository implementation, HTTP handlers, and focused tests.

### Persistence

Schema changes are applied through forward migrations in `i12e/postgres/migrations`.

The first migration should replace or supersede the current `service_finance.transactions` MVP table with the new finance foundation schema. The old implementation is not production-used, so the migration does not need to preserve a parallel compatibility model.

Important storage rules:

- Store amounts in minor units.
- Store currency codes explicitly.
- Use UUID v7 identifiers where existing database conventions support them.
- Use archive status/timestamps for accounts and categories.
- Keep source/import metadata separate from confirmed ledger truth.
- Do not add cached dashboard summary tables initially.

### API Shape

Backend routes should remain nested under `/api/v1/finance`. Cockpit should call them through TanStack Start server functions; the browser should not call backend services directly.

Expected route groups:

- `/accounts`
- `/categories`
- `/ledger-entries`
- `/balance-snapshots`
- `/budgets`
- `/recurring-plans`
- `/reminders`
- `/dashboard`

Route naming can be adjusted during implementation to match local conventions, but each route group should preserve the domain boundaries above.

### Dashboard Read Model

The dashboard endpoint should compute a live read model from finance tables:

- Net worth and account groups.
- Month-to-date cashflow.
- Budget progress.
- Upcoming reminders.

Cached summaries should be deferred until dashboard performance requires them.

### Privacy And Logging

Finance keeps a lightweight privacy baseline:

- Backend APIs remain private behind Cockpit.
- The first phase does not add auth or multi-user hardening.
- Do not log sensitive finance details such as transaction descriptions, amounts, account names, or raw imported rows.
- Do not send finance data to third parties without an explicit future integration.

## Cockpit Design

### App Boundary

Cockpit owns presentation and server-function calls. Finance frontend code should stay under the existing cockpit finance domain structure and grow into focused folders for dashboard, accounts, ledger, budgets, reminders, and categories.

### UI Principles

- Use compact, utilitarian layouts for repeated financial review.
- Use clear icon buttons for common actions where the component library already supports them.
- Keep cards for repeated items and dashboard groups, not nested page sections.
- Ensure forms are fast on mobile and readable on desktop.
- Provide empty, loading, error, and destructive confirmation states.

### Dashboard Layout

Mobile layout:

1. Net worth summary.
2. Account group balances.
3. Month-to-date cashflow.
4. Budget progress.
5. Upcoming reminders.

Desktop layout:

- Use a wider grid to show net worth, cashflow, budget status, and reminders in one scan.
- Keep drill-down links visible from every dashboard section.
- Avoid decorative hero sections; this is an operational tool.

## Rollout Plan

Implementation should follow the issue backlog order:

1. Foundation schema and backend module structure.
2. Accounts.
3. Balance snapshots and reconciliation.
4. Ledger entries.
5. Categories.
6. Budgets.
7. Recurring plans and reminders.
8. Live dashboard.
9. Responsive polish.

Each issue should land with focused backend and frontend tests where behavior changes. The dashboard should be composed after the supporting live read models exist.

## Validation

Relevant validation should be run per affected project:

- `pnpm nx run i12e-postgres:migrate`
- `pnpm nx run backend:test`
- `pnpm nx run backend:build`
- `pnpm nx run cockpit:test`
- `pnpm nx run cockpit:build`

For UI-heavy issues, perform manual checks at mobile and desktop widths. Use fallback project commands from [Toolchain](./toolchain.md) if Nx plugin workers fail in a restricted sandbox.

## Open Implementation Questions

- Exact SQL table names and constraints.
- Whether ledger entry parts should be introduced before or after the first simple ledger UI.
- Exact endpoint names and request/response DTO shapes.
- Whether the first ledger UI exposes split entry editing or only simple entry.
- Whether finance dashboard charts need a charting dependency or can start with CSS-based visualizations.

## Domain Decisions

- **Finance** remains one backend domain with focused subareas: accounts, ledger, budgets, reminders, and dashboard reporting. Investments are deferred to a later slice.
- **Ledger Entry** is the broad balance-changing record. **Transaction** remains the cashflow term for income and expenses.
- Every income, expense, and expense reversal belongs to exactly one **Financial Account**. Categories are optional in the foundation.
- **Transfers** move money between accounts and do not affect income, expense, or budget actuals.
- **Balance** is derived from the latest **Balance Snapshot** plus later ledger entries.
- **Reconciliation Differences** are surfaced rather than hidden through automatic adjustments.
- Cash and bank accounts are assets; credit and loan accounts are liabilities for **Net Worth**.
- Credit card purchases are expenses on the credit account; credit card payments are transfers.
- Loan payments split principal repayment from interest expense.
- Refunds and reimbursements are **Expense Reversals**, not ordinary income.
- Categories are global in Finance. Parent categories are optional rollups, not direct budget allocation targets.
- Budgets are monthly and allocate planned expense amounts to specific expense categories.
- Recurring plans produce reminders. Reminders do not affect cashflow or balance until confirmed.
- Used financial accounts and categories are archived rather than deleted.
- Manually entered ledger entries can be edited or deleted directly in v1.

## Implementation Plan

### Step 1: Finance Foundation

- Replace the current manual transaction MVP with a new finance foundation through forward PostgreSQL migrations under `i12e/postgres/migrations`.
- Create schema and backend model/API skeleton for:
  - financial accounts
  - ledger entries and split entry parts
  - balance snapshots
  - categories and optional parent categories
  - budgets and budget allocations
  - recurring plans and reminders
  - imported candidates/source metadata placeholders
- Keep Backend finance APIs private behind Cockpit server functions.
- Avoid logging sensitive finance details such as descriptions, amounts, account names, or raw imported rows.
- Compute dashboard summaries live from the finance tables first; defer cached summary tables until there is a measured performance need.

### Step 2: Accounts And Balances

- Add account management UI for creating, editing, and archiving financial accounts.
- Add balance snapshot workflows for initial balances and later reconciliation.
- Show calculated balance, latest snapshot, and reconciliation difference per account.
- Add dashboard account groups and net worth summary.

### Step 3: Ledger And Cashflow

- Replace the current transactions route with a ledger workflow for income, expenses, expense reversals, and transfers.
- Keep simple entry fast on mobile.
- Support split entry data in the foundation, even if advanced split UI is introduced incrementally.
- Show month-to-date income, expenses, reversals, transfers, and net cashflow.

### Step 4: Budgets

- Add monthly budget creation and editing.
- Add category-level budget allocations for expense categories.
- Show planned vs actual progress and over-budget categories.
- Roll up child categories into parent category reporting where configured.

### Step 5: Recurring Plans And Reminders

- Add recurring plans for income, expense, and transfer expectations.
- Support monthly, weekly, and yearly recurring schedules.
- Generate upcoming reminders.
- Confirm reminders into actual transactions or transfers.
- Show upcoming reminders as an action queue on the dashboard.

### Step 6: Dashboard Composition

- Compose a mobile-first Finance Dashboard from foundation read models:
  - net worth and account groups
  - month-to-date cashflow
  - budget progress and over-budget categories
  - upcoming reminders
- Use a dense, calm operational layout with richer desktop composition.
- Link every dashboard section to its focused workflow.
- Compute dashboard read models live from the finance foundation tables.

## Acceptance Criteria

- The dashboard works at mobile and desktop widths without horizontal scrolling or overlapping controls.
- Net worth subtracts credit and loan liabilities from asset accounts.
- Account balances are derived from snapshots plus ledger entries.
- Transfers do not affect income, expense, or budget actuals.
- Credit card purchases affect expense categories on purchase date; card payments are transfers.
- Loan payments can represent principal repayment separately from interest expense.
- Expense reversals reduce expense actuals and may stand alone.
- Budgets show monthly planned vs actual category spending with no automatic carryover.
- Reminders appear as upcoming items and do not affect cashflow or balance until confirmed.
- Existing finance MVP code and schema are replaced through forward migrations rather than maintained as a parallel compatibility path.

## Suggested Issue Slices

1. Add finance foundation migration and backend domain module structure.
2. Add financial account model, APIs, repository, tests, and Cockpit account management route.
3. Add balance snapshot model, APIs, reconciliation calculations, tests, and UI.
4. Replace transaction MVP with ledger entry APIs for income, expense, expense reversal, and transfer.
5. Add global category management with optional parent category rollups.
6. Add monthly budget and allocation APIs, calculations, tests, and budget UI.
7. Add recurring plan and reminder APIs, schedule generation, confirmation flow, tests, and UI.
8. Add live Finance Dashboard read model API and dashboard UI.
9. Add responsive UI polish and dashboard visual refinements.

## Validation Strategy

- Add Rust unit tests for finance domain calculations: balances, cashflow, budget actuals, reminders, and net worth.
- Add backend HTTP tests for each finance subarea.
- Add PostgreSQL migration validation through the `i12e-postgres` migration target.
- Add Cockpit component/hook tests for key finance workflows.
- Run affected Nx targets for backend, cockpit, and postgres projects before merging each issue.
