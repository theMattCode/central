use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use reqwest::StatusCode;

use crate::domains::finance::accounts::{
    FinancialAccount, FinancialAccountDraft, FinancialAccountStatus, FinancialAccountStore,
};
use crate::domains::finance::contracts::FinanceDataStore;
use crate::domains::finance::model::{
    format_amount_minor_units, summarize, TransactionDraft, TransactionListResponse,
    TransactionResponse, TransactionsQuery,
};
use crate::domains::finance::service::FinanceService;
use crate::domains::weather::contracts::{WeatherDataFetcher, WeatherDataStore};
use crate::domains::weather::model::{
    HourlyWeatherPayload, WeatherForecastResponse, WeatherLocationQuery, WeatherSnapshotResponse,
};
use crate::domains::weather::service::WeatherService;
use crate::{config::Config, context::Context, error::ApiError};

#[derive(Default)]
struct FakeFinanceStore {
    transactions: Mutex<Vec<TransactionResponse>>,
    accounts: Mutex<Vec<FinancialAccount>>,
}

#[async_trait::async_trait]
impl FinancialAccountStore for FakeFinanceStore {
    async fn list_financial_accounts(&self) -> Result<Vec<FinancialAccount>, ApiError> {
        Ok(self.accounts.lock().expect("lock accounts").clone())
    }

