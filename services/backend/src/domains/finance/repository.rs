use std::{sync::Arc, time::Duration};

use chrono::{DateTime, NaiveDate, Utc};
use tokio_postgres::{config::Host, Client, NoTls, Row};
use tracing::{error, info, warn};

use crate::domains::finance::contracts::FinanceDataStore;
use crate::domains::finance::model::{
  format_amount_minor_units, summarize, TransactionDirection, TransactionDraft,
  TransactionListResponse, TransactionResponse, TransactionsQuery,
};
use crate::error::ApiError;

const DB_CONNECT_MAX_ATTEMPTS: usize = 10;
const DB_CONNECT_RETRY_DELAY: Duration = Duration::from_secs(1);

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
  client: Arc<Client>,
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
      client: Arc::new(client),
    })
  }

  async fn list_transactions(
    &self,
    query: &TransactionsQuery,
  ) -> Result<TransactionListResponse, ApiError> {
    let rows = self
      .client
      .query(
        SELECT_TRANSACTIONS_SQL,
        &[&query.start_inclusive, &query.end_exclusive],
      )
      .await
      .map_err(|error| {
        ApiError::Internal(format!(
          "Failed to list finance transactions from {} to {}: {error}",
          query.from, query.to
        ))
      })?;

    let transactions = rows
      .iter()
      .map(row_to_transaction)
      .collect::<Result<Vec<_>, _>>()?;

    Ok(summarize(query, transactions))
  }

  async fn create_transaction(
    &self,
    draft: &TransactionDraft,
  ) -> Result<TransactionResponse, ApiError> {
    self.ensure_category(&draft.category).await?;

    let row = self
      .client
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
      .map_err(|error| {
        ApiError::Internal(format!("Failed to create finance transaction: {error}"))
      })?;

    row_to_transaction(&row)
  }

  async fn update_transaction(
    &self,
    id: &str,
    draft: &TransactionDraft,
  ) -> Result<TransactionResponse, ApiError> {
    self.ensure_category(&draft.category).await?;

    let row = self
      .client
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
      .map_err(|error| {
        ApiError::Internal(format!(
          "Failed to update finance transaction {id}: {error}"
        ))
      })?;

    let Some(row) = row else {
      return Err(ApiError::NotFound(format!(
        "Finance transaction {id} was not found"
      )));
    };

    row_to_transaction(&row)
  }

  async fn delete_transaction(&self, id: &str) -> Result<(), ApiError> {
    let affected_rows = self
      .client
      .execute(DELETE_TRANSACTION_SQL, &[&id])
      .await
      .map_err(|error| {
        ApiError::Internal(format!(
          "Failed to delete finance transaction {id}: {error}"
        ))
      })?;

    if affected_rows == 0 {
      return Err(ApiError::NotFound(format!(
        "Finance transaction {id} was not found"
      )));
    }

    Ok(())
  }

  async fn ensure_category(&self, category: &Option<String>) -> Result<(), ApiError> {
    let Some(category) = category else {
      return Ok(());
    };

    self
      .client
      .execute(INSERT_CATEGORY_SQL, &[category])
      .await
      .map_err(|error| ApiError::Internal(format!("Failed to prepare finance category: {error}")))?;

    Ok(())
  }
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

#[async_trait::async_trait]
impl FinanceDataStore for FinanceRepository {
  async fn list_transactions(
    &self,
    month: &TransactionsQuery,
  ) -> Result<TransactionListResponse, ApiError> {
    FinanceRepository::list_transactions(self, month).await
  }

  async fn create_transaction(
    &self,
    draft: &TransactionDraft,
  ) -> Result<TransactionResponse, ApiError> {
    FinanceRepository::create_transaction(self, draft).await
  }

  async fn update_transaction(
    &self,
    id: &str,
    draft: &TransactionDraft,
  ) -> Result<TransactionResponse, ApiError> {
    FinanceRepository::update_transaction(self, id, draft).await
  }

  async fn delete_transaction(&self, id: &str) -> Result<(), ApiError> {
    FinanceRepository::delete_transaction(self, id).await
  }
}
