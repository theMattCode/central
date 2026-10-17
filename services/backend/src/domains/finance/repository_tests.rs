use chrono::NaiveDate;
use tokio_postgres::error::SqlState;
use tokio_postgres::{Error, NoTls};

use crate::domains::finance::accounts::{
    FinancialAccountDraft, FinancialAccountStatus, FinancialAccountStore, FinancialAccountType,
};
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

async fn connect_repository(database: &TestDatabase) -> FinanceRepository {
    FinanceRepository::connect(database.url())
        .await
        .expect("connect finance repository")
}

fn account_draft(name: &str, account_type: FinancialAccountType) -> FinancialAccountDraft {
    FinancialAccountDraft {
        name: name.to_string(),
        account_type,
        primary_currency_code: "EUR".to_string(),
    }
}

#[tokio::test]
async fn create_financial_account_returns_active_account() {
    let database = TestDatabase::start().await;
    let repository = connect_repository(&database).await;

    let account = repository
        .create_financial_account(&account_draft("Depot", FinancialAccountType::Investment))
        .await
        .expect("create account");

    assert_eq!(account.name, "Depot");
    assert_eq!(account.account_type, FinancialAccountType::Investment);
    assert_eq!(account.primary_currency_code, "EUR");
    assert_eq!(account.status, FinancialAccountStatus::Active);
    assert_eq!(account.archived_at, None);
    assert_eq!(account.display_order, 0);
}

#[tokio::test]
async fn create_financial_account_appends_to_active_order() {
    let database = TestDatabase::start().await;
    let repository = connect_repository(&database).await;

    let first = repository
        .create_financial_account(&account_draft("Wallet", FinancialAccountType::Cash))
        .await
        .expect("create first account");
    let second = repository
        .create_financial_account(&account_draft("Girokonto", FinancialAccountType::Bank))
        .await
        .expect("create second account");

    assert_eq!(first.display_order, 0);
    assert_eq!(second.display_order, 1);
}

#[tokio::test]
async fn list_financial_accounts_orders_active_first_then_by_display_order() {
    let database = TestDatabase::start().await;
    let repository = connect_repository(&database).await;
    for name in ["A", "B", "C"] {
        repository
            .create_financial_account(&account_draft(name, FinancialAccountType::Bank))
            .await
            .expect("create account");
    }
    let (client, connection) = tokio_postgres::connect(database.url(), NoTls)
        .await
        .expect("connect to test database");
    tokio::spawn(connection);
    client
        .batch_execute(
            "UPDATE service_finance.financial_accounts
             SET status = 'archived', archived_at = now()
             WHERE name = 'A';
             UPDATE service_finance.financial_accounts SET display_order = 5 WHERE name = 'B';",
        )
        .await
        .expect("archive A and move B");

    let accounts = repository
        .list_financial_accounts()
        .await
        .expect("list accounts");

    let names = accounts
        .iter()
        .map(|account| account.name.as_str())
        .collect::<Vec<_>>();
    assert_eq!(names, ["C", "B", "A"]);
    assert_eq!(accounts[2].status, FinancialAccountStatus::Archived);
    assert!(accounts[2].archived_at.is_some());
}
