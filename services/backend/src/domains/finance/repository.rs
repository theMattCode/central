use std::{sync::Arc, time::Duration};

use chrono::{DateTime, NaiveDate, Utc};
use tokio_postgres::{config::Host, error::SqlState, Client, NoTls, Row};
use tracing::{error, info, warn};

use crate::domains::finance::accounts::{
    FinancialAccount, FinancialAccountDraft, FinancialAccountStatus, FinancialAccountStore,
    FinancialAccountType,
};
use crate::domains::finance::contracts::FinanceDataStore;
use crate::domains::finance::model::{
    format_amount_minor_units, summarize, TransactionDirection, TransactionDraft,
    TransactionListResponse, TransactionResponse, TransactionsQuery,
};
use crate::error::ApiError;

const DB_CONNECT_MAX_ATTEMPTS: usize = 10;
const DB_CONNECT_RETRY_DELAY: Duration = Duration::from_secs(1);

const FINANCIAL_ACCOUNT_COLUMNS: &str = r#"
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

/// Final select of every transaction query; the queried entry is always aliased `entry`.
const TRANSACTION_COLUMNS: &str = r#"
  entry.id::text AS id,
  entry.entry_kind AS direction,
  entry.transaction_date,
  entry.description,
  categories.name AS category,
  entry.note,
  entry.amount_minor_units,
  entry.currency_code,
  entry.financial_account_id::text AS financial_account_id,
  accounts.name AS financial_account_name,
  entry.created_at,
  entry.updated_at
"#;

const TRANSACTION_JOINS: &str = r#"
LEFT JOIN service_finance.categories
  ON categories.id = entry.category_id
LEFT JOIN service_finance.financial_accounts AS accounts
  ON accounts.id = entry.financial_account_id
"#;

const SELECT_TRANSACTIONS_SQL: &str = r#"
SELECT {columns}
FROM service_finance.ledger_entries AS entry
{joins}
WHERE entry.transaction_date >= $1
  AND entry.transaction_date < $2
  AND entry.entry_kind IN ('income', 'expense')
  AND entry.entry_status = 'confirmed'
ORDER BY entry.transaction_date DESC, entry.created_at DESC, entry.id DESC
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

/// New transactions only go to active EUR accounts; no row comes back otherwise.
const INSERT_TRANSACTION_SQL: &str = r#"
WITH account AS (
  SELECT id, primary_currency_code
  FROM service_finance.financial_accounts
  WHERE id = $7::text::uuid AND status = 'active' AND primary_currency_code = 'EUR'
),
category AS (
  SELECT id
  FROM service_finance.categories
  WHERE $6::text IS NOT NULL
    AND parent_category_id IS NULL
    AND lower(name) = lower($6::text)
),
inserted_entry AS (
  INSERT INTO service_finance.ledger_entries (
    entry_kind,
    entry_status,
    source_type,
    financial_account_id,
    category_id,
    transaction_date,
    description,
    note,
    amount_minor_units,
    currency_code
  )
  SELECT $1, 'confirmed', 'manual', account.id, (SELECT id FROM category), $2, $3, $4, $5,
    account.primary_currency_code
  FROM account
  RETURNING *
)
SELECT {columns}
FROM inserted_entry AS entry
{joins}
"#;

/// Like inserting, but an entry may keep the account it already has even if that account has
/// been archived since. `found` tells an unknown entry apart from a rejected account.
const UPDATE_TRANSACTION_SQL: &str = r#"
WITH target AS (
  SELECT id, financial_account_id
  FROM service_finance.ledger_entries
  WHERE id = $1::text::uuid
    AND entry_kind IN ('income', 'expense')
    AND entry_status = 'confirmed'
),
account AS (
  SELECT accounts.id, accounts.primary_currency_code
  FROM service_finance.financial_accounts AS accounts, target
  WHERE accounts.id = $8::text::uuid
    AND accounts.primary_currency_code = 'EUR'
    AND (accounts.status = 'active' OR accounts.id = target.financial_account_id)
),
category AS (
  SELECT id
  FROM service_finance.categories
  WHERE $7::text IS NOT NULL
    AND parent_category_id IS NULL
    AND lower(name) = lower($7::text)
),
updated_entry AS (
  UPDATE service_finance.ledger_entries AS entries
  SET
    entry_kind = $2,
    transaction_date = $3,
    description = $4,
    note = $5,
    amount_minor_units = $6,
    category_id = (SELECT id FROM category),
    financial_account_id = account.id,
    currency_code = account.primary_currency_code,
    updated_at = now()
  FROM target, account
  WHERE entries.id = target.id
  RETURNING entries.*
)
SELECT EXISTS (SELECT 1 FROM target) AS found, {columns}
FROM (SELECT 1) AS anchor
LEFT JOIN updated_entry AS entry ON true
{joins}
"#;

