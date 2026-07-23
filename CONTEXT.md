# Finance

Finance tracks money moving in and out of the user's life so the user can understand income and expenses over time.

## Language

**Cash**:
The finance area for manual income and expense transactions.
_Avoid_: Income and expense domain

**Transaction**:
A dated money movement recorded by the user.
_Avoid_: Entry, item

**Ledger Entry**:
A dated recorded financial event that changes one or more financial account balances.
_Avoid_: Activity, record

**Split Entry**:
A ledger entry whose value is divided into multiple categorized or account-affecting parts.
_Avoid_: Multi-category transaction

**Imported Candidate**:
An imported financial record waiting for user confirmation or matching.
_Avoid_: Imported transaction

**Income**:
A transaction that increases available money.
_Avoid_: Revenue, earning

**Expense**:
A transaction that decreases available money.
_Avoid_: Spending, cost

**Expense Reversal**:
A return, refund, or reimbursement that reduces a previous or category-related expense.
_Avoid_: Income, negative expense

**Category**:
A user-facing cashflow classification used for review, reporting, and budgeting.
_Avoid_: Tag, bucket

**Archived Category**:
A category hidden from active use while preserved for history.
_Avoid_: Deleted category

**Parent Category**:
A category used to roll up related child categories for reporting.
_Avoid_: Budget category

**Amount**:
The positive monetary value of a transaction, stored in minor currency units.
_Avoid_: Float amount, decimal amount

**Currency**:
The ISO 4217 currency for a monetary amount.
_Avoid_: Money type

**Transaction Date**:
The calendar date when the money movement occurred.
_Avoid_: Entry date, created date

**Financial Account**:
A real-world place where money or assets are held.
_Avoid_: Account

**Archived Financial Account**:
A financial account hidden from active use while preserved for history.
_Avoid_: Deleted account

**Cash Account**:
A financial account for physical cash.
_Avoid_: Wallet

**Bank Account**:
A financial account held at a bank for checking, savings, or current-account money.
_Avoid_: Giro account, checking account

**Credit Account**:
A financial account representing revolving borrowed money, such as a credit card.
_Avoid_: Credit card bill

**Loan Account**:
A financial account representing fixed borrowed money to be repaid over time.
_Avoid_: Debt item

**Loan Principal**:
The portion of a loan balance that remains to be repaid.
_Avoid_: Loan expense

**Loan Interest**:
The cost charged for borrowing money.
_Avoid_: Principal

**Investment Account**:
A financial account that can hold cash and investment positions.
_Avoid_: Depot, brokerage account

**Security**:
A tradable investment instrument such as an ETF, stock, bond, or fund.
_Avoid_: Asset, ticker

**Investment Position**:
The quantity of a security held in an investment account.
_Avoid_: Holding

**Price Snapshot**:
A dated market price for a security.
_Avoid_: Live quote

**Investment Transaction**:
A dated investment activity such as a buy, sell, dividend, or fee.
_Avoid_: Trade

**Dividend**:
Investment income paid by a security.
_Avoid_: Market gain

**Investment Fee**:
An expense charged for investment activity or account maintenance.
_Avoid_: Trading loss

**Transfer**:
A money movement between two financial accounts that does not count as income or expense.
_Avoid_: Transaction with income and expense sides

**Cashflow**:
Income and expenses over a reporting period, excluding transfers and market movement.
_Avoid_: Balance, net worth

**Balance**:
The value currently held or owed by a financial account.
_Avoid_: Cashflow

**Net Worth**:
The total value of asset account balances minus liability account balances.
_Avoid_: Cashflow net

**Balance Snapshot**:
A dated confirmed balance for a financial account.
_Avoid_: Opening transaction, adjustment

**Reconciliation Difference**:
The difference between a balance snapshot and the balance calculated from earlier snapshots and ledger entries.
_Avoid_: Automatic adjustment

**Budget**:
A monthly plan for expected expenses.
_Avoid_: Forecast

