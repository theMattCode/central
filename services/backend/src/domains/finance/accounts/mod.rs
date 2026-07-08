#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domains::finance::validation::{clean_currency_code, clean_required_text};
use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FinancialAccountType {
  Cash,
  Bank,
  Credit,
  Loan,
}

impl FinancialAccountType {
  pub fn as_str(&self) -> &'static str {
    match self {
      Self::Cash => "cash",
      Self::Bank => "bank",
      Self::Credit => "credit",
      Self::Loan => "loan",
    }
  }
}

impl TryFrom<String> for FinancialAccountType {
  type Error = ApiError;

  fn try_from(value: String) -> Result<Self, Self::Error> {
    match value.as_str() {
      "cash" => Ok(Self::Cash),
      "bank" => Ok(Self::Bank),
      "credit" => Ok(Self::Credit),
      "loan" => Ok(Self::Loan),
      _ => Err(ApiError::Internal(format!(
        "Stored financial account type has unsupported value: {value}"
      ))),
    }
  }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FinancialAccountStatus {
  Active,
  Archived,
}

impl TryFrom<String> for FinancialAccountStatus {
  type Error = ApiError;

  fn try_from(value: String) -> Result<Self, Self::Error> {
    match value.as_str() {
      "active" => Ok(Self::Active),
      "archived" => Ok(Self::Archived),
      _ => Err(ApiError::Internal(format!(
        "Stored financial account status has unsupported value: {value}"
      ))),
    }
  }
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

pub type FinancialAccountResponse = FinancialAccount;

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FinancialAccountListResponse {
  pub accounts: Vec<FinancialAccountResponse>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FinancialAccountInput {
  pub name: Option<String>,
  pub account_type: Option<FinancialAccountType>,
  pub primary_currency_code: Option<String>,
  pub display_order: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinancialAccountDraft {
  pub name: String,
  pub account_type: FinancialAccountType,
  pub primary_currency_code: String,
  pub display_order: i32,
}

impl FinancialAccountInput {
  pub fn into_draft(self) -> Result<FinancialAccountDraft, ApiError> {
    let name = clean_required_text(self.name, "name")?;
    let account_type = self
      .account_type
      .ok_or_else(|| ApiError::BadRequest("Missing required field: accountType".to_string()))?;
    let primary_currency_code = clean_currency_code(self.primary_currency_code, "primaryCurrencyCode")?;

    Ok(FinancialAccountDraft {
      name,
      account_type,
      primary_currency_code,
      display_order: self.display_order.unwrap_or(0),
    })
  }
}

#[async_trait::async_trait]
pub trait FinancialAccountRepository: Send + Sync {
  async fn list_financial_accounts(&self) -> Result<Vec<FinancialAccount>, ApiError>;
}
