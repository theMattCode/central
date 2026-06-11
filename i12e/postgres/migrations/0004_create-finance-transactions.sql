CREATE SCHEMA IF NOT EXISTS service_finance;

CREATE TABLE IF NOT EXISTS service_finance.transactions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL CHECK (btrim(description) <> ''),
  category TEXT NULL CHECK (category IS NULL OR btrim(category) <> ''),
  note TEXT NULL CHECK (note IS NULL OR btrim(note) <> ''),
  amount_minor_units BIGINT NOT NULL CHECK (amount_minor_units > 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'EUR' CHECK (currency_code = 'EUR'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_month
  ON service_finance.transactions (transaction_date DESC, created_at DESC, id DESC);