**Budget Allocation**:
The planned expense amount for one category within a budget.
_Avoid_: Envelope, limit

**Recurring Plan**:
An expected future income, expense, or transfer that repeats on a schedule.
_Avoid_: Recurring obligation, recurring transaction, subscription

**Recurring Schedule**:
The repeat rule for a recurring plan.
_Avoid_: Calendar rule

**Reminder**:
A prompt to review an expected plan occurrence before creating an actual transaction or transfer.
_Avoid_: Automatic transaction

**Finance Dashboard**:
The top-level view that summarizes financial accounts, cashflow, budgets, reminders, and investments.
_Avoid_: Transactions page

## Relationships

- A **Transaction** is exactly one of **Income** or **Expense**
- A **Transaction** is a cashflow **Ledger Entry**
- A **Split Entry** is one user-entered **Ledger Entry** with multiple parts
- An **Imported Candidate** is not a **Ledger Entry** until confirmed
- A manually entered **Ledger Entry** can be edited or deleted in the first version
- A **Transaction** belongs to **Cash**
- A future-state **Transaction** belongs to exactly one **Financial Account**
- A future-state **Transaction** belongs to exactly one **Category** unless it is being migrated or cleaned up
- **Categories** are shared across **Financial Accounts**
- A **Category** may have one **Parent Category**
- Transactions and **Budget Allocations** use specific child **Categories**; **Parent Categories** are for rollups
- A **Transaction** has one positive **Amount** and one **Currency**
- A **Transaction** has one user-selected **Transaction Date**
- A **Financial Account** has one primary **Currency**
- A **Financial Account** has an account type chosen at creation that cannot change afterward
- A **Financial Account** has a primary **Currency** chosen at creation that cannot change afterward; its name and display order remain editable
- A **Financial Account** can represent a bank account, cash wallet, depot, credit card, loan, or similar money-holding place
- A **Financial Account** is exactly one of **Cash Account**, **Bank Account**, **Credit Account**, **Loan Account**, or **Investment Account**
- A used **Financial Account** becomes an **Archived Financial Account** instead of being deleted
- A used **Category** becomes an **Archived Category** instead of being deleted
- An **Investment Account** can hold zero or more **Investment Positions**
- An **Investment Position** belongs to exactly one **Security** and exactly one **Investment Account**
- A **Price Snapshot** belongs to exactly one **Security**
- An **Investment Transaction** belongs to exactly one **Investment Account**
- A **Dividend** is **Income** cashflow
- An **Investment Fee** is **Expense** cashflow
- Buying or selling a **Security** changes **Investment Positions** and **Balance**, but is not **Cashflow**
- A **Transfer** is a non-cashflow **Ledger Entry**
- An **Investment Transaction** is a **Ledger Entry**
- A **Transfer** has exactly one source **Financial Account** and exactly one destination **Financial Account**
- A **Transfer** changes **Financial Account** balances but does not affect income or expense totals
- **Cashflow** includes **Income** and **Expense**, but excludes **Transfers**
- **Balance** includes account value changes whether or not they came from **Cashflow**
- **Net Worth** includes **Cash Account**, **Bank Account**, and **Investment Account** balances as assets
- **Net Worth** includes **Credit Account** and **Loan Account** balances as liabilities
- **Loan Principal** repayment is a **Transfer** that reduces a **Loan Account** liability
- **Loan Interest** is an **Expense**
- A purchase made on a **Credit Account** is an **Expense** dated when the purchase occurred
- A payment toward a **Credit Account** is a **Transfer**
- An **Expense Reversal** reduces expense actuals instead of counting as **Income**
- An **Expense Reversal** may stand alone or link to a related **Expense**
- A **Balance Snapshot** belongs to exactly one **Financial Account**
- A **Balance Snapshot** can establish an initial **Balance** or confirm a later reconciliation point
- A current **Balance** is calculated from the latest **Balance Snapshot** plus later **Ledger Entries**
- A **Reconciliation Difference** is visible until explained by corrected or additional **Ledger Entries**
- A **Budget** covers exactly one calendar month
- A **Budget Allocation** belongs to exactly one **Budget** and exactly one expense **Category**
- **Budget** actuals come from **Expense** transactions in matching **Categories**
- A **Budget** does not automatically carry unused or overspent amounts into another month
- A **Recurring Plan** may produce one or more **Reminders**
- A **Recurring Plan** expects **Income**, **Expense**, or a **Transfer**
- A **Recurring Schedule** is monthly, weekly, or yearly in the first version
- A **Reminder** can be confirmed into an actual **Transaction** or **Transfer**
- A **Reminder** is not itself **Cashflow**
- A **Finance Dashboard** summarizes finance areas and links to their focused workflows
- A **Finance Dashboard** prioritizes current financial health over raw transaction activity
- A **Finance Dashboard** separates confirmed actuals from upcoming **Reminders**
- **Finance** remains one domain with focused subareas for accounts, ledger, budgets, reminders, investments, and dashboard reporting