    async fn create_financial_account(
        &self,
        draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError> {
        let mut accounts = self.accounts.lock().expect("lock accounts");
        let now = Utc::now();
        let account = FinancialAccount {
            id: format!("00000000-0000-7000-9000-{:012}", accounts.len() + 1),
            name: draft.name.clone(),
            account_type: draft.account_type.clone(),
            primary_currency_code: draft.primary_currency_code.clone(),
            display_order: i32::try_from(accounts.len()).expect("display order fits i32"),
            status: FinancialAccountStatus::Active,
            archived_at: None,
            created_at: now,
            updated_at: now,
        };
        accounts.push(account.clone());

        Ok(account)
    }

    async fn update_financial_account(
        &self,
        id: &str,
        draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError> {
        let mut accounts = self.accounts.lock().expect("lock accounts");
        let Some(account) = accounts.iter_mut().find(|account| account.id == id) else {
            return Err(ApiError::NotFound(format!(
                "Financial account {id} was not found"
            )));
        };

        account.name = draft.name.clone();
        account.account_type = draft.account_type.clone();
        account.primary_currency_code = draft.primary_currency_code.clone();
        account.updated_at = Utc::now();

        Ok(account.clone())
    }

    async fn archive_financial_account(&self, id: &str) -> Result<FinancialAccount, ApiError> {
        let mut accounts = self.accounts.lock().expect("lock accounts");
        let Some(account) = accounts.iter_mut().find(|account| account.id == id) else {
            return Err(ApiError::NotFound(format!(
                "Financial account {id} was not found"
            )));
        };

        account.status = FinancialAccountStatus::Archived;
        account.archived_at.get_or_insert_with(Utc::now);

        Ok(account.clone())
    }

    async fn restore_financial_account(&self, id: &str) -> Result<FinancialAccount, ApiError> {
        let mut accounts = self.accounts.lock().expect("lock accounts");
        let Some(account) = accounts.iter_mut().find(|account| account.id == id) else {
            return Err(ApiError::NotFound(format!(
                "Financial account {id} was not found"
            )));
        };

        account.status = FinancialAccountStatus::Active;
        account.archived_at = None;

        Ok(account.clone())
    }

    async fn reorder_financial_accounts(
        &self,
        account_ids: &[String],
    ) -> Result<Vec<FinancialAccount>, ApiError> {
        let mut accounts = self.accounts.lock().expect("lock accounts");
        for account in accounts.iter_mut() {
            if let Some(position) = account_ids.iter().position(|id| *id == account.id) {
                account.display_order = i32::try_from(position).expect("position fits i32");
            }
        }
        accounts.sort_by_key(|account| account.display_order);

        Ok(accounts.clone())
    }
}

#[async_trait::async_trait]
impl FinanceDataStore for FakeFinanceStore {
    async fn list_transactions(
        &self,
        query: &TransactionsQuery,
    ) -> Result<TransactionListResponse, ApiError> {
        let transactions = self
            .transactions
            .lock()
            .expect("lock transactions")
            .iter()
            .filter(|transaction| {
                transaction.transaction_date >= query.start_inclusive
                    && transaction.transaction_date < query.end_exclusive
            })
            .cloned()
            .collect::<Vec<_>>();

        Ok(summarize(query, transactions))
    }

    async fn create_transaction(
        &self,
        draft: &TransactionDraft,
    ) -> Result<TransactionResponse, ApiError> {
        let now = Utc::now();
        let transaction = TransactionResponse {
            id: format!(
                "00000000-0000-7000-8000-{:012}",
                self.transactions.lock().expect("lock").len() + 1
            ),
            direction: draft.direction.clone(),
            transaction_date: draft.transaction_date,
            amount: format_amount_minor_units(draft.amount_minor_units),
            currency_code: "EUR".to_string(),
            description: draft.description.clone(),
            category: draft.category.clone(),
            note: draft.note.clone(),
            financial_account_id: draft.financial_account_id.clone(),
            financial_account_name: "Test account".to_string(),
            created_at: now,
            updated_at: now,
        };
        self.transactions
            .lock()
            .expect("lock transactions")
            .push(transaction.clone());

        Ok(transaction)
    }

    async fn update_transaction(
        &self,
        id: &str,
        draft: &TransactionDraft,
    ) -> Result<TransactionResponse, ApiError> {
        let mut transactions = self.transactions.lock().expect("lock transactions");
        let Some(transaction) = transactions
            .iter_mut()
            .find(|transaction| transaction.id == id)
        else {
            return Err(ApiError::NotFound(format!(
                "Finance transaction {id} was not found"
            )));
        };

        transaction.direction = draft.direction.clone();
        transaction.transaction_date = draft.transaction_date;
        transaction.amount = format_amount_minor_units(draft.amount_minor_units);
        transaction.description = draft.description.clone();
        transaction.category = draft.category.clone();
        transaction.note = draft.note.clone();
        transaction.financial_account_id = draft.financial_account_id.clone();
        transaction.updated_at = Utc::now();

        Ok(transaction.clone())
    }

    async fn delete_transaction(&self, id: &str) -> Result<(), ApiError> {
        let mut transactions = self.transactions.lock().expect("lock transactions");
        let old_len = transactions.len();
        transactions.retain(|transaction| transaction.id != id);

        if old_len == transactions.len() {
            return Err(ApiError::NotFound(format!(
                "Finance transaction {id} was not found"
            )));
        }

        Ok(())
    }
}

struct FakeWeatherFetcher;

#[async_trait::async_trait]
impl WeatherDataFetcher for FakeWeatherFetcher {
    async fn fetch_weather_snapshot(
        &self,
        _location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
        Err(ApiError::Internal(
            "weather fetcher should not be called by finance tests".to_string(),
        ))
    }

    async fn fetch_hourly_forecast(
        &self,
        _location: &WeatherLocationQuery,
        _hours_past: u16,
        _hours_future: u16,
    ) -> Result<WeatherForecastResponse, ApiError> {
        Err(ApiError::Internal(
            "weather fetcher should not be called by finance tests".to_string(),
        ))
    }
}

struct FakeWeatherStore;

#[async_trait::async_trait]
impl WeatherDataStore for FakeWeatherStore {
    async fn upsert_current_snapshot(
        &self,
        _snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
        Ok(())
    }

    async fn upsert_hourly_forecast(
        &self,
        _forecast: &WeatherForecastResponse,
    ) -> Result<(), ApiError> {
        Ok(())
    }

    async fn load_current_snapshot(
        &self,
        _location: &WeatherLocationQuery,
    ) -> Result<Option<WeatherSnapshotResponse>, ApiError> {
        Ok(None)
    }

    async fn load_hourly_forecast_snapshot(
        &self,
        _location: &WeatherLocationQuery,
        _start_inclusive: DateTime<Utc>,
        _end_inclusive: DateTime<Utc>,
    ) -> Result<Option<WeatherForecastResponse>, ApiError> {
        Ok(None)
    }

    async fn load_hourly_forecast_range(
        &self,
        _location: &WeatherLocationQuery,
        _start_inclusive: DateTime<Utc>,
        _end_inclusive: DateTime<Utc>,
    ) -> Result<Vec<HourlyWeatherPayload>, ApiError> {
        Ok(vec![])
    }
}

async fn spawn_http_server(context: Context) -> String {
    let app = crate::http::build_router(context);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind test listener");
    let address = listener.local_addr().expect("listener local addr");

    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("run test server");
    });

    format!("http://{address}")
}

fn test_context() -> Context {
    let finance_store = Arc::new(FakeFinanceStore::default());
    Context {
        config: Arc::new(Config {
            port: 0,
            database_url: "postgres://example".to_string(),
            cors_allow_origin: "*".to_string(),
            weather_config: None,
        }),
        finance_service: FinanceService::new(finance_store.clone(), finance_store),
        weather_service: WeatherService::new(
            Arc::new(FakeWeatherFetcher),
            Arc::new(FakeWeatherStore),
        ),
    }
}

