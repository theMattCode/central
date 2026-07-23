use std::{sync::Arc, time::Duration};

use chrono::{DateTime, NaiveDate, Utc};
use tokio_postgres::{Client, NoTls, Row, config::Host};
use tracing::{error, info, warn};

use crate::domains::finance::model::{
  FinancialAccountCreateDraft, FinancialAccountListResponse, FinancialAccountResponse, FinancialAccountStatus,
  FinancialAccountType, FinancialAccountUpdateDraft, TransactionDirection, TransactionDraft, TransactionListResponse,
  TransactionResponse, TransactionsQuery, format_amount_minor_units, summarize,
};
use crate::error::ApiError;

const DB_CONNECT_MAX_ATTEMPTS: usize = 10;
const DB_CONNECT_RETRY_DELAY: Duration = Duration::from_secs(1);

const SELECT_FINANCIAL_ACCOUNTS_SQL: &str = r#"
SELECT
  id::text,
  name,
  account_type,
  primary_currency_code,
  display_order,
  status,
  archived_at,
  created_at,
  updated_at
FROM service_finance.financial_accounts
ORDER BY
  CASE WHEN status = 'active' THEN 0 ELSE 1 END,
  display_order ASC,
  lower(name) ASC,
  id ASC
"#;

const INSERT_FINANCIAL_ACCOUNT_SQL: &str = r#"
INSERT INTO service_finance.financial_accounts (
  name,
  account_type,
  primary_currency_code,
  display_order
)
SELECT
  $1,
  $2,
  $3,
  COALESCE(MAX(display_order), 0) + 10
FROM service_finance.financial_accounts
RETURNING
  id::text,
  name,
  account_type,
  primary_currency_code,
  display_order,
  status,
  archived_at,
  created_at,
  updated_at
"#;

const UPDATE_FINANCIAL_ACCOUNT_SQL: &str = r#"
UPDATE service_finance.financial_accounts
SET
  name = $2,
  display_order = $3,
  updated_at = now()
WHERE id = $1::uuid
RETURNING
  id::text,
  name,
  account_type,
  primary_currency_code,
  display_order,
  status,
  archived_at,
  created_at,
  updated_at
"#;

const ARCHIVE_FINANCIAL_ACCOUNT_SQL: &str = r#"
UPDATE service_finance.financial_accounts
SET
  status = 'archived',
  archived_at = COALESCE(archived_at, now()),
  updated_at = now()
WHERE id = $1::uuid
RETURNING
  id::text,
  name,
  account_type,
  primary_currency_code,
  display_order,
  status,
  archived_at,
  created_at,
  updated_at
"#;

const SELECT_TRANSACTIONS_SQL: &str = r#"
SELECT
  ledger_entries.id::text,
  ledger_entries.entry_kind AS direction,
  ledger_entries.transaction_date,
  ledger_entries.description,
  categories.name AS category,
  ledger_entries.note,
  ledger_entries.amount_minor_units,
  ledger_entries.currency_code,
  ledger_entries.created_at,
  ledger_entries.updated_at
FROM service_finance.ledger_entries
LEFT JOIN service_finance.categories
  ON categories.id = ledger_entries.category_id
WHERE ledger_entries.transaction_date >= $1
  AND ledger_entries.transaction_date < $2
  AND ledger_entries.entry_kind IN ('income', 'expense')
  AND ledger_entries.entry_status = 'confirmed'
ORDER BY transaction_date DESC, created_at DESC, id DESC
"#;

