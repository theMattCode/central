DROP TABLE IF EXISTS service_finance.transactions;

CREATE TABLE service_finance.financial_accounts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  account_type TEXT NOT NULL CHECK (
    account_type IN ('cash', 'bank', 'credit', 'loan')
  ),
  primary_currency_code CHAR(3) NOT NULL CHECK (primary_currency_code ~ '^[A-Z]{3}$'),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, primary_currency_code),
  CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR (status = 'active' AND archived_at IS NULL)
  )
);

CREATE INDEX idx_finance_financial_accounts_active_order
  ON service_finance.financial_accounts (status, display_order, name, id);

CREATE TABLE service_finance.categories (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  parent_category_id UUID NULL REFERENCES service_finance.categories(id),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (parent_category_id IS NULL OR parent_category_id <> id),
  CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR (status = 'active' AND archived_at IS NULL)
  )
);

CREATE UNIQUE INDEX idx_finance_categories_parent_name
  ON service_finance.categories (COALESCE(parent_category_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

CREATE INDEX idx_finance_categories_active_parent
  ON service_finance.categories (status, parent_category_id, name, id);

CREATE TABLE service_finance.ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  entry_kind TEXT NOT NULL CHECK (
    entry_kind IN ('income', 'expense', 'expense_reversal', 'transfer')
  ),
  entry_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (entry_status IN ('candidate', 'confirmed', 'dismissed')),
  candidate_kind TEXT NULL CHECK (candidate_kind IN ('imported', 'recurring')),
  financial_account_id UUID NULL,
  category_id UUID NULL REFERENCES service_finance.categories(id),
  transfer_account_id UUID NULL,
  recurring_plan_id UUID NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL CHECK (btrim(description) <> ''),
  note TEXT NULL CHECK (note IS NULL OR btrim(note) <> ''),
  amount_minor_units BIGINT NOT NULL CHECK (amount_minor_units > 0),
  currency_code CHAR(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'source', 'system')),
  related_ledger_entry_id UUID NULL REFERENCES service_finance.ledger_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, currency_code),
  FOREIGN KEY (financial_account_id) REFERENCES service_finance.financial_accounts(id),
  FOREIGN KEY (financial_account_id, currency_code) REFERENCES service_finance.financial_accounts(id, primary_currency_code),
  FOREIGN KEY (transfer_account_id) REFERENCES service_finance.financial_accounts(id),
  FOREIGN KEY (transfer_account_id, currency_code) REFERENCES service_finance.financial_accounts(id, primary_currency_code),
  CHECK (
    (
      entry_kind IN ('income', 'expense', 'expense_reversal')
      AND financial_account_id IS NOT NULL
      AND transfer_account_id IS NULL
    )
    OR (
      entry_kind = 'transfer'
      AND financial_account_id IS NOT NULL
      AND transfer_account_id IS NOT NULL
      AND financial_account_id <> transfer_account_id
      AND category_id IS NULL
    )
  )
);

CREATE TABLE service_finance.ledger_entry_sources (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('imported', 'recurring', 'manual', 'system')),
  name TEXT NULL CHECK (name IS NULL OR btrim(name) <> ''),
  payload_json JSONB NULL,
  payload_blob BYTEA NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (payload_json IS NOT NULL OR payload_blob IS NOT NULL)
);

ALTER TABLE service_finance.ledger_entries
  ADD COLUMN source_id UUID NULL REFERENCES service_finance.ledger_entry_sources(id);

CREATE INDEX idx_finance_ledger_entries_date
  ON service_finance.ledger_entries (transaction_date DESC, created_at DESC, id DESC)
  WHERE entry_status = 'confirmed';

CREATE INDEX idx_finance_ledger_entries_account_date
  ON service_finance.ledger_entries (financial_account_id, transaction_date DESC, id DESC)
  WHERE entry_status = 'confirmed' AND financial_account_id IS NOT NULL;

CREATE INDEX idx_finance_ledger_entries_category_date
  ON service_finance.ledger_entries (category_id, transaction_date DESC, id DESC)
  WHERE entry_status = 'confirmed' AND category_id IS NOT NULL;

CREATE INDEX idx_finance_ledger_entries_candidates
  ON service_finance.ledger_entries (entry_status, transaction_date DESC, id)
  WHERE entry_status IN ('candidate', 'dismissed');

CREATE TABLE service_finance.balance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  financial_account_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  balance_minor_units BIGINT NOT NULL,
  currency_code CHAR(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  note TEXT NULL CHECK (note IS NULL OR btrim(note) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (financial_account_id) REFERENCES service_finance.financial_accounts(id),
  FOREIGN KEY (financial_account_id, currency_code) REFERENCES service_finance.financial_accounts(id, primary_currency_code),
  UNIQUE (financial_account_id, snapshot_date)
);

CREATE TABLE service_finance.budgets (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  budget_month DATE NOT NULL CHECK (date_trunc('month', budget_month)::date = budget_month),
  currency_code CHAR(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (budget_month, currency_code),
  UNIQUE (id, currency_code),
  CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR (status = 'active' AND archived_at IS NULL)
  )
);

CREATE TABLE service_finance.budget_allocations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  budget_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES service_finance.categories(id),
  planned_amount_minor_units BIGINT NOT NULL CHECK (planned_amount_minor_units >= 0),
  currency_code CHAR(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (budget_id) REFERENCES service_finance.budgets(id) ON DELETE CASCADE,
  FOREIGN KEY (budget_id, currency_code) REFERENCES service_finance.budgets(id, currency_code),
  UNIQUE (budget_id, category_id)
);

CREATE TABLE service_finance.recurring_plans (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  plan_kind TEXT NOT NULL CHECK (plan_kind IN ('expected_income', 'expected_expense', 'expected_transfer')),
  schedule_kind TEXT NOT NULL CHECK (schedule_kind IN ('weekly', 'monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  amount_minor_units BIGINT NOT NULL CHECK (amount_minor_units > 0),
  currency_code CHAR(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  source_account_id UUID NULL REFERENCES service_finance.financial_accounts(id),
  destination_account_id UUID NULL REFERENCES service_finance.financial_accounts(id),
  category_id UUID NULL REFERENCES service_finance.categories(id),
  description TEXT NOT NULL CHECK (btrim(description) <> ''),
  next_due_date DATE NOT NULL,
  reminder_lead_days INTEGER NOT NULL DEFAULT 0 CHECK (reminder_lead_days >= 0),
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR (status = 'active' AND archived_at IS NULL)
  )
);

CREATE INDEX idx_finance_recurring_plans_due
  ON service_finance.recurring_plans (status, next_due_date, id);
