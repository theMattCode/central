# Finance

Finance tracks money moving in and out of the user's life so the user can understand income and expenses over time.

## Language

**Cash**:
The finance area for manual income and expense transactions.
_Avoid_: Income and expense domain

**Transaction**:
A dated money movement recorded by the user.
_Avoid_: Entry, item

**Income**:
A transaction that increases available money.
_Avoid_: Revenue, earning

**Expense**:
A transaction that decreases available money.
_Avoid_: Spending, cost

**Category**:
A user-facing label that groups transactions for review.
_Avoid_: Tag, bucket

**Amount**:
The positive monetary value of a transaction, stored in minor currency units.
_Avoid_: Float amount, decimal amount

**Currency**:
The ISO 4217 currency for a transaction.
_Avoid_: Money type

**Transaction Date**:
The calendar date when the money movement occurred.
_Avoid_: Entry date, created date

## Relationships

- A **Transaction** is exactly one of **Income** or **Expense**
- A **Transaction** belongs to **Cash**
- A **Transaction** belongs to zero or one **Category**
- A **Transaction** has one positive **Amount** and one **Currency**
- A **Transaction** has one user-selected **Transaction Date**

## Example dialogue

> **Dev:** "Can one **Transaction** be both **Income** and **Expense**?"
> **Domain expert:** "No. Split it into separate **Transactions** if both money directions need tracking."
>
> **Dev:** "If salary arrives on January 31 but is entered on February 2, which date drives reports?"
> **Domain expert:** "The **Transaction Date** is January 31. The recorded-at timestamp is only metadata."

## Flagged ambiguities

- "income and expense management" resolved to **Finance** MVP: manual **Transactions** only. Planned extensions include bank sync, budgets, recurring rules, invoices, tax, and multi-currency.