const INSERT_CATEGORY_SQL: &str = r#"
INSERT INTO service_finance.categories (name)
VALUES ($1)
ON CONFLICT (
  (COALESCE(parent_category_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  lower(name)
)
DO UPDATE SET name = EXCLUDED.name, updated_at = now()
"#;

const INSERT_TRANSACTION_SQL: &str = r#"
WITH inserted_entry AS (
  INSERT INTO service_finance.ledger_entries (
    entry_kind,
    entry_status,
    source_type,
    category_id,
    transaction_date,
    description,
    note,
    amount_minor_units,
    currency_code
  )
  SELECT
    $1,
    'confirmed',
    'manual',
    categories.id,
    $2,
    $3,
    $4,
    $5,
    'EUR'
  FROM service_finance.categories
  WHERE $6::text IS NOT NULL
    AND categories.parent_category_id IS NULL
    AND lower(categories.name) = lower($6::text)
  UNION ALL
  SELECT $1, 'confirmed', 'manual', NULL, $2, $3, $4, $5, 'EUR'
  WHERE $6::text IS NULL
  RETURNING *
)
SELECT
  inserted_entry.id::text,
  inserted_entry.entry_kind AS direction,
  inserted_entry.transaction_date,
  inserted_entry.description,
  categories.name AS category,
  inserted_entry.note,
  inserted_entry.amount_minor_units,
  inserted_entry.currency_code,
  inserted_entry.created_at,
  inserted_entry.updated_at
FROM inserted_entry
LEFT JOIN service_finance.categories
  ON categories.id = inserted_entry.category_id
"#;

const UPDATE_TRANSACTION_SQL: &str = r#"
WITH updated_entry AS (
  UPDATE service_finance.ledger_entries
  SET
    entry_kind = $2,
    entry_status = 'confirmed',
    source_type = 'manual',
    category_id = categories.id,
    transaction_date = $3,
    description = $4,
    note = $5,
    amount_minor_units = $6,
    currency_code = 'EUR',
    updated_at = now()
  FROM service_finance.categories
  WHERE ledger_entries.id = $1::uuid
    AND ledger_entries.entry_kind IN ('income', 'expense')
    AND ledger_entries.entry_status = 'confirmed'
    AND $7::text IS NOT NULL
    AND categories.parent_category_id IS NULL
    AND lower(categories.name) = lower($7::text)
  RETURNING *
),
updated_uncategorized_entry AS (
  UPDATE service_finance.ledger_entries
  SET
    entry_kind = $2,
    entry_status = 'confirmed',
    source_type = 'manual',
    category_id = NULL,
    transaction_date = $3,
    description = $4,
    note = $5,
    amount_minor_units = $6,
    currency_code = 'EUR',
    updated_at = now()
  WHERE ledger_entries.id = $1::uuid
    AND entry_kind IN ('income', 'expense')
    AND entry_status = 'confirmed'
    AND $7::text IS NULL
  RETURNING *
),
selected_entry AS (
  SELECT * FROM updated_entry
  UNION ALL
  SELECT * FROM updated_uncategorized_entry
)
SELECT
  selected_entry.id::text,
  selected_entry.entry_kind AS direction,
  selected_entry.transaction_date,
  selected_entry.description,
  categories.name AS category,
  selected_entry.note,
  selected_entry.amount_minor_units,
  selected_entry.currency_code,
  selected_entry.created_at,
  selected_entry.updated_at
FROM selected_entry
LEFT JOIN service_finance.categories
  ON categories.id = selected_entry.category_id
"#;

const DELETE_TRANSACTION_SQL: &str = r#"
DELETE FROM service_finance.ledger_entries
WHERE id = $1::uuid
  AND entry_kind IN ('income', 'expense')
  AND entry_status = 'confirmed'
"#;

#[derive(Clone)]
pub struct FinanceRepository {
  backend: FinanceRepositoryBackend,
}

#[derive(Clone)]
enum FinanceRepositoryBackend {
  Postgres(Arc<Client>),
  #[cfg(test)]
  InMemory(Arc<InMemoryFinanceRepository>),
  #[cfg(test)]
  Failing(&'static str),
}

#[cfg(test)]
#[derive(Default)]
struct InMemoryFinanceRepository {
  accounts: std::sync::Mutex<Vec<FinancialAccountResponse>>,
  transactions: std::sync::Mutex<Vec<TransactionResponse>>,
}

impl FinanceRepository {
  pub async fn connect(database_url: &str) -> Result<Self, ApiError> {
    let db_target = redact_database_target(database_url);
    let mut attempt = 1_usize;
    let (client, connection) = loop {
      match tokio_postgres::connect(database_url, NoTls).await {
        Ok(connected) => break connected,
        Err(error) if attempt < DB_CONNECT_MAX_ATTEMPTS => {
          warn!(
              attempt,
              max_attempts = DB_CONNECT_MAX_ATTEMPTS,
              retry_delay_seconds = DB_CONNECT_RETRY_DELAY.as_secs(),
              database_target = %db_target,
              error = %error,
              error_debug = ?error,
              "Failed to connect to PostgreSQL database; retrying"
          );
          tokio::time::sleep(DB_CONNECT_RETRY_DELAY).await;
          attempt += 1;
        }
        Err(error) => {
          return Err(ApiError::Internal(format!(
            "Failed to connect to PostgreSQL database ({db_target}) after {attempt} attempts: {error}"
          )));
        }
      }
    };

    tokio::spawn(async move {
      if let Err(error) = connection.await {
        error!("PostgreSQL connection terminated: {error}");
      }
    });

    info!(
        attempt,
        database_target = %db_target,
        "Connected to PostgreSQL for finance persistence"
    );

    Ok(Self {
      backend: FinanceRepositoryBackend::Postgres(Arc::new(client)),
    })
  }

  #[cfg(test)]
  pub(crate) fn in_memory() -> Self {
    Self {
      backend: FinanceRepositoryBackend::InMemory(Arc::new(InMemoryFinanceRepository::default())),
    }
  }

  #[cfg(test)]
  pub(crate) fn failing(label: &'static str) -> Self {
    Self {
      backend: FinanceRepositoryBackend::Failing(label),
    }
  }

  pub(crate) async fn list_financial_accounts(&self) -> Result<FinancialAccountListResponse, ApiError> {
    #[cfg(test)]
    match &self.backend {
      FinanceRepositoryBackend::InMemory(repository) => return repository.list_financial_accounts(),
      FinanceRepositoryBackend::Failing(label) => return Err(unexpected_call(label)),
      FinanceRepositoryBackend::Postgres(_) => {}
    }

    let rows = self
      .postgres_client()?
      .query(SELECT_FINANCIAL_ACCOUNTS_SQL, &[])
      .await
      .map_err(|error| ApiError::Internal(format!("Failed to list financial accounts: {error}")))?;

    let accounts = rows
      .iter()
      .map(row_to_financial_account)
      .collect::<Result<Vec<_>, _>>()?;

    Ok(FinancialAccountListResponse { accounts })
  }

  pub(crate) async fn create_financial_account(
    &self,
    draft: &FinancialAccountCreateDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    #[cfg(test)]
    match &self.backend {
      FinanceRepositoryBackend::InMemory(repository) => return repository.create_financial_account(draft),
      FinanceRepositoryBackend::Failing(label) => return Err(unexpected_call(label)),
      FinanceRepositoryBackend::Postgres(_) => {}
    }

    let row = self
      .postgres_client()?
      .query_one(
        INSERT_FINANCIAL_ACCOUNT_SQL,
        &[&draft.name, &draft.account_type.as_str(), &draft.primary_currency_code],
      )
      .await
      .map_err(|error| ApiError::Internal(format!("Failed to create financial account: {error}")))?;

    row_to_financial_account(&row)
  }

  pub(crate) async fn update_financial_account(
    &self,
    id: &str,
    draft: &FinancialAccountUpdateDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    #[cfg(test)]
    match &self.backend {
      FinanceRepositoryBackend::InMemory(repository) => return repository.update_financial_account(id, draft),
      FinanceRepositoryBackend::Failing(label) => return Err(unexpected_call(label)),
      FinanceRepositoryBackend::Postgres(_) => {}
    }

    let row = self
      .postgres_client()?
      .query_opt(UPDATE_FINANCIAL_ACCOUNT_SQL, &[&id, &draft.name, &draft.display_order])
      .await
      .map_err(|error| ApiError::Internal(format!("Failed to update financial account {id}: {error}")))?;

    let Some(row) = row else {
      return Err(ApiError::NotFound(format!("Financial account {id} was not found")));
    };

    row_to_financial_account(&row)
  }

  pub(crate) async fn archive_financial_account(&self, id: &str) -> Result<FinancialAccountResponse, ApiError> {
    #[cfg(test)]
    match &self.backend {
      FinanceRepositoryBackend::InMemory(repository) => return repository.archive_financial_account(id),
      FinanceRepositoryBackend::Failing(label) => return Err(unexpected_call(label)),
      FinanceRepositoryBackend::Postgres(_) => {}
    }

    let row = self
      .postgres_client()?
      .query_opt(ARCHIVE_FINANCIAL_ACCOUNT_SQL, &[&id])
      .await
      .map_err(|error| ApiError::Internal(format!("Failed to archive financial account {id}: {error}")))?;

    let Some(row) = row else {
      return Err(ApiError::NotFound(format!("Financial account {id} was not found")));
    };

    row_to_financial_account(&row)
  }

  pub(crate) async fn list_transactions(&self, query: &TransactionsQuery) -> Result<TransactionListResponse, ApiError> {
    #[cfg(test)]
    match &self.backend {
      FinanceRepositoryBackend::InMemory(repository) => return repository.list_transactions(query),
      FinanceRepositoryBackend::Failing(label) => return Err(unexpected_call(label)),
      FinanceRepositoryBackend::Postgres(_) => {}
    }

    let rows = self
      .postgres_client()?
      .query(SELECT_TRANSACTIONS_SQL, &[&query.start_inclusive, &query.end_exclusive])
      .await
      .map_err(|error| {
        ApiError::Internal(format!(
          "Failed to list finance transactions from {} to {}: {error}",
          query.from, query.to
        ))
      })?;

    let transactions = rows.iter().map(row_to_transaction).collect::<Result<Vec<_>, _>>()?;

    Ok(summarize(query, transactions))
  }

  pub(crate) async fn create_transaction(&self, draft: &TransactionDraft) -> Result<TransactionResponse, ApiError> {
    #[cfg(test)]
    match &self.backend {
      FinanceRepositoryBackend::InMemory(repository) => return repository.create_transaction(draft),
      FinanceRepositoryBackend::Failing(label) => return Err(unexpected_call(label)),
      FinanceRepositoryBackend::Postgres(_) => {}
    }

    self.ensure_category(&draft.category).await?;

    let row = self
      .postgres_client()?
      .query_one(
        INSERT_TRANSACTION_SQL,
        &[
          &draft.direction.as_str(),
          &draft.transaction_date,
          &draft.description,
          &draft.note,
          &draft.amount_minor_units,
          &draft.category,
        ],
      )
      .await
      .map_err(|error| ApiError::Internal(format!("Failed to create finance transaction: {error}")))?;

    row_to_transaction(&row)
  }

  pub(crate) async fn update_transaction(
    &self,
    id: &str,
    draft: &TransactionDraft,
  ) -> Result<TransactionResponse, ApiError> {
    #[cfg(test)]
    match &self.backend {
      FinanceRepositoryBackend::InMemory(repository) => return repository.update_transaction(id, draft),
      FinanceRepositoryBackend::Failing(label) => return Err(unexpected_call(label)),
      FinanceRepositoryBackend::Postgres(_) => {}
    }

    self.ensure_category(&draft.category).await?;

    let row = self
      .postgres_client()?
      .query_opt(
        UPDATE_TRANSACTION_SQL,
        &[
          &id,
          &draft.direction.as_str(),
          &draft.transaction_date,
          &draft.description,
          &draft.note,
          &draft.amount_minor_units,
          &draft.category,
        ],
      )
      .await
      .map_err(|error| ApiError::Internal(format!("Failed to update finance transaction {id}: {error}")))?;

    let Some(row) = row else {
      return Err(ApiError::NotFound(format!("Finance transaction {id} was not found")));
    };

    row_to_transaction(&row)
  }

  pub(crate) async fn delete_transaction(&self, id: &str) -> Result<(), ApiError> {
    #[cfg(test)]
    match &self.backend {
      FinanceRepositoryBackend::InMemory(repository) => return repository.delete_transaction(id),
      FinanceRepositoryBackend::Failing(label) => return Err(unexpected_call(label)),
      FinanceRepositoryBackend::Postgres(_) => {}
    }

    let affected_rows = self
      .postgres_client()?
      .execute(DELETE_TRANSACTION_SQL, &[&id])
      .await
      .map_err(|error| ApiError::Internal(format!("Failed to delete finance transaction {id}: {error}")))?;

    if affected_rows == 0 {
      return Err(ApiError::NotFound(format!("Finance transaction {id} was not found")));
    }

    Ok(())
  }

  async fn ensure_category(&self, category: &Option<String>) -> Result<(), ApiError> {
    let Some(category) = category else {
      return Ok(());
    };

    self
      .postgres_client()?
      .execute(INSERT_CATEGORY_SQL, &[category])
      .await
      .map_err(|error| ApiError::Internal(format!("Failed to prepare finance category: {error}")))?;

    Ok(())
  }

  fn postgres_client(&self) -> Result<&Client, ApiError> {
    match &self.backend {
      FinanceRepositoryBackend::Postgres(client) => Ok(client.as_ref()),
      #[cfg(test)]
      FinanceRepositoryBackend::InMemory(_) | FinanceRepositoryBackend::Failing(_) => Err(ApiError::Internal(
        "PostgreSQL client requested for test finance repository".to_string(),
      )),
    }
  }
}

#[cfg(test)]
impl InMemoryFinanceRepository {
  fn list_financial_accounts(&self) -> Result<FinancialAccountListResponse, ApiError> {
    Ok(FinancialAccountListResponse {
      accounts: self.accounts.lock().expect("lock accounts").clone(),
    })
  }

  fn create_financial_account(
    &self,
    draft: &FinancialAccountCreateDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    let mut accounts = self.accounts.lock().expect("lock accounts");
    let now = Utc::now();
    let account = FinancialAccountResponse {
      id: format!("00000000-0000-7000-9000-{:012}", accounts.len() + 1),
      name: draft.name.clone(),
      account_type: draft.account_type.clone(),
      primary_currency_code: draft.primary_currency_code.clone(),
      display_order: accounts.iter().map(|account| account.display_order).max().unwrap_or(0) + 10,
      status: FinancialAccountStatus::Active,
      archived_at: None,
      created_at: now,
      updated_at: now,
    };
    accounts.push(account.clone());

    Ok(account)
  }

  fn update_financial_account(
    &self,
    id: &str,
    draft: &FinancialAccountUpdateDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    let mut accounts = self.accounts.lock().expect("lock accounts");
    let Some(account) = accounts.iter_mut().find(|account| account.id == id) else {
      return Err(ApiError::NotFound(format!("Financial account {id} was not found")));
    };

    account.name = draft.name.clone();
    account.display_order = draft.display_order;
    account.updated_at = Utc::now();

    Ok(account.clone())
  }

  fn archive_financial_account(&self, id: &str) -> Result<FinancialAccountResponse, ApiError> {
    let mut accounts = self.accounts.lock().expect("lock accounts");
    let Some(account) = accounts.iter_mut().find(|account| account.id == id) else {
      return Err(ApiError::NotFound(format!("Financial account {id} was not found")));
    };

    account.status = FinancialAccountStatus::Archived;
    account.archived_at = Some(Utc::now());
    account.updated_at = Utc::now();

    Ok(account.clone())
  }

  fn list_transactions(&self, query: &TransactionsQuery) -> Result<TransactionListResponse, ApiError> {
    let transactions = self
      .transactions
      .lock()
      .expect("lock transactions")
      .iter()
      .filter(|transaction| {
        transaction.transaction_date >= query.start_inclusive && transaction.transaction_date < query.end_exclusive
      })
      .cloned()
      .collect::<Vec<_>>();

    Ok(summarize(query, transactions))
  }

  fn create_transaction(&self, draft: &TransactionDraft) -> Result<TransactionResponse, ApiError> {
    let now = Utc::now();
    let transaction = TransactionResponse {
      id: format!(
        "00000000-0000-7000-8000-{:012}",
        self.transactions.lock().expect("lock transactions").len() + 1
      ),
      direction: draft.direction.clone(),
      transaction_date: draft.transaction_date,
      amount: format_amount_minor_units(draft.amount_minor_units),
      currency_code: "EUR".to_string(),
      description: draft.description.clone(),
      category: draft.category.clone(),
      note: draft.note.clone(),
      created_at: now,
      updated_at: now,
    };
    self
      .transactions
      .lock()
      .expect("lock transactions")
      .push(transaction.clone());

    Ok(transaction)
  }

  fn update_transaction(&self, id: &str, draft: &TransactionDraft) -> Result<TransactionResponse, ApiError> {
    let mut transactions = self.transactions.lock().expect("lock transactions");
    let Some(transaction) = transactions.iter_mut().find(|transaction| transaction.id == id) else {
      return Err(ApiError::NotFound(format!("Finance transaction {id} was not found")));
    };

    transaction.direction = draft.direction.clone();
    transaction.transaction_date = draft.transaction_date;
    transaction.amount = format_amount_minor_units(draft.amount_minor_units);
    transaction.description = draft.description.clone();
    transaction.category = draft.category.clone();
    transaction.note = draft.note.clone();
    transaction.updated_at = Utc::now();

    Ok(transaction.clone())
  }

  fn delete_transaction(&self, id: &str) -> Result<(), ApiError> {
    let mut transactions = self.transactions.lock().expect("lock transactions");
    let old_len = transactions.len();
    transactions.retain(|transaction| transaction.id != id);

    if old_len == transactions.len() {
      return Err(ApiError::NotFound(format!("Finance transaction {id} was not found")));
    }

    Ok(())
  }
}

fn row_to_financial_account(row: &Row) -> Result<FinancialAccountResponse, ApiError> {
  let account_type: String = row.get("account_type");
  let status: String = row.get("status");
  let primary_currency_code: String = row.get::<_, String>("primary_currency_code").trim().to_string();

  Ok(FinancialAccountResponse {
    id: row.get("id"),
    name: row.get("name"),
    account_type: FinancialAccountType::try_from(account_type)?,
    primary_currency_code,
    display_order: row.get("display_order"),
    status: FinancialAccountStatus::try_from(status)?,
    archived_at: row.get::<_, Option<DateTime<Utc>>>("archived_at"),
    created_at: row.get::<_, DateTime<Utc>>("created_at"),
    updated_at: row.get::<_, DateTime<Utc>>("updated_at"),
  })
}

fn row_to_transaction(row: &Row) -> Result<TransactionResponse, ApiError> {
  let direction: String = row.get("direction");
  let amount_minor_units: i64 = row.get("amount_minor_units");
  let currency_code: String = row.get::<_, String>("currency_code").trim().to_string();

  Ok(TransactionResponse {
    id: row.get("id"),
    direction: TransactionDirection::try_from(direction)?,
    transaction_date: row.get::<_, NaiveDate>("transaction_date"),
    amount: format_amount_minor_units(amount_minor_units),
    currency_code,
    description: row.get("description"),
    category: row.get("category"),
    note: row.get("note"),
    created_at: row.get::<_, DateTime<Utc>>("created_at"),
    updated_at: row.get::<_, DateTime<Utc>>("updated_at"),
  })
}

fn redact_database_target(database_url: &str) -> String {
  let parsed = match database_url.parse::<tokio_postgres::Config>() {
    Ok(config) => config,
    Err(_) => return "<invalid database url>".to_string(),
  };

  let host = parsed
    .get_hosts()
    .first()
    .map(|value| match value {
      Host::Tcp(host) => host.clone(),
      Host::Unix(path) => path.display().to_string(),
    })
    .unwrap_or_else(|| "<unknown-host>".to_string());
  let port = parsed.get_ports().first().copied().unwrap_or(5432);
  let database = parsed.get_dbname().unwrap_or("<unknown-db>");

  format!("{host}:{port}/{database}")
}

#[cfg(test)]
fn unexpected_call(label: &'static str) -> ApiError {
  ApiError::Internal(format!("finance repository should not be called by {label} tests"))
}
