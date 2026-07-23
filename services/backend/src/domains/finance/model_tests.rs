use chrono::NaiveDate;

use super::{
  FinancialAccountCreateInput, FinancialAccountType, FinancialAccountUpdateInput, TransactionDirection,
  TransactionInput, TransactionsQueryInput, format_amount_minor_units, money,
};

#[test]
fn date_range_query_parses_iso_dates() {
  let query = TransactionsQueryInput {
    from: Some("2026-05-01".to_string()),
    to: Some("2026-05-31".to_string()),
  }
  .into_transactions_query()
  .expect("valid range");

  assert_eq!(query.from, "2026-05-01");
  assert_eq!(query.to, "2026-05-31");
  assert_eq!(query.start_inclusive, NaiveDate::from_ymd_opt(2026, 5, 1).unwrap());
  assert_eq!(query.end_exclusive, NaiveDate::from_ymd_opt(2026, 6, 1).unwrap());
}

#[test]
fn date_range_query_rejects_missing_from() {
  let error = TransactionsQueryInput {
    from: None,
    to: Some("2026-05-31".to_string()),
  }
  .into_transactions_query()
  .expect_err("missing from rejected");

  assert_eq!(error.code(), "bad_request");
}

#[test]
fn date_range_query_rejects_inverted_range() {
  let error = TransactionsQueryInput {
    from: Some("2026-05-31".to_string()),
    to: Some("2026-05-01".to_string()),
  }
  .into_transactions_query()
  .expect_err("inverted range rejected");

  assert_eq!(error.code(), "bad_request");
}

#[test]
fn date_range_query_rejects_invalid_format() {
  let error = TransactionsQueryInput {
    from: Some("2026-05".to_string()),
    to: Some("2026-05-31".to_string()),
  }
  .into_transactions_query()
  .expect_err("invalid format rejected");

  assert_eq!(error.code(), "bad_request");
}

#[test]
fn transaction_input_parses_amount_to_minor_units() {
  let draft = TransactionInput {
    direction: Some(TransactionDirection::Expense),
    transaction_date: Some(NaiveDate::from_ymd_opt(2026, 5, 5).unwrap()),
    amount: Some("12.3".to_string()),
    description: Some(" Groceries ".to_string()),
    category: Some(" Food ".to_string()),
    note: None,
  }
  .into_draft()
  .expect("valid transaction");

  assert_eq!(draft.amount_minor_units, 1230);
  assert_eq!(draft.description, "Groceries");
  assert_eq!(draft.category.as_deref(), Some("Food"));
}

#[test]
fn financial_account_create_input_normalizes_currency_code() {
  let draft = FinancialAccountCreateInput {
    name: Some(" Wallet ".to_string()),
    account_type: Some(FinancialAccountType::Cash),
    primary_currency_code: Some("eur".to_string()),
  }
  .into_draft()
  .expect("valid account");

  assert_eq!(draft.name, "Wallet");
  assert_eq!(draft.account_type, FinancialAccountType::Cash);
  assert_eq!(draft.primary_currency_code, "EUR");
}

#[test]
fn financial_account_create_input_rejects_invalid_currency_code() {
  let error = FinancialAccountCreateInput {
    name: Some("Wallet".to_string()),
    account_type: Some(FinancialAccountType::Cash),
    primary_currency_code: Some("EURO".to_string()),
  }
  .into_draft()
  .expect_err("invalid currency rejected");

  assert_eq!(error.code(), "bad_request");
}

#[test]
fn financial_account_update_input_requires_name_and_display_order() {
  let draft = FinancialAccountUpdateInput {
    name: Some(" Main Checking ".to_string()),
    display_order: Some(20),
  }
  .into_draft()
  .expect("valid account update");

  assert_eq!(draft.name, "Main Checking");
  assert_eq!(draft.display_order, 20);
}

#[test]
fn transaction_input_rejects_float_like_precision() {
  let error = TransactionInput {
    direction: Some(TransactionDirection::Expense),
    transaction_date: Some(NaiveDate::from_ymd_opt(2026, 5, 5).unwrap()),
    amount: Some("12.345".to_string()),
    description: Some("Groceries".to_string()),
    category: None,
    note: None,
  }
  .into_draft()
  .expect_err("amount precision rejected");

  assert_eq!(error.code(), "bad_request");
}

#[test]
fn amount_formatting_keeps_two_decimal_places() {
  assert_eq!(format_amount_minor_units(1200), "12.00");
  assert_eq!(format_amount_minor_units(1234), "12.34");
  assert_eq!(money(-1234).amount, "-12.34");
}
