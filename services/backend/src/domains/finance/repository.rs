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
  id::text,
  direction,
  transaction_date,
  description,
  category,
  note,
  amount_minor_units,
  currency_code,
  created_at,
  updated_at
FROM service_finance.transactions
WHERE transaction_date >= $1
  AND transaction_date < $2
ORDER BY transaction_date DESC, created_at DESC, id DESC
"#;

const INSERT_TRANSACTION_SQL: &str = r#"
INSERT INTO service_finance.transactions (
  direction,
  transaction_date,
  description,
  category,
  note,
  amount_minor_units
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING
  id::text,
  direction,
  transaction_date,
  description,
  category,
  note,
  amount_minor_units,
  currency_code,
  created_at,
  updated_at
"#;

const UPDATE_TRANSACTION_SQL: &str = r#"
UPDATE service_finance.transactions
SET
  direction = $2,
  transaction_date = $3,
  description = $4,
  category = $5,
  note = $6,
  amount_minor_units = $7,
  updated_at = now()
WHERE id = $1::uuid
RETURNING
  id::text,
  direction,
  transaction_date,
  description,
  category,
  note,
  amount_minor_units,
  currency_code,
  created_at,
  updated_at
"#;

const DELETE_TRANSACTION_SQL: &str = r#"
DELETE FROM service_finance.transactions
WHERE id = $1::uuid
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
    let row = self
      .client
      .query_one(
        INSERT_TRANSACTION_SQL,
        &[
          &draft.direction.as_str(),
          &draft.transaction_date,
          &draft.description,
          &draft.category,
          &draft.note,
          &draft.amount_minor_units,
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
    let row = self
      .client
      .query_opt(
        UPDATE_TRANSACTION_SQL,
        &[
          &id,
          &draft.direction.as_str(),
          &draft.transaction_date,
          &draft.description,
          &draft.category,
          &draft.note,
          &draft.amount_minor_units,
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
