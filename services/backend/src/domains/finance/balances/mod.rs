#![allow(dead_code)]

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BalanceSnapshot {
  pub id: String,
  pub financial_account_id: String,
  pub snapshot_date: NaiveDate,
  pub balance_minor_units: i64,
  pub currency_code: String,
  pub note: Option<String>,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReconciliationDifference {
  pub financial_account_id: String,
  pub snapshot_id: String,
  pub difference_minor_units: i64,
  pub currency_code: String,
}

#[async_trait::async_trait]
pub trait BalanceRepository: Send + Sync {
  async fn list_balance_snapshots(&self, financial_account_id: &str) -> Result<Vec<BalanceSnapshot>, ApiError>;
}