## Example dialogue

> **Dev:** "Can one **Transaction** be both **Income** and **Expense**?"
> **Domain expert:** "No. Split it into separate **Transactions** if both money directions need tracking."
>
> **Dev:** "Are transfers and security buys also **Transactions**?"
> **Domain expert:** "They are **Ledger Entries**. Use **Transaction** for income and expense cashflow."
>
> **Dev:** "How do we handle one receipt split across groceries and household goods?"
> **Domain expert:** "Use a **Split Entry** so one ledger event can have multiple categorized parts."
>
> **Dev:** "Does a CSV-imported bank row immediately affect **Cashflow**?"
> **Domain expert:** "No. It is an **Imported Candidate** until the user confirms or matches it."
>
> **Dev:** "Do corrections require reversal entries?"
> **Domain expert:** "No. In the first version, manually entered **Ledger Entries** can be edited or deleted directly."
>
> **Dev:** "If salary arrives on January 31 but is entered on February 2, which date drives reports?"
> **Domain expert:** "The **Transaction Date** is January 31. The recorded-at timestamp is only metadata."
>
> **Dev:** "Is an account the user's login account or their bank account?"
> **Domain expert:** "In Finance, call that a **Financial Account**: a bank account, cash wallet, depot, or similar place where money or assets are held."
>
> **Dev:** "What happens when I close an old bank account?"
> **Domain expert:** "Archive the **Financial Account** so it leaves active workflows but remains in history."
>
> **Dev:** "Is paying a credit card bill an **Expense**?"
> **Domain expert:** "No. The purchase was the **Expense**. Paying the card bill is a **Transfer** from checking to the credit card **Financial Account**."
>
> **Dev:** "If my depot gains 500 EUR from market movement, is that **Income**?"
> **Domain expert:** "No. It changes **Balance**, but it is not **Cashflow**."
>
> **Dev:** "Does credit card debt increase my **Net Worth** because it has a balance?"
> **Domain expert:** "No. **Credit Account** and **Loan Account** balances are liabilities and reduce **Net Worth**."
>
> **Dev:** "Is an entire mortgage payment an **Expense**?"
> **Domain expert:** "No. **Loan Principal** repayment reduces the **Loan Account** liability; **Loan Interest** is the **Expense**."
>
> **Dev:** "If I buy groceries with a credit card in July and pay the card in August, which month has the grocery **Expense**?"
> **Domain expert:** "July. The August card payment is only a **Transfer**."
>
> **Dev:** "If I return a 100 EUR purchase, is that 100 EUR of **Income**?"
> **Domain expert:** "No. It is an **Expense Reversal** that reduces the related expense actuals."
>
> **Dev:** "Must every **Expense Reversal** link to the original **Expense**?"
> **Domain expert:** "No. Link it when useful, but standalone reversals are valid."
>
> **Dev:** "Is Finance always EUR-only?"
> **Domain expert:** "No. Monetary amounts carry **Currency**, even though the first workflows default to EUR."
>
> **Dev:** "Should we model a depot as a special area outside accounts?"
> **Domain expert:** "No. A depot is an **Investment Account**."
>
> **Dev:** "Do I need to enter every old bank transaction before using account balances?"
> **Domain expert:** "No. Add a **Balance Snapshot** for the known balance on the starting date."
>
> **Dev:** "Where does the current **Balance** come from?"
> **Domain expert:** "Start from the latest **Balance Snapshot**, then apply later **Ledger Entries**."
>
> **Dev:** "If a bank statement differs by 5 EUR, should Central invent an adjustment?"
> **Domain expert:** "No. Show a **Reconciliation Difference** until the user corrects or adds the missing **Ledger Entries**."
>
> **Dev:** "Can a future **Transaction** exist without a **Financial Account**?"
> **Domain expert:** "No. Existing manual transactions can be migrated, but new income and expenses must belong to one **Financial Account**."
>
> **Dev:** "Can groceries and household goods be one **Expense** with two **Categories**?"
> **Domain expert:** "No. Use one **Category** per **Transaction**; split it into separate **Transactions** if budget accuracy matters."
>
> **Dev:** "Are **Categories** only for expenses?"
> **Domain expert:** "No. Income and expenses both use **Categories**, but v1 **Budgets** use expense **Categories**."
>
> **Dev:** "Is groceries a different **Category** for checking and credit card spending?"
> **Domain expert:** "No. **Categories** are shared across **Financial Accounts**."
>
> **Dev:** "Should a transaction be categorized only as Food?"
> **Domain expert:** "Prefer a specific **Category** such as Groceries; use **Parent Categories** like Food for reporting rollups."
>
> **Dev:** "Can I budget both Food and Groceries?"
> **Domain expert:** "No. Budget specific **Categories** like Groceries and Dining; Food is a **Parent Category** rollup."
>
> **Dev:** "Does moving 500 EUR to savings make my grocery budget look better?"
> **Domain expert:** "No. A **Budget** compares **Budget Allocations** to **Expense** actuals, and **Transfers** are excluded."
>
> **Dev:** "If I spend 50 EUR less on groceries in July, does August's grocery allocation increase?"
> **Domain expert:** "No. Each monthly **Budget** stands on its own."
>
> **Dev:** "Should rent appear as an **Expense** before I confirm that it was paid?"
> **Domain expert:** "No. Rent can be a **Reminder**, but it becomes an **Expense** only after confirmation."
>
> **Dev:** "Is a monthly ETF savings plan a recurring **Expense**?"
> **Domain expert:** "No. It is a **Recurring Plan** that expects a **Transfer** into an **Investment Account**."
>
> **Dev:** "Do we need full custom calendar rules for **Recurring Plans**?"
> **Domain expert:** "No. Start with monthly, weekly, and yearly **Recurring Schedules**."
>
> **Dev:** "Should the first screen just be the transaction ledger?"
> **Domain expert:** "No. The **Finance Dashboard** should summarize accounts, cashflow, budgets, reminders, and investments, with drill-down workflows for each area."
>
> **Dev:** "What should the **Finance Dashboard** lead with?"
> **Domain expert:** "Financial health today: net worth, month-to-date **Cashflow**, **Budget** status, upcoming **Reminders**, and investment value."
>
> **Dev:** "Should tomorrow's expected salary count in month-to-date income?"
> **Domain expert:** "No. Show it as an upcoming **Reminder** until it is confirmed."
>
> **Dev:** "Should accounts, budgets, reminders, and investments become separate backend domains?"
> **Domain expert:** "No. Keep them inside **Finance** as focused subareas until the boundaries prove they need to split."
>
> **Dev:** "Can we track a depot only as one account balance?"
> **Domain expert:** "No. An **Investment Account** should expose **Investment Positions** for each **Security** it holds."
>
> **Dev:** "Does v1 need live market quotes?"
> **Domain expert:** "No. Use manual **Price Snapshots** first, with room for quote providers later."
>
> **Dev:** "Is buying 500 EUR of an ETF an **Expense**?"
> **Domain expert:** "No. Buying a **Security** changes **Investment Positions**. A **Dividend** is **Income**, and an **Investment Fee** is an **Expense**."

