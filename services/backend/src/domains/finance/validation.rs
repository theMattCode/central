use chrono::NaiveDate;

use crate::error::ApiError;

pub(super) fn clean_required_text(input: Option<String>, field: &str) -> Result<String, ApiError> {
  let value = input
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
    .ok_or_else(|| ApiError::BadRequest(format!("Missing required field: {field}")))?;
  Ok(value)
}

pub(super) fn clean_optional_text(input: Option<String>, field: &str) -> Result<Option<String>, ApiError> {
  match input.map(|value| value.trim().to_string()) {
    Some(value) if value.is_empty() => Err(ApiError::BadRequest(format!(
      "Field {field} must not be blank when provided"
    ))),
    Some(value) => Ok(Some(value)),
    None => Ok(None),
  }
}

pub(super) fn clean_currency_code(input: Option<String>, field: &str) -> Result<String, ApiError> {
  let value = clean_required_text(input, field)?.to_uppercase();
  if value.len() != 3 || !value.chars().all(|value| value.is_ascii_uppercase()) {
    return Err(ApiError::BadRequest(format!(
      "Field {field} must be a 3-letter ISO currency code"
    )));
  }

  Ok(value)
}

pub(super) fn required_iso_date(input: Option<String>, field: &str) -> Result<NaiveDate, ApiError> {
  let value = input
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
    .ok_or_else(|| ApiError::BadRequest(format!("Missing required query parameter: {field}")))?;

  NaiveDate::parse_from_str(&value, "%Y-%m-%d")
    .map_err(|_| ApiError::BadRequest(format!("Query parameter {field} must be formatted as YYYY-MM-DD")))
}
