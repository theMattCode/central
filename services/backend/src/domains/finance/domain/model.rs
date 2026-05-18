use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

const CURRENCY_CODE: &str = "EUR";
const MAX_AMOUNT_MINOR_UNITS: i64 = 99_999_999_999;

#[derive(Debug, Deserialize, Clone)]
pub struct MonthQueryInput {
    pub month: Option<String>,
}

#[derive(Debug, Clone)]
pub struct MonthQuery {
    pub month: String,
    pub start_inclusive: NaiveDate,
    pub end_exclusive: NaiveDate,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TransactionDirection {
    Income,
    Expense,
}

impl TransactionDirection {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Income => "income",
            Self::Expense => "expense",
        }
    }
}

impl TryFrom<String> for TransactionDirection {
    type Error = ApiError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.as_str() {
            "income" => Ok(Self::Income),
            "expense" => Ok(Self::Expense),
            _ => Err(ApiError::Internal(format!(
                "Stored transaction direction has unsupported value: {value}"
            ))),
        }
    }
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransactionInput {
    pub direction: Option<TransactionDirection>,
    pub transaction_date: Option<NaiveDate>,
    pub amount: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransactionDraft {
    pub direction: TransactionDirection,
    pub transaction_date: NaiveDate,
    pub amount_minor_units: i64,
    pub description: String,
    pub category: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MoneyAmount {
    pub amount: String,
    pub currency_code: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TransactionResponse {
    pub id: String,
    pub direction: TransactionDirection,
    pub transaction_date: NaiveDate,
    pub amount: String,
    pub currency_code: String,
    pub description: String,
    pub category: Option<String>,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TransactionSummary {
    pub income_total: MoneyAmount,
    pub expense_total: MoneyAmount,
    pub net_total: MoneyAmount,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TransactionListResponse {
    pub month: String,
    pub summary: TransactionSummary,
    pub transactions: Vec<TransactionResponse>,
}

impl MonthQueryInput {
    pub fn into_month_query(self) -> Result<MonthQuery, ApiError> {
        let month = self
            .month
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                ApiError::BadRequest("Missing required query parameter: month".to_string())
            })?;

        let (year, month_number) = parse_month(&month)?;
        let start_inclusive = NaiveDate::from_ymd_opt(year, month_number, 1).ok_or_else(|| {
            ApiError::BadRequest("Query parameter month must be formatted as YYYY-MM".to_string())
        })?;
        let end_exclusive = if month_number == 12 {
            NaiveDate::from_ymd_opt(year + 1, 1, 1)
        } else {
            NaiveDate::from_ymd_opt(year, month_number + 1, 1)
        }
        .ok_or_else(|| {
            ApiError::BadRequest("Query parameter month must be formatted as YYYY-MM".to_string())
        })?;

        Ok(MonthQuery {
            month,
            start_inclusive,
            end_exclusive,
        })
    }
}

impl TransactionInput {
    pub fn into_draft(self) -> Result<TransactionDraft, ApiError> {
        let direction = self
            .direction
            .ok_or_else(|| ApiError::BadRequest("Missing required field: direction".to_string()))?;
        let transaction_date = self.transaction_date.ok_or_else(|| {
            ApiError::BadRequest("Missing required field: transactionDate".to_string())
        })?;
        let amount = self
            .amount
            .ok_or_else(|| ApiError::BadRequest("Missing required field: amount".to_string()))?;
        let description = clean_required_text(self.description, "description")?;
        let category = clean_optional_text(self.category, "category")?;
        let note = clean_optional_text(self.note, "note")?;

        Ok(TransactionDraft {
            direction,
            transaction_date,
            amount_minor_units: parse_amount_minor_units(&amount)?,
            description,
            category,
            note,
        })
    }
}

pub fn format_amount_minor_units(amount_minor_units: i64) -> String {
    let sign = if amount_minor_units < 0 { "-" } else { "" };
    let absolute = amount_minor_units.abs();
    format!("{sign}{}.{:02}", absolute / 100, absolute % 100)
}

pub fn money(amount_minor_units: i64) -> MoneyAmount {
    MoneyAmount {
        amount: format_amount_minor_units(amount_minor_units),
        currency_code: CURRENCY_CODE.to_string(),
    }
}

fn parse_month(month: &str) -> Result<(i32, u32), ApiError> {
    let Some((year, month_number)) = month.split_once('-') else {
        return Err(ApiError::BadRequest(
            "Query parameter month must be formatted as YYYY-MM".to_string(),
        ));
    };

    if year.len() != 4 || month_number.len() != 2 {
        return Err(ApiError::BadRequest(
            "Query parameter month must be formatted as YYYY-MM".to_string(),
        ));
    }

    let year = year.parse::<i32>().map_err(|_| {
        ApiError::BadRequest("Query parameter month must be formatted as YYYY-MM".to_string())
    })?;
    let month_number = month_number.parse::<u32>().map_err(|_| {
        ApiError::BadRequest("Query parameter month must be formatted as YYYY-MM".to_string())
    })?;

    if !(1..=12).contains(&month_number) {
        return Err(ApiError::BadRequest(
            "Query parameter month must be formatted as YYYY-MM".to_string(),
        ));
    }

    Ok((year, month_number))
}

fn clean_required_text(input: Option<String>, field: &str) -> Result<String, ApiError> {
    let value = input
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::BadRequest(format!("Missing required field: {field}")))?;
    Ok(value)
}

fn clean_optional_text(input: Option<String>, field: &str) -> Result<Option<String>, ApiError> {
    match input.map(|value| value.trim().to_string()) {
        Some(value) if value.is_empty() => Err(ApiError::BadRequest(format!(
            "Field {field} must not be blank when provided"
        ))),
        Some(value) => Ok(Some(value)),
        None => Ok(None),
    }
}

fn parse_amount_minor_units(input: &str) -> Result<i64, ApiError> {
    let value = input.trim();
    if value.is_empty() || value.starts_with('-') || value.starts_with('+') {
        return Err(invalid_amount());
    }

    let parts = value.split('.').collect::<Vec<_>>();
    if parts.len() > 2
        || parts[0].is_empty()
        || !parts[0].chars().all(|value| value.is_ascii_digit())
    {
        return Err(invalid_amount());
    }

    let major = parts[0].parse::<i64>().map_err(|_| invalid_amount())?;
    let minor = match parts.get(1) {
        Some(fraction) if fraction.is_empty() || fraction.len() > 2 => return Err(invalid_amount()),
        Some(fraction) if !fraction.chars().all(|value| value.is_ascii_digit()) => {
            return Err(invalid_amount())
        }
        Some(fraction) => {
            let padded = format!("{fraction:0<2}");
            padded.parse::<i64>().map_err(|_| invalid_amount())?
        }
        None => 0,
    };

    let total = major
        .checked_mul(100)
        .and_then(|value| value.checked_add(minor))
        .ok_or_else(invalid_amount)?;

    if total <= 0 || total > MAX_AMOUNT_MINOR_UNITS {
        return Err(invalid_amount());
    }

    Ok(total)
}

fn invalid_amount() -> ApiError {
    ApiError::BadRequest(
        "Field amount must be between 0.01 and 999999999.99 with up to 2 decimal places"
            .to_string(),
    )
}

pub fn summarize(month: String, transactions: Vec<TransactionResponse>) -> TransactionListResponse {
    let income_minor_units = transactions
        .iter()
        .filter(|transaction| transaction.direction == TransactionDirection::Income)
        .map(|transaction| parse_response_amount(&transaction.amount))
        .sum::<i64>();
    let expense_minor_units = transactions
        .iter()
        .filter(|transaction| transaction.direction == TransactionDirection::Expense)
        .map(|transaction| parse_response_amount(&transaction.amount))
        .sum::<i64>();

    TransactionListResponse {
        month,
        summary: TransactionSummary {
            income_total: money(income_minor_units),
            expense_total: money(expense_minor_units),
            net_total: money(income_minor_units - expense_minor_units),
        },
        transactions,
    }
}

fn parse_response_amount(amount: &str) -> i64 {
    parse_amount_minor_units(amount).unwrap_or(0)
}

#[cfg(test)]
#[path = "model_tests.rs"]
mod tests;
