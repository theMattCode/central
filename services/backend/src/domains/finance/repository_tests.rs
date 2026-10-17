use chrono::NaiveDate;
use tokio_postgres::error::SqlState;
use tokio_postgres::{Error, NoTls};

use crate::domains::finance::contracts::FinanceDataStore;
use crate::domains::finance::model::TransactionsQuery;
use crate::domains::finance::repository::FinanceRepository;
use crate::test_support::postgres::TestDatabase;

#[tokio::test]
async fn list_transactions_on_fresh_database_returns_empty_summary() {
    let database = TestDatabase::start().await;
    let repository = FinanceRepository::connect(database.url())
        .await
        .expect("connect finance repository");
    let query = TransactionsQuery {
        from: "2026-03-01".to_string(),
        to: "2026-03-31".to_string(),
        start_inclusive: NaiveDate::from_ymd_opt(2026, 3, 1).expect("valid date"),
        end_exclusive: NaiveDate::from_ymd_opt(2026, 4, 1).expect("valid date"),
    };

    let response = repository
        .list_transactions(&query)
        .await
        .expect("list transactions");

    assert!(response.transactions.is_empty());
    assert_eq!(response.summary.net_total.amount, "0.00");
}

async fn insert_account(database: &TestDatabase, account_type: &str) -> Result<u64, Error> {
    let (client, connection) = tokio_postgres::connect(database.url(), NoTls)
        .await
        .expect("connect to test database");
    tokio::spawn(connection);

    client
        .execute(
            "INSERT INTO service_finance.financial_accounts (name, account_type, primary_currency_code)
             VALUES ('Depot', $1, 'EUR')",
            &[&account_type],
        )
        .await
}

#[tokio::test]
async fn financial_accounts_accept_every_account_type() {
    let database = TestDatabase::start().await;

    for account_type in ["cash", "bank", "credit", "loan", "investment"] {
        insert_account(&database, account_type)
            .await
            .unwrap_or_else(|error| panic!("insert {account_type} account: {error:?}"));
    }
}

#[tokio::test]
async fn financial_accounts_reject_unknown_account_type() {
    let database = TestDatabase::start().await;

    let error = insert_account(&database, "savings")
        .await
        .expect_err("unknown account type must be rejected");

    assert_eq!(error.code(), Some(&SqlState::CHECK_VIOLATION));
}
