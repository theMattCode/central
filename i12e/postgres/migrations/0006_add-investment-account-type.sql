ALTER TABLE service_finance.financial_accounts
  DROP CONSTRAINT financial_accounts_account_type_check,
  ADD CONSTRAINT financial_accounts_account_type_check CHECK (
    account_type IN ('cash', 'bank', 'credit', 'loan', 'investment')
  );
