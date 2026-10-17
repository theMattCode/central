use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domains::finance::model::clean_required_text;
use crate::error::ApiError;

#[cfg(test)]
mod model_tests;

const MAX_NAME_CHARS: usize = 100;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FinancialAccountType {
    Cash,
    Bank,
    Credit,
    Loan,
    Investment,
}

impl FinancialAccountType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Cash => "cash",
            Self::Bank => "bank",
            Self::Credit => "credit",
            Self::Loan => "loan",
            Self::Investment => "investment",
        }
    }
}

impl TryFrom<&str> for FinancialAccountType {
    type Error = ApiError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "cash" => Ok(Self::Cash),
            "bank" => Ok(Self::Bank),
            "credit" => Ok(Self::Credit),
            "loan" => Ok(Self::Loan),
            "investment" => Ok(Self::Investment),
            _ => Err(ApiError::BadRequest(
                "Field accountType must be one of: cash, bank, credit, loan, investment"
                    .to_string(),
            )),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FinancialAccountStatus {
    Active,
    Archived,
}

impl TryFrom<&str> for FinancialAccountStatus {
    type Error = ApiError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "active" => Ok(Self::Active),
            "archived" => Ok(Self::Archived),
            _ => Err(ApiError::Internal(format!(
                "Unsupported financial account status: {value}"
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

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FinancialAccountListResponse {
    pub accounts: Vec<FinancialAccount>,
}

/// Raw request body. Fields are optional strings so that every validation error becomes a
/// `400` with the API error shape instead of a deserialization rejection.
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FinancialAccountInput {
    pub name: Option<String>,
    pub account_type: Option<String>,
    pub primary_currency_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinancialAccountDraft {
    pub name: String,
    pub account_type: FinancialAccountType,
    pub primary_currency_code: String,
}

impl FinancialAccountInput {
    pub fn into_draft(self) -> Result<FinancialAccountDraft, ApiError> {
        let name = clean_required_text(self.name, "name")?;
        if name.chars().count() > MAX_NAME_CHARS {
            return Err(ApiError::BadRequest(format!(
                "Field name must be at most {MAX_NAME_CHARS} characters"
            )));
        }
        let account_type = clean_required_text(self.account_type, "accountType")?;
        let primary_currency_code = parse_currency_code(self.primary_currency_code)?;

        Ok(FinancialAccountDraft {
            name,
            account_type: FinancialAccountType::try_from(account_type.as_str())?,
            primary_currency_code,
        })
    }
}

fn parse_currency_code(input: Option<String>) -> Result<String, ApiError> {
    let value = clean_required_text(input, "primaryCurrencyCode")?;
    if value.len() != 3 || !value.bytes().all(|byte| byte.is_ascii_uppercase()) {
        return Err(ApiError::BadRequest(
            "Field primaryCurrencyCode must be an ISO 4217 code like EUR".to_string(),
        ));
    }

    Ok(value)
}

#[async_trait::async_trait]
pub trait FinancialAccountStore: Send + Sync {
    async fn list_financial_accounts(&self) -> Result<Vec<FinancialAccount>, ApiError>;

    async fn create_financial_account(
        &self,
        draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError>;

    async fn update_financial_account(
        &self,
        id: &str,
        draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError>;

    /// Idempotent: archiving an archived account returns it unchanged.
    async fn archive_financial_account(&self, id: &str) -> Result<FinancialAccount, ApiError>;

    /// Idempotent: restoring an active account returns it unchanged. A restored account is
    /// appended to the end of the active order.
    async fn restore_financial_account(&self, id: &str) -> Result<FinancialAccount, ApiError>;
}
