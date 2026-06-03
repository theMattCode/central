use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use reqwest::StatusCode;

use crate::domains::finance::contracts::FinanceDataStore;
use crate::domains::finance::model::{
  format_amount_minor_units, summarize, TransactionDraft, TransactionListResponse,
  TransactionResponse, TransactionsQuery,
};
use crate::domains::finance::service::FinanceService;
use crate::domains::weather::contracts::{WeatherDataFetcher, WeatherDataStore};
use crate::domains::weather::model::{
  HourlyWeatherPayload, WeatherForecastResponse, WeatherLocationQuery,
  WeatherSnapshotResponse,
};
use crate::domains::weather::service::WeatherService;
use crate::{
  config::Config,
  context::Context,
  error::ApiError,
};

#[derive(Default)]
struct FakeFinanceStore {
  transactions: Mutex<Vec<TransactionResponse>>,
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
  Context {
    config: Arc::new(Config {
      port: 0,
      database_url: "postgres://example".to_string(),
      cors_allow_origin: "*".to_string(),
      weather_config: None,
    }),
    finance_service: FinanceService::new(Arc::new(FakeFinanceStore::default())),
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
            "category": "Work"
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
            "description": "Groceries"
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