## Flagged ambiguities

- "income and expense management" resolved to **Finance** MVP: manual **Transactions** only. Planned extensions include bank sync, budgets, recurring rules, invoices, tax, and multi-currency.
- "account" resolved to **Financial Account** in Finance to avoid confusion with user/login accounts.
- Used **Financial Accounts** and **Categories** are archived instead of deleted.
- **Ledger Entry** is the broader backbone for balance-changing records; **Transaction** remains the income/expense cashflow term.
- Manually entered **Ledger Entries** can be edited or deleted directly in the first version.
- **Split Entry** support belongs in the finance foundation even if simple UI workflows arrive first.
- **Imported Candidates** require confirmation or matching before they affect **Cashflow** or **Balance**.
- Credit card payments and depot funding are **Transfers**, not **Income** or **Expense**.
- **Cashflow** and **Balance** are distinct reporting concepts; dashboards may show both, but budgets attach to **Cashflow** while net worth attaches to **Balance**.
- **Net Worth** treats cash, bank, and investment accounts as assets, and credit and loan accounts as liabilities.
- "depot" resolved to **Investment Account**.
- Loan payments split **Loan Principal** repayment from **Loan Interest** expense.
- Credit card purchases are **Expenses** on the **Credit Account**; credit card payments are **Transfers**.
- Refunds and reimbursements are **Expense Reversals**, not ordinary **Income**.
- **Expense Reversals** may be standalone; hard-linking to the original **Expense** is optional.
- Starting balances and reconciliation points are **Balance Snapshots**, not synthetic **Transactions**.
- Current **Balance** is derived from the latest **Balance Snapshot** plus later **Ledger Entries**.
- **Reconciliation Differences** are surfaced, not automatically hidden through adjustment entries.
- Future **Transactions** must be scoped to one **Financial Account**; current accountless manual transactions are an MVP shape to migrate.
- **Category** is the primary cashflow classification; tags or labels can be considered later but are not part of the first budgeting model.
- **Categories** are global within **Finance**, not scoped to individual **Financial Accounts**.
- **Parent Categories** are optional reporting rollups, not direct **Budget Allocation** targets.
- Budgeting starts with monthly **Budget Allocations** for expense **Categories**.
- Monthly **Budgets** do not carry over unused or overspent amounts in the first version.
- **Reminders** represent expected plan occurrences; only confirmed **Transactions** and **Transfers** affect **Cashflow** or **Balance**.
- **Recurring Plans** can expect **Income**, **Expenses**, or **Transfers**.
- **Recurring Schedules** start with monthly, weekly, and yearly repeat rules.
- Investment tracking includes **Investment Positions**, not only **Investment Account** balance snapshots.
- Investment valuation starts with manual **Price Snapshots** while leaving room for automated quote providers.
- **Dividends** and **Investment Fees** affect **Cashflow**; security buys, sells, and market movement do not.
- Finance models **Currency** explicitly, but first product workflows default to EUR and avoid exchange-rate reporting.
- The **Finance Dashboard** is the top-level finance experience; feature-specific pages provide drill-down workflows.
- The **Finance Dashboard** should lead with net worth, month-to-date **Cashflow**, **Budget** status, upcoming **Reminders**, and investment value before detailed transaction activity.
- The **Finance Dashboard** separates confirmed actuals from upcoming **Reminders**.
- Accounts, ledger, budgets, reminders, investments, and dashboard reporting stay within **Finance** for the next implementation phase.