const DELETE_TRANSACTION_SQL: &str = r#"
DELETE FROM service_finance.ledger_entries
WHERE id = $1::text::uuid
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
                &transaction_sql(SELECT_TRANSACTIONS_SQL),
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
            .query_opt(
                &transaction_sql(INSERT_TRANSACTION_SQL),
                &[
                    &draft.direction.as_str(),
                    &draft.transaction_date,
                    &draft.description,
                    &draft.note,
                    &draft.amount_minor_units,
                    &draft.category,
                    &draft.financial_account_id,
                ],
            )
            .await
            .map_err(|error| match error.code() {
                Some(&SqlState::INVALID_TEXT_REPRESENTATION) => invalid_transaction_account(),
                _ => ApiError::Internal(format!("Failed to create finance transaction: {error}")),
            })?
            .ok_or_else(invalid_transaction_account)?;

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
            .query_one(
                &transaction_sql(UPDATE_TRANSACTION_SQL),
                &[
                    &id,
                    &draft.direction.as_str(),
                    &draft.transaction_date,
                    &draft.description,
                    &draft.note,
                    &draft.amount_minor_units,
                    &draft.category,
                    &draft.financial_account_id,
                ],
            )
            .await
            .map_err(|error| match error.code() {
                // Either id may be malformed; a malformed entry id can't match any entry either.
                Some(&SqlState::INVALID_TEXT_REPRESENTATION) if !is_uuid_like(id) => {
                    transaction_not_found(id)
                }
                Some(&SqlState::INVALID_TEXT_REPRESENTATION) => invalid_transaction_account(),
                _ => ApiError::Internal(format!(
                    "Failed to update finance transaction {id}: {error}"
                )),
            })?;

        if !row.get::<_, bool>("found") {
            return Err(transaction_not_found(id));
        }
        if row.get::<_, Option<String>>("id").is_none() {
            return Err(invalid_transaction_account());
        }

        row_to_transaction(&row)
    }

    async fn delete_transaction(&self, id: &str) -> Result<(), ApiError> {
        let affected_rows = self
            .client
            .execute(DELETE_TRANSACTION_SQL, &[&id])
            .await
            .map_err(|error| match error.code() {
                Some(&SqlState::INVALID_TEXT_REPRESENTATION) => transaction_not_found(id),
                _ => ApiError::Internal(format!(
                    "Failed to delete finance transaction {id}: {error}"
                )),
            })?;

        if affected_rows == 0 {
            return Err(transaction_not_found(id));
        }

        Ok(())
    }

    async fn ensure_category(&self, category: &Option<String>) -> Result<(), ApiError> {
        let Some(category) = category else {
            return Ok(());
        };

        self.client
            .execute(INSERT_CATEGORY_SQL, &[category])
            .await
            .map_err(|error| {
                ApiError::Internal(format!("Failed to prepare finance category: {error}"))
            })?;

        Ok(())
    }
}

fn transaction_sql(template: &str) -> String {
    template
        .replace("{columns}", TRANSACTION_COLUMNS)
        .replace("{joins}", TRANSACTION_JOINS)
}

fn transaction_not_found(id: &str) -> ApiError {
    ApiError::NotFound(format!("Finance transaction {id} was not found"))
}

fn invalid_transaction_account() -> ApiError {
    ApiError::BadRequest(
        "Field financialAccountId must reference an active EUR financial account".to_string(),
    )
}

