use super::{FinancialAccountInput, FinancialAccountType};

fn input(name: &str, account_type: &str, currency: &str) -> FinancialAccountInput {
    FinancialAccountInput {
        name: Some(name.to_string()),
        account_type: Some(account_type.to_string()),
        primary_currency_code: Some(currency.to_string()),
    }
}

#[test]
fn draft_trims_name_and_currency() {
    let draft = input("  Girokonto  ", "bank", " EUR ")
        .into_draft()
        .expect("valid input");

    assert_eq!(draft.name, "Girokonto");
    assert_eq!(draft.account_type, FinancialAccountType::Bank);
    assert_eq!(draft.primary_currency_code, "EUR");
}

#[test]
fn draft_accepts_every_account_type() {
    for (raw, expected) in [
        ("cash", FinancialAccountType::Cash),
        ("bank", FinancialAccountType::Bank),
        ("credit", FinancialAccountType::Credit),
        ("loan", FinancialAccountType::Loan),
        ("investment", FinancialAccountType::Investment),
    ] {
        let draft = input("Account", raw, "EUR")
            .into_draft()
            .expect("valid account type");

        assert_eq!(draft.account_type, expected);
    }
}

#[test]
fn draft_rejects_blank_name() {
    let error = input("   ", "cash", "EUR")
        .into_draft()
        .expect_err("blank name");

    assert_eq!(error.to_string(), "Missing required field: name");
}

#[test]
fn draft_rejects_name_longer_than_100_characters() {
    let error = input(&"ä".repeat(101), "cash", "EUR")
        .into_draft()
        .expect_err("name too long");

    assert_eq!(
        error.to_string(),
        "Field name must be at most 100 characters"
    );
}

#[test]
fn draft_accepts_name_with_exactly_100_characters() {
    let draft = input(&"ä".repeat(100), "cash", "EUR")
        .into_draft()
        .expect("100 characters are allowed");

    assert_eq!(draft.name.chars().count(), 100);
}

#[test]
fn draft_rejects_unknown_account_type() {
    let error = input("Savings", "savings", "EUR")
        .into_draft()
        .expect_err("unknown type");

    assert_eq!(
        error.to_string(),
        "Field accountType must be one of: cash, bank, credit, loan, investment"
    );
}

#[test]
fn draft_rejects_missing_account_type() {
    let error = FinancialAccountInput {
        account_type: None,
        ..input("Wallet", "cash", "EUR")
    }
    .into_draft()
    .expect_err("missing type");

    assert_eq!(error.to_string(), "Missing required field: accountType");
}

#[test]
fn draft_rejects_currency_that_is_not_three_uppercase_letters() {
    for currency in ["eur", "EU", "EURO", "E1R", ""] {
        let error = input("Wallet", "cash", currency)
            .into_draft()
            .expect_err("invalid currency");

        assert!(
            error.to_string().contains("primaryCurrencyCode"),
            "{currency:?} gave {error}"
        );
    }
}
