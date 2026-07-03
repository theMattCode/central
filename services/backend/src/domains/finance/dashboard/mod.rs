#![allow(dead_code)]

use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FinanceDashboardSummary {
  pub net_worth_minor_units: i64,
  pub currency_code: String,
  pub month_income_minor_units: i64,
  pub month_expense_minor_units: i64,
  pub pending_reminder_count: usize,
}

#[async_trait::async_trait]
pub trait FinanceDashboardRepository: Send + Sync {
  async fn load_dashboard_summary(&self) -> Result<FinanceDashboardSummary, ApiError>;
}
