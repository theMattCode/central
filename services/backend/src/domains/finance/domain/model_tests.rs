use chrono::NaiveDate;

use super::{
    format_amount_minor_units, money, MonthQueryInput, TransactionDirection, TransactionInput,
};

#[test]
fn month_query_requires_explicit_year_month() {
    let query = MonthQueryInput {
        month: Some("2026-05".to_string()),
    }
    .into_month_query()
    .expect("valid month");

    assert_eq!(query.month, "2026-05");
    assert_eq!(
        query.start_inclusive,
        NaiveDate::from_ymd_opt(2026, 5, 1).unwrap()
    );
    assert_eq!(
        query.end_exclusive,
        NaiveDate::from_ymd_opt(2026, 6, 1).unwrap()
    );
}

#[test]
fn month_query_rejects_missing_month() {
    let error = MonthQueryInput { month: None }
        .into_month_query()
        .expect_err("missing month rejected");

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
