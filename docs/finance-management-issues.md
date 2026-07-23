# Finance Management Issue Backlog

This backlog breaks [Finance Management Plan](./finance-management-plan.md) into implementation issues. Issues are ordered by dependency, not necessarily by release boundary.

## 1. Replace finance MVP with foundation schema and backend module structure

**User story**
As a developer, I want a complete finance foundation schema and backend module skeleton so the rest of the finance system can build on one coherent model.

**Depends on**

- None.

**Scope**

- Add a forward PostgreSQL migration under `i12e/postgres/migrations`.
- Replace the current `service_finance.transactions` MVP schema with the new foundation schema.
- Create tables for financial accounts, categories, ledger entries, ledger entry parts, balance snapshots, budgets, budget allocations, recurring plans, reminders, and imported candidates/source metadata placeholders.
- Keep currency explicit on monetary records and financial accounts.
- Add Rust finance module structure for accounts, ledger, budgets, reminders, and dashboard reporting.
- Add domain types/enums and repository traits without building full feature behavior.
- Ensure sensitive finance details are not logged.

**Non-scope**

- Cockpit UI.
- CSV import, bank sync, or quote providers.
- Investment accounts, securities, positions, investment transactions, and price snapshots.
- Cached dashboard summary tables.
- Tax tracking.

**Acceptance criteria**

- Migrations create the replacement finance schema from an empty database.
- Current finance MVP table is removed or superseded by the new schema through a forward migration.
- Backend compiles with the new finance module structure.
- Domain types represent the resolved glossary in `CONTEXT.md`.
- Imported candidates cannot affect ledger, cashflow, or balance in the model.
- Used setup entities have archive fields/statuses rather than relying on hard deletion.

**Validation**

- `pnpm nx run i12e-postgres:migrate`
- `pnpm nx run backend:test`
- `pnpm nx run backend:build`

## 2. Add financial account APIs and account management UI

**User story**
As a user, I want to manage my financial accounts so balances and transactions can be organized by where money or assets are held.

**Depends on**

- Issue 1.

**Scope**

- Add backend APIs for listing, creating, updating, and archiving financial accounts.
- Support account types: cash, bank, credit, loan.
- Store account name, immutable type and primary currency, active/archive status, and display ordering.
- Add Cockpit server functions for account APIs.
- Add a mobile-first account management route in Cockpit.
- Hide archived accounts from active selection while keeping them visible in history/detail views.

**Non-scope**

- Balance snapshot entry.
- Ledger entry creation.
- Investment account support.

**Acceptance criteria**

- User can create each supported financial account type.
- User can edit an account name without changing its type or primary currency.
- User can archive an account.
- Archived accounts are not offered as active targets for new entries.
- Account APIs do not expose backend directly to the browser.

**Validation**

- `pnpm nx run backend:test`
- `pnpm nx run cockpit:test`
- `pnpm nx run backend:build`
- `pnpm nx run cockpit:build`

## 3. Add balance snapshots and reconciliation calculations

**User story**
As a user, I want to enter known account balances and see reconciliation differences so I can start using the system without backfilling all historical activity.

**Depends on**

- Issue 2.

**Scope**

- Add backend APIs for creating and listing balance snapshots per financial account.
- Calculate current balance as latest balance snapshot plus later ledger entries.
- Calculate reconciliation differences where a later snapshot does not match the calculated balance.
- Add account detail UI for snapshots, calculated balance, latest confirmed balance, and reconciliation difference.
- Add tests for asset and liability balance signs.

**Non-scope**

- Automatic adjustment entries.
- Ledger entry UI.
- Net worth dashboard composition.

**Acceptance criteria**

- User can enter initial and later balance snapshots.
- Current balance uses snapshot-plus-ledger calculation.
- Reconciliation differences are visible and not hidden by generated adjustments.
- Credit and loan balances are treated as liabilities in balance/net worth calculations.

**Validation**

- `pnpm nx run backend:test`
- `pnpm nx run cockpit:test`
- `pnpm nx run backend:build`
- `pnpm nx run cockpit:build`

## 4. Replace transactions MVP with ledger entries for cashflow and transfers

**User story**
As a user, I want to record income, expenses, expense reversals, and transfers so my cashflow and account balances stay consistent.

**Depends on**

- Issue 1.
- Issue 2.

**Scope**

- Replace current transaction API behavior with ledger entry APIs.
- Support income, expense, expense reversal, and transfer entry types.
- Require account for income, expense, and expense reversal entries. Category remains optional in the foundation.
- Support standalone expense reversals with optional related expense link.
- Support transfers between two financial accounts.
- Keep split entry data model usable for future advanced UI.
- Add simple mobile-first Cockpit ledger entry route.
- Preserve the existing `/finance/transactions` route only if it redirects or is intentionally replaced.

**Non-scope**

- Full split-entry editing UI.
- Imported candidate matching.
- Budget UI.

**Acceptance criteria**

- Income and expenses affect cashflow and account balances.
- Expense reversals reduce expense actuals and can stand alone.
- Transfers affect balances but not income, expense, or budget actuals.
- Credit card purchases can be entered as expenses on credit accounts.
- Credit card payments can be entered as transfers.
- Manual ledger entries can be edited and deleted.

**Validation**

- `pnpm nx run backend:test`
- `pnpm nx run cockpit:test`
- `pnpm nx run backend:build`
- `pnpm nx run cockpit:build`

## 5. Add global category management with parent rollups

**User story**
As a user, I want to manage global finance categories so cashflow and budgets can be reported consistently across accounts.

**Depends on**

- Issue 1.