#[tokio::test]
async fn create_and_list_transactions_returns_summary() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();

    let create_response = client
        .post(format!("{base_url}/api/v1/finance/transactions"))
        .json(&serde_json::json!({
            "direction": "income",
            "transactionDate": "2026-05-05",
            "amount": "123.45",
            "description": "Salary",
            "category": "Work",
            "financialAccountId": "00000000-0000-7000-9000-000000000001"
        }))
        .send()
        .await
        .expect("create transaction");

    assert_eq!(create_response.status(), StatusCode::CREATED);

    let list_response = client
        .get(format!(
            "{base_url}/api/v1/finance/transactions?from=2026-05-01&to=2026-05-31"
        ))
        .send()
        .await
        .expect("list transactions");

    assert_eq!(list_response.status(), StatusCode::OK);
    let payload: serde_json::Value = list_response.json().await.expect("json payload");
    assert_eq!(payload["transactions"].as_array().map(Vec::len), Some(1));
    assert_eq!(payload["summary"]["incomeTotal"]["amount"], "123.45");
    assert_eq!(payload["summary"]["expenseTotal"]["amount"], "0.00");
    assert_eq!(payload["summary"]["netTotal"]["amount"], "123.45");
}

#[tokio::test]
async fn invalid_amount_returns_bad_request() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{base_url}/api/v1/finance/transactions"))
        .json(&serde_json::json!({
            "direction": "expense",
            "transactionDate": "2026-05-05",
            "amount": "12.345",
            "description": "Groceries",
            "financialAccountId": "00000000-0000-7000-9000-000000000001"
        }))
        .send()
        .await
        .expect("create transaction");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn missing_delete_target_returns_not_found() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();

    let response = client
        .delete(format!(
            "{base_url}/api/v1/finance/transactions/00000000-0000-7000-8000-000000000404"
        ))
        .send()
        .await
        .expect("delete missing transaction");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn list_financial_accounts_returns_empty_list() {
    let base_url = spawn_http_server(test_context()).await;

    let response = reqwest::get(format!("{base_url}/api/v1/finance/accounts"))
        .await
        .expect("list accounts");

    assert_eq!(response.status(), StatusCode::OK);
    let payload: serde_json::Value = response.json().await.expect("json payload");
    assert_eq!(payload, serde_json::json!({ "accounts": [] }));
}

#[tokio::test]
async fn create_financial_account_returns_created_account_and_lists_it() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();

    let create_response = client
        .post(format!("{base_url}/api/v1/finance/accounts"))
        .json(&serde_json::json!({
            "name": " Depot ",
            "accountType": "investment",
            "primaryCurrencyCode": "EUR"
        }))
        .send()
        .await
        .expect("create account");

    assert_eq!(create_response.status(), StatusCode::CREATED);
    let created: serde_json::Value = create_response.json().await.expect("json payload");
    assert_eq!(created["name"], "Depot");
    assert_eq!(created["accountType"], "investment");
    assert_eq!(created["primaryCurrencyCode"], "EUR");
    assert_eq!(created["status"], "active");
    assert_eq!(created["displayOrder"], 0);
    assert_eq!(created["archivedAt"], serde_json::Value::Null);

    let list: serde_json::Value = client
        .get(format!("{base_url}/api/v1/finance/accounts"))
        .send()
        .await
        .expect("list accounts")
        .json()
        .await
        .expect("json payload");
    assert_eq!(list["accounts"], serde_json::json!([created]));
}

#[tokio::test]
async fn create_financial_account_with_invalid_input_returns_bad_request() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();

    for body in [
        serde_json::json!({ "name": "", "accountType": "cash", "primaryCurrencyCode": "EUR" }),
        serde_json::json!({ "name": "Wallet", "accountType": "savings", "primaryCurrencyCode": "EUR" }),
        serde_json::json!({ "name": "Wallet", "accountType": "cash", "primaryCurrencyCode": "eur" }),
    ] {
        let response = client
            .post(format!("{base_url}/api/v1/finance/accounts"))
            .json(&body)
            .send()
            .await
            .expect("create account");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{body}");
        let payload: serde_json::Value = response.json().await.expect("json payload");
        assert_eq!(payload["error"]["code"], "bad_request", "{body}");
    }
}

async fn create_test_account(client: &reqwest::Client, base_url: &str) -> serde_json::Value {
    client
        .post(format!("{base_url}/api/v1/finance/accounts"))
        .json(&serde_json::json!({
            "name": "Wallet",
            "accountType": "cash",
            "primaryCurrencyCode": "EUR"
        }))
        .send()
        .await
        .expect("create account")
        .json()
        .await
        .expect("json payload")
}

#[tokio::test]
async fn update_financial_account_returns_updated_account() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();
    let created = create_test_account(&client, &base_url).await;

    let response = client
        .put(format!(
            "{base_url}/api/v1/finance/accounts/{}",
            created["id"].as_str().expect("account id")
        ))
        .json(&serde_json::json!({
            "name": "Travel wallet",
            "accountType": "credit",
            "primaryCurrencyCode": "USD"
        }))
        .send()
        .await
        .expect("update account");

    assert_eq!(response.status(), StatusCode::OK);
    let updated: serde_json::Value = response.json().await.expect("json payload");
    assert_eq!(updated["id"], created["id"]);
    assert_eq!(updated["name"], "Travel wallet");
    assert_eq!(updated["accountType"], "credit");
    assert_eq!(updated["primaryCurrencyCode"], "USD");
}

