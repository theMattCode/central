#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FinancialAccountType {
  Cash,
  Bank,
  Credit,
  Loan,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FinancialAccountStatus {
  Active,
  Archived,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FinancialAccount {
  pub id: String,
  pub name: String,
  pub account_type: FinancialAccountType,
  pub primary_currency_code: String,
  pub display_order: i32,
  pub status: FinancialAccountStatus,
  pub archived_at: Option<DateTime<Utc>>,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

#[async_trait::async_trait]
pub trait FinancialAccountRepository: Send + Sync {
  async fn list_financial_accounts(&self) -> Result<Vec<FinancialAccount>, ApiError>;
}