**Scope**

- Add backend APIs for listing, creating, updating, and archiving categories.
- Support optional parent category relationship.
- Prevent parent category cycles.
- Keep categories global across finance, not account-scoped.
- Add Cockpit category management UI.
- Ensure budget allocations target specific child categories, not parent rollups.

**Non-scope**

- Tags or labels.
- Budget allocation UI.

**Acceptance criteria**

- User can create flat categories.
- User can optionally assign a parent category.
- Parent categories are used for reporting rollups only.
- Used categories can be archived, not hard deleted.
- Archived categories are hidden from active entry forms but retained for history.

**Validation**

- `pnpm nx run backend:test`
- `pnpm nx run cockpit:test`
- `pnpm nx run backend:build`
- `pnpm nx run cockpit:build`

## 6. Add monthly budgets and budget allocation actuals

**User story**
As a user, I want monthly category budgets so I can compare planned spending against actual expenses.

**Depends on**

- Issue 4.
- Issue 5.

**Scope**

- Add backend APIs for monthly budgets and budget allocations.
- Allocate planned expense amounts to specific expense categories.
- Calculate actuals from expense transactions and expense reversals in the budget month.
- Exclude transfers and balance snapshots.
- Add Cockpit budget UI for creating/editing monthly allocations.
- Show planned vs actual progress and over-budget categories.
- Roll child categories up to parent reporting groups where configured.

**Non-scope**

- Automatic carryover.
- Income budgeting.
- Envelope/category balance accounting.

**Acceptance criteria**

- User can create and edit a budget for one calendar month.
- User can create allocations for specific expense categories.
- Actuals include expenses and expense reversals.
- Transfers do not affect budget actuals.
- Over-budget categories are surfaced clearly.
- Parent category totals are rollups of child allocations/actuals.

**Validation**

- `pnpm nx run backend:test`
- `pnpm nx run cockpit:test`
- `pnpm nx run backend:build`
- `pnpm nx run cockpit:build`

## 7. Add recurring plans and confirmation reminders

**User story**
As a user, I want reminders for recurring income, expenses, and transfers so expected money movement can be reviewed before it affects my records.

**Depends on**

- Issue 4.

**Scope**

- Add backend APIs for recurring plans and reminders.
- Support recurring plan kinds: expected income, expected expense, expected transfer.
- Support monthly, weekly, and yearly recurring schedules.
- Store expected amount, account, category or transfer target, next due date, and reminder lead days.
- Generate upcoming reminders.
- Confirm reminders into actual ledger entries.
- Add Cockpit UI for managing recurring plans and confirming reminders.

**Non-scope**

- Full custom calendar rule engine.
- Automatic creation of actual ledger entries without confirmation.
- Notification delivery outside the app.

**Acceptance criteria**

- User can create recurring plans for income, expenses, and transfers.
- Upcoming reminders are generated from recurring schedules.
- Reminders do not affect cashflow or balances before confirmation.
- Confirming a reminder creates the correct ledger entry type.
- Confirmed reminders no longer appear as pending action items.

**Validation**

- `pnpm nx run backend:test`
- `pnpm nx run cockpit:test`
- `pnpm nx run backend:build`
- `pnpm nx run cockpit:build`

## 8. Add live Finance Dashboard read model and UI

**User story**
As a user, I want a Finance Dashboard that shows current financial health so I can quickly understand balances, cashflow, budgets, and reminders.

**Depends on**

- Issue 3.
- Issue 4.
- Issue 6.
- Issue 7.

**Scope**

- Add backend API for live dashboard read model computed from finance foundation tables.
- Include net worth and balances grouped by account type.
- Include month-to-date income, expenses, expense reversals, and net cashflow.
- Include current budget progress and over-budget categories.
- Include upcoming reminders requiring action.
- Add mobile-first Cockpit dashboard route.
- Link each dashboard section to its focused workflow.

**Non-scope**

- Cached dashboard summary tables.
- External market quote fetching.
- Bank sync/import workflows.

**Acceptance criteria**

- Dashboard summaries are computed live from finance tables.
- Dashboard separates confirmed actuals from upcoming reminders.
- Net worth subtracts liabilities.
- Transfers do not affect cashflow.
- Budget progress excludes transfers and includes expense reversals.
- Dashboard is usable on mobile and appealing on desktop.

**Validation**

- `pnpm nx run backend:test`
- `pnpm nx run cockpit:test`
- `pnpm nx run backend:build`
- `pnpm nx run cockpit:build`

## 9. Polish responsive finance workflows and visual hierarchy

**User story**
As a user, I want finance workflows that are fast on mobile and clear on desktop so day-to-day finance review and entry feel efficient.

**Depends on**

- Issue 9.

**Scope**

- Review and polish mobile layouts for accounts, ledger, budgets, reminders, and dashboard.
- Ensure tables collapse into cards/lists where needed.
- Improve dashboard hierarchy, spacing, visual grouping, and chart readability.
- Add empty, loading, error, and destructive confirmation states.
- Ensure text does not overflow controls or overlap content.

**Non-scope**

- New finance domain behavior.
- Marketing/landing page design.

**Acceptance criteria**

- Finance dashboard and drill-down workflows work at common mobile and desktop widths.
- No horizontal scrolling is required for primary workflows.
- Buttons, cards, tables, charts, and forms remain readable and usable.
- Desktop uses extra space for richer composition without becoming decorative.
- All destructive actions have clear confirmation behavior.

**Validation**

- `pnpm nx run cockpit:test`
- `pnpm nx run cockpit:build`
- Manual browser checks at mobile and desktop widths.