#[tokio::test]
async fn update_financial_account_with_invalid_input_returns_bad_request() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();
    let created = create_test_account(&client, &base_url).await;

    let response = client
        .put(format!(
            "{base_url}/api/v1/finance/accounts/{}",
            created["id"].as_str().expect("account id")
        ))
        .json(&serde_json::json!({ "name": "Wallet", "accountType": "cash", "primaryCurrencyCode": "euro" }))
        .send()
        .await
        .expect("update account");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn update_unknown_financial_account_returns_not_found() {
    let base_url = spawn_http_server(test_context()).await;

    let response = reqwest::Client::new()
        .put(format!(
            "{base_url}/api/v1/finance/accounts/00000000-0000-7000-9000-000000000404"
        ))
        .json(&serde_json::json!({ "name": "Wallet", "accountType": "cash", "primaryCurrencyCode": "EUR" }))
        .send()
        .await
        .expect("update account");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[test]
fn conflict_maps_to_409() {
    let error = ApiError::Conflict("conflict".to_string());

    assert_eq!(error.status_code(), StatusCode::CONFLICT);
    assert_eq!(error.code(), "conflict");
}

#[tokio::test]
async fn archive_and_restore_financial_account_return_the_account() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();
    let created = create_test_account(&client, &base_url).await;
    let account_url = format!(
        "{base_url}/api/v1/finance/accounts/{}",
        created["id"].as_str().expect("account id")
    );

    let archive_response = client
        .post(format!("{account_url}/archive"))
        .send()
        .await
        .expect("archive account");

    assert_eq!(archive_response.status(), StatusCode::OK);
    let archived: serde_json::Value = archive_response.json().await.expect("json payload");
    assert_eq!(archived["status"], "archived");
    assert!(archived["archivedAt"].is_string());

    let restore_response = client
        .post(format!("{account_url}/restore"))
        .send()
        .await
        .expect("restore account");

    assert_eq!(restore_response.status(), StatusCode::OK);
    let restored: serde_json::Value = restore_response.json().await.expect("json payload");
    assert_eq!(restored["status"], "active");
    assert_eq!(restored["archivedAt"], serde_json::Value::Null);
}

#[tokio::test]
async fn archive_and_restore_unknown_financial_account_return_not_found() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();

    for action in ["archive", "restore"] {
        let response = client
            .post(format!(
                "{base_url}/api/v1/finance/accounts/00000000-0000-7000-9000-000000000404/{action}"
            ))
            .send()
            .await
            .expect("post account action");

        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{action}");
    }
}

#[tokio::test]
async fn reorder_financial_accounts_returns_accounts_in_new_order() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();
    let first = create_test_account(&client, &base_url).await;
    let second = create_test_account(&client, &base_url).await;

    let response = client
        .put(format!("{base_url}/api/v1/finance/accounts/order"))
        .json(&serde_json::json!({ "accountIds": [second["id"], first["id"]] }))
        .send()
        .await
        .expect("reorder accounts");

    assert_eq!(response.status(), StatusCode::OK);
    let payload: serde_json::Value = response.json().await.expect("json payload");
    let ids = payload["accounts"]
        .as_array()
        .expect("accounts array")
        .iter()
        .map(|account| account["id"].clone())
        .collect::<Vec<_>>();
    assert_eq!(ids, [second["id"].clone(), first["id"].clone()]);
}

#[tokio::test]
async fn reorder_financial_accounts_with_duplicates_returns_bad_request() {
    let base_url = spawn_http_server(test_context()).await;
    let client = reqwest::Client::new();
    let account = create_test_account(&client, &base_url).await;

    let response = client
        .put(format!("{base_url}/api/v1/finance/accounts/order"))
        .json(&serde_json::json!({ "accountIds": [account["id"], account["id"]] }))
        .send()
        .await
        .expect("reorder accounts");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn create_transaction_without_financial_account_returns_bad_request() {
    let base_url = spawn_http_server(test_context()).await;

    let response = reqwest::Client::new()
        .post(format!("{base_url}/api/v1/finance/transactions"))
        .json(&serde_json::json!({
            "direction": "expense",
            "transactionDate": "2026-05-05",
            "amount": "12.30",
            "description": "Groceries"
        }))
        .send()
        .await
        .expect("create transaction");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let payload: serde_json::Value = response.json().await.expect("json payload");
    assert_eq!(
        payload["error"]["message"],
        "Missing required field: financialAccountId"
    );
}