/// Cheap shape check to tell which of two id parameters PostgreSQL could not parse.
fn is_uuid_like(value: &str) -> bool {
    value.len() == 36
        && value.chars().enumerate().all(|(index, char)| match index {
            8 | 13 | 18 | 23 => char == '-',
            _ => char.is_ascii_hexdigit(),
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
        financial_account_id: row.get("financial_account_id"),
        financial_account_name: row
            .get::<_, Option<String>>("financial_account_name")
            .ok_or_else(|| {
                ApiError::Internal("Transaction has no financial account".to_string())
            })?,
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

#[async_trait::async_trait]
impl FinancialAccountStore for FinanceRepository {
    async fn list_financial_accounts(&self) -> Result<Vec<FinancialAccount>, ApiError> {
        let sql = format!(
            "SELECT {FINANCIAL_ACCOUNT_COLUMNS}
             FROM service_finance.financial_accounts
             ORDER BY status = 'archived', display_order, name, id"
        );
        let rows = self.client.query(&sql, &[]).await.map_err(|error| {
            ApiError::Internal(format!("Failed to list financial accounts: {error}"))
        })?;

        rows.iter().map(row_to_financial_account).collect()
    }

    async fn create_financial_account(
        &self,
        draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError> {
        // New accounts go to the end of the active order.
        let sql = format!(
            "INSERT INTO service_finance.financial_accounts
               (name, account_type, primary_currency_code, display_order)
             SELECT $1, $2, $3, COALESCE(max(display_order) + 1, 0)
             FROM service_finance.financial_accounts
             WHERE status = 'active'
             RETURNING {FINANCIAL_ACCOUNT_COLUMNS}"
        );
        let row = self
            .client
            .query_one(
                &sql,
                &[
                    &draft.name,
                    &draft.account_type.as_str(),
                    &draft.primary_currency_code,
                ],
            )
            .await
            .map_err(|error| {
                ApiError::Internal(format!("Failed to create financial account: {error}"))
            })?;

        row_to_financial_account(&row)
    }

    async fn update_financial_account(
        &self,
        id: &str,
        draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError> {
        let sql = format!(
            "UPDATE service_finance.financial_accounts
             SET name = $2, account_type = $3, primary_currency_code = $4, updated_at = now()
             WHERE id = $1::text::uuid
             RETURNING {FINANCIAL_ACCOUNT_COLUMNS}"
        );
        let row = self
            .client
            .query_opt(
                &sql,
                &[
                    &id,
                    &draft.name,
                    &draft.account_type.as_str(),
                    &draft.primary_currency_code,
                ],
            )
            .await
            .map_err(|error| match error.code() {
                // Ledger entries and balance snapshots reference (account id, currency).
                Some(&SqlState::FOREIGN_KEY_VIOLATION) => ApiError::Conflict(
                    "The currency of a financial account with entries can't be changed".to_string(),
                ),
                _ => financial_account_error(id, "update", error),
            })?
            .ok_or_else(|| financial_account_not_found(id))?;

        row_to_financial_account(&row)
    }

    async fn archive_financial_account(&self, id: &str) -> Result<FinancialAccount, ApiError> {
        // Timestamps only move when the status actually changes, which keeps repeats idempotent.
        let sql = format!(
            "UPDATE service_finance.financial_accounts
             SET status = 'archived',
                 archived_at = COALESCE(archived_at, now()),
                 updated_at = CASE WHEN status = 'active' THEN now() ELSE updated_at END
             WHERE id = $1::text::uuid
             RETURNING {FINANCIAL_ACCOUNT_COLUMNS}"
        );
        self.change_financial_account_status(&sql, id, "archive")
            .await
    }

    async fn restore_financial_account(&self, id: &str) -> Result<FinancialAccount, ApiError> {
        let sql = format!(
            "UPDATE service_finance.financial_accounts
             SET status = 'active',
                 archived_at = NULL,
                 display_order = CASE
                   WHEN status = 'archived' THEN (
                     SELECT COALESCE(max(display_order) + 1, 0)
                     FROM service_finance.financial_accounts
                     WHERE status = 'active'
                   )
                   ELSE display_order
                 END,
                 updated_at = CASE WHEN status = 'archived' THEN now() ELSE updated_at END
             WHERE id = $1::text::uuid
             RETURNING {FINANCIAL_ACCOUNT_COLUMNS}"
        );
        self.change_financial_account_status(&sql, id, "restore")
            .await
    }

    async fn reorder_financial_accounts(
        &self,
        account_ids: &[String],
    ) -> Result<Vec<FinancialAccount>, ApiError> {
        // One statement checks that the ids are exactly the active accounts and only then
        // updates, so a stale or partial list never leaves a half-applied order behind.
        const REORDER_SQL: &str = r#"
WITH input AS (
  SELECT id::uuid AS id, (position - 1)::integer AS display_order
  FROM unnest($1::text[]) WITH ORDINALITY AS ids(id, position)
),
active AS (
  SELECT id FROM service_finance.financial_accounts WHERE status = 'active'
),
validation AS (
  SELECT
    (SELECT count(*) FROM input) = (SELECT count(*) FROM active)
    AND (SELECT count(DISTINCT id) FROM input) = (SELECT count(*) FROM input)
    AND NOT EXISTS (SELECT id FROM input EXCEPT SELECT id FROM active) AS is_valid
),
updated AS (
  UPDATE service_finance.financial_accounts AS accounts
  SET display_order = input.display_order,
      updated_at = CASE
        WHEN accounts.display_order <> input.display_order THEN now()
        ELSE accounts.updated_at
      END
  FROM input, validation
  WHERE accounts.id = input.id AND validation.is_valid
  RETURNING accounts.id
)
SELECT is_valid FROM validation
"#;
        let invalid_ids = || {
            ApiError::BadRequest(
                "Field accountIds must contain every active financial account exactly once"
                    .to_string(),
            )
        };

        let is_valid: bool = self
            .client
            .query_one(REORDER_SQL, &[&account_ids])
            .await
            .map_err(|error| match error.code() {
                Some(&SqlState::INVALID_TEXT_REPRESENTATION) => invalid_ids(),
                _ => ApiError::Internal(format!("Failed to reorder financial accounts: {error}")),
            })?
            .get("is_valid");
        if !is_valid {
            return Err(invalid_ids());
        }

        self.list_financial_accounts().await
    }
}

impl FinanceRepository {
    async fn change_financial_account_status(
        &self,
        sql: &str,
        id: &str,
        action: &str,
    ) -> Result<FinancialAccount, ApiError> {
        let row = self
            .client
            .query_opt(sql, &[&id])
            .await
            .map_err(|error| financial_account_error(id, action, error))?
            .ok_or_else(|| financial_account_not_found(id))?;

        row_to_financial_account(&row)
    }
}

fn financial_account_not_found(id: &str) -> ApiError {
    ApiError::NotFound(format!("Financial account {id} was not found"))
}

/// A malformed id can't match any account, so it is reported like an unknown one.
fn financial_account_error(id: &str, action: &str, error: tokio_postgres::Error) -> ApiError {
    match error.code() {
        Some(&SqlState::INVALID_TEXT_REPRESENTATION) => financial_account_not_found(id),
        _ => ApiError::Internal(format!(
            "Failed to {action} financial account {id}: {error}"
        )),
    }
}

fn row_to_financial_account(row: &Row) -> Result<FinancialAccount, ApiError> {
    let account_type =
        FinancialAccountType::try_from(row.get::<_, &str>("account_type")).map_err(|_| {
            ApiError::Internal(format!(
                "Unsupported financial account type: {}",
                row.get::<_, &str>("account_type")
            ))
        })?;

    Ok(FinancialAccount {
        id: row.get("id"),
        name: row.get("name"),
        account_type,
        primary_currency_code: row
            .get::<_, String>("primary_currency_code")
            .trim()
            .to_string(),
        display_order: row.get("display_order"),
        status: FinancialAccountStatus::try_from(row.get::<_, &str>("status"))?,
        archived_at: row.get("archived_at"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}
