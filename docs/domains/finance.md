# Finance

Finance tracks money moving in and out of the user's life so the user can understand income, expenses, balances, and
plans over time.

Schema: `service_finance` (introduced by migration `0005_replace-finance-mvp-with-foundation.sql`).
Backend code: `services/backend/src/domains/finance`. Cockpit code: `apps/cockpit/src/domain/finance`.

## Status

- **Implemented end to end:**
  - **Financial Accounts**: create, edit, reorder, archive, and restore (`/api/v1/finance/accounts`, Cockpit route
    `/finance/accounts`).
  - Manual **Income** and **Expense** **Transactions** with summaries, each booked on a **Financial Account**
    (`/api/v1/finance/transactions`, Cockpit route `/finance/transactions`). They are stored as **Ledger Entries**.
- **Modelled, not yet exposed:** **Category** hierarchy, **Transfers**, **Balance Snapshots**, **Budgets**, and
  **Recurring Plans**. Their schema and backend types exist and are under active development.

## Language

**Financial Account**:
A place where money or assets are held or owed: `cash`, `bank`, `credit`, `loan`, or `investment`. Has a primary
**Currency** and a user-chosen display order. It is `active` or `archived`; archiving can be undone by restoring it.
_Avoid_: Wallet, pot

**Ledger Entry**:
The single persisted record of a money movement. Its kind is `income`, `expense`, `expense_reversal`, or `transfer`.
_Avoid_: Entry, item, booking

**Transaction**:
The API and UI term for an **Income** or **Expense** **Ledger Entry** recorded by the user.
_Avoid_: Using it for transfers or reversals

**Income**:
A ledger entry that increases available money.
_Avoid_: Revenue, earning

**Expense**:
A ledger entry that decreases available money.
_Avoid_: Spending, cost

**Expense Reversal**:
A ledger entry that undoes all or part of an earlier **Expense**, for example a refund. It can reference the original entry.
_Avoid_: Negative expense

**Transfer**:
A ledger entry that moves money between two **Financial Accounts** without changing net worth.
_Avoid_: Income plus expense pair

**Entry Status**:
`confirmed` entries count in reports. `candidate` entries are suggestions (`imported` or `recurring`) that the user
still has to confirm or `dismiss`.

**Category**:
A user-facing label that groups ledger entries for review. Categories can be nested through a parent category.
_Avoid_: Tag, bucket

**Amount**:
The positive monetary value of a ledger entry, stored in minor currency units (`amount_minor_units`). The direction
comes from the entry kind, never from the sign.
_Avoid_: Float amount, decimal amount, signed amount

**Currency**:
The ISO 4217 code of an amount. The implemented transaction flow currently uses `EUR` only.
_Avoid_: Money type

**Transaction Date**:
The calendar date when the money movement occurred.
_Avoid_: Entry date, created date

**Balance Snapshot**:
The known balance of a **Financial Account** on a given date, used to anchor and verify computed balances.

**Budget**:
A monthly plan with **Budget Allocations**: a planned amount per **Category**.

**Recurring Plan**:
An expected income, expense, or transfer on a weekly, monthly, or yearly schedule. It produces `recurring`
**candidate** ledger entries.

## Relationships

- A **Ledger Entry** has exactly one kind; a single movement is never both **Income** and **Expense**
- A **Ledger Entry** has one positive **Amount**, one **Currency**, and one user-selected **Transaction Date**
- A **Ledger Entry** belongs to zero or one **Category**
- An **Income** or **Expense** belongs to exactly one **Financial Account**, and its **Currency** is that account's
  primary **Currency**
- New entries can only be booked on `active` **Financial Accounts**; existing entries keep their account when it is
  archived
- The primary **Currency** of a **Financial Account** can't change once entries reference it
- A **Transfer** references a source and a destination **Financial Account**
- An **Expense Reversal** can reference the **Expense** it reverses
- A **Budget** covers one month and **Currency** and has at most one **Budget Allocation** per **Category**

## Example dialogue

> **Dev:** "Can one **Transaction** be both **Income** and **Expense**?"
> **Domain expert:** "No. Split it into separate **Transactions** if both money directions need tracking."
>
> **Dev:** "If salary arrives on January 31 but is entered on February 2, which date drives reports?"
> **Domain expert:** "The **Transaction Date** is January 31. The recorded-at timestamp is only metadata."
>
> **Dev:** "A refund arrives for last month's purchase. Is that **Income**?"
> **Domain expert:** "No, it is an **Expense Reversal** that references the original **Expense**."

## Planned extensions

Bank sync (imported candidates), invoices, tax, and multi-currency.
