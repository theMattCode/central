#![allow(dead_code)]

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum RecurringPlanKind {
  #[serde(rename = "expected_income")]
  Income,
  #[serde(rename = "expected_expense")]
  Expense,
  #[serde(rename = "expected_transfer")]
  Transfer,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RecurringScheduleKind {
  Weekly,
  Monthly,
  Yearly,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RecurringPlanStatus {
  Active,
  Archived,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecurringPlan {
  pub id: String,
  pub plan_kind: RecurringPlanKind,
  pub schedule_kind: RecurringScheduleKind,
  pub status: RecurringPlanStatus,
  pub amount_minor_units: i64,
  pub currency_code: String,
  pub source_account_id: Option<String>,
  pub destination_account_id: Option<String>,
  pub category_id: Option<String>,
  pub description: String,
  pub next_due_date: NaiveDate,
  pub reminder_lead_days: i32,
  pub archived_at: Option<DateTime<Utc>>,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

#[async_trait::async_trait]
pub trait RecurringRepository: Send + Sync {
  async fn list_recurring_plans(&self) -> Result<Vec<RecurringPlan>, ApiError>;
}
