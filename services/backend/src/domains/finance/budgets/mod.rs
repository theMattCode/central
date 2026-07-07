#![allow(dead_code)]

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BudgetStatus {
  Active,
  Archived,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
  pub id: String,
  pub budget_month: NaiveDate,
  pub currency_code: String,
  pub status: BudgetStatus,
  pub archived_at: Option<DateTime<Utc>>,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BudgetAllocation {
  pub id: String,
  pub budget_id: String,
  pub category_id: String,
  pub planned_amount_minor_units: i64,
  pub currency_code: String,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

#[async_trait::async_trait]
pub trait BudgetRepository: Send + Sync {
  async fn list_budgets(&self) -> Result<Vec<Budget>, ApiError>;
}
