use chrono::NaiveDate;

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
