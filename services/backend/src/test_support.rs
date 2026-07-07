use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, Utc};

use crate::config::{Config, WeatherConfig};
use crate::context::Context;
use crate::domains::finance::contracts::FinanceDataStore;
use crate::domains::finance::model::{
  format_amount_minor_units, summarize, FinancialAccountDraft, FinancialAccountListResponse, FinancialAccountResponse,
  FinancialAccountStatus, TransactionDraft, TransactionListResponse, TransactionResponse, TransactionsQuery,
};
use crate::domains::finance::service::FinanceService;
use crate::domains::weather::contracts::{WeatherDataFetcher, WeatherDataStore};
use crate::domains::weather::model::{
  HourlyWeatherPayload, WeatherForecastResponse, WeatherLocationQuery, WeatherSnapshotResponse,
};
use crate::domains::weather::service::WeatherService;
use crate::error::ApiError;

#[derive(Default)]
pub(crate) struct InMemoryFinanceStore {
  accounts: Mutex<Vec<FinancialAccountResponse>>,
  transactions: Mutex<Vec<TransactionResponse>>,
}

#[async_trait::async_trait]
impl FinanceDataStore for InMemoryFinanceStore {
  async fn list_financial_accounts(&self) -> Result<FinancialAccountListResponse, ApiError> {
    Ok(FinancialAccountListResponse {
      accounts: self.accounts.lock().expect("lock accounts").clone(),
    })
  }

  async fn create_financial_account(
    &self,
    draft: &FinancialAccountDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    let now = Utc::now();
    let account = FinancialAccountResponse {
      id: format!(
        "00000000-0000-7000-9000-{:012}",
        self.accounts.lock().expect("lock accounts").len() + 1
      ),
      name: draft.name.clone(),
      account_type: draft.account_type.clone(),
      primary_currency_code: draft.primary_currency_code.clone(),
      display_order: draft.display_order,
      status: FinancialAccountStatus::Active,
      archived_at: None,
      created_at: now,
      updated_at: now,
    };
    self.accounts.lock().expect("lock accounts").push(account.clone());

    Ok(account)
  }

  async fn update_financial_account(
    &self,
    id: &str,
    draft: &FinancialAccountDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    let mut accounts = self.accounts.lock().expect("lock accounts");
    let Some(account) = accounts.iter_mut().find(|account| account.id == id) else {
      return Err(ApiError::NotFound(format!("Financial account {id} was not found")));
    };

    account.name = draft.name.clone();
    account.account_type = draft.account_type.clone();
    account.primary_currency_code = draft.primary_currency_code.clone();
    account.display_order = draft.display_order;
    account.updated_at = Utc::now();

    Ok(account.clone())
  }

  async fn archive_financial_account(&self, id: &str) -> Result<FinancialAccountResponse, ApiError> {
    let mut accounts = self.accounts.lock().expect("lock accounts");
    let Some(account) = accounts.iter_mut().find(|account| account.id == id) else {
      return Err(ApiError::NotFound(format!("Financial account {id} was not found")));
    };

    account.status = FinancialAccountStatus::Archived;
    account.archived_at = Some(Utc::now());
    account.updated_at = Utc::now();

    Ok(account.clone())
  }

  async fn list_transactions(&self, query: &TransactionsQuery) -> Result<TransactionListResponse, ApiError> {
    let transactions = self
      .transactions
      .lock()
      .expect("lock transactions")
      .iter()
      .filter(|transaction| {
        transaction.transaction_date >= query.start_inclusive && transaction.transaction_date < query.end_exclusive
      })
      .cloned()
      .collect::<Vec<_>>();

    Ok(summarize(query, transactions))
  }

  async fn create_transaction(&self, draft: &TransactionDraft) -> Result<TransactionResponse, ApiError> {
    let now = Utc::now();
    let transaction = TransactionResponse {
      id: format!(
        "00000000-0000-7000-8000-{:012}",
        self.transactions.lock().expect("lock transactions").len() + 1
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
    self
      .transactions
      .lock()
      .expect("lock transactions")
      .push(transaction.clone());

    Ok(transaction)
  }

  async fn update_transaction(&self, id: &str, draft: &TransactionDraft) -> Result<TransactionResponse, ApiError> {
    let mut transactions = self.transactions.lock().expect("lock transactions");
    let Some(transaction) = transactions.iter_mut().find(|transaction| transaction.id == id) else {
      return Err(ApiError::NotFound(format!("Finance transaction {id} was not found")));
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
      return Err(ApiError::NotFound(format!("Finance transaction {id} was not found")));
    }

    Ok(())
  }
}

struct FailingFinanceStore {
  label: &'static str,
}

#[async_trait::async_trait]
impl FinanceDataStore for FailingFinanceStore {
  async fn list_financial_accounts(&self) -> Result<FinancialAccountListResponse, ApiError> {
    Err(unexpected_call(self.label, "finance store"))
  }

  async fn create_financial_account(
    &self,
    _draft: &FinancialAccountDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    Err(unexpected_call(self.label, "finance store"))
  }

  async fn update_financial_account(
    &self,
    _id: &str,
    _draft: &FinancialAccountDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    Err(unexpected_call(self.label, "finance store"))
  }

  async fn archive_financial_account(&self, _id: &str) -> Result<FinancialAccountResponse, ApiError> {
    Err(unexpected_call(self.label, "finance store"))
  }

  async fn list_transactions(&self, _month: &TransactionsQuery) -> Result<TransactionListResponse, ApiError> {
    Err(unexpected_call(self.label, "finance store"))
  }

  async fn create_transaction(&self, _draft: &TransactionDraft) -> Result<TransactionResponse, ApiError> {
    Err(unexpected_call(self.label, "finance store"))
  }

  async fn update_transaction(&self, _id: &str, _draft: &TransactionDraft) -> Result<TransactionResponse, ApiError> {
    Err(unexpected_call(self.label, "finance store"))
  }

  async fn delete_transaction(&self, _id: &str) -> Result<(), ApiError> {
    Err(unexpected_call(self.label, "finance store"))
  }
}

struct FailingWeatherFetcher {
  label: &'static str,
}

#[async_trait::async_trait]
impl WeatherDataFetcher for FailingWeatherFetcher {
  async fn fetch_weather_snapshot(
    &self,
    _location: &WeatherLocationQuery,
  ) -> Result<WeatherSnapshotResponse, ApiError> {
    Err(unexpected_call(self.label, "weather fetcher"))
  }

  async fn fetch_hourly_forecast(
    &self,
    _location: &WeatherLocationQuery,
    _hours_past: u16,
    _hours_future: u16,
  ) -> Result<WeatherForecastResponse, ApiError> {
    Err(unexpected_call(self.label, "weather fetcher"))
  }
}

struct FailingWeatherStore {
  label: &'static str,
}

#[async_trait::async_trait]
impl WeatherDataStore for FailingWeatherStore {
  async fn upsert_current_snapshot(&self, _snapshot: &WeatherSnapshotResponse) -> Result<(), ApiError> {
    Err(unexpected_call(self.label, "weather store"))
  }

  async fn upsert_hourly_forecast(&self, _forecast: &WeatherForecastResponse) -> Result<(), ApiError> {
    Err(unexpected_call(self.label, "weather store"))
  }

  async fn load_current_snapshot(
    &self,
    _location: &WeatherLocationQuery,
  ) -> Result<Option<WeatherSnapshotResponse>, ApiError> {
    Err(unexpected_call(self.label, "weather store"))
  }

  async fn load_hourly_forecast_snapshot(
    &self,
    _location: &WeatherLocationQuery,
    _start_inclusive: DateTime<Utc>,
    _end_inclusive: DateTime<Utc>,
  ) -> Result<Option<WeatherForecastResponse>, ApiError> {
    Err(unexpected_call(self.label, "weather store"))
  }

  async fn load_hourly_forecast_range(
    &self,
    _location: &WeatherLocationQuery,
    _start_inclusive: DateTime<Utc>,
    _end_inclusive: DateTime<Utc>,
  ) -> Result<Vec<HourlyWeatherPayload>, ApiError> {
    Err(unexpected_call(self.label, "weather store"))
  }
}

pub(crate) struct TestContextBuilder {
  config: Arc<Config>,
  finance_service: FinanceService,
  weather_service: WeatherService,
}

impl TestContextBuilder {
  pub(crate) fn new(label: &'static str) -> Self {
    Self {
      config: test_config(),
      finance_service: failing_finance_service(label),
      weather_service: inert_weather_service(label),
    }
  }

  pub(crate) fn with_finance_service(mut self, finance_service: FinanceService) -> Self {
    self.finance_service = finance_service;
    self
  }

  pub(crate) fn with_weather_service(mut self, weather_service: WeatherService) -> Self {
    self.weather_service = weather_service;
    self
  }

  pub(crate) fn build(self) -> Context {
    Context {
      config: self.config,
      finance_service: self.finance_service,
      weather_service: self.weather_service,
    }
  }
}

pub(crate) fn in_memory_finance_service() -> FinanceService {
  FinanceService::new(Arc::new(InMemoryFinanceStore::default()))
}

pub(crate) fn failing_finance_service(label: &'static str) -> FinanceService {
  FinanceService::new(Arc::new(FailingFinanceStore { label }))
}

pub(crate) fn inert_weather_service(label: &'static str) -> WeatherService {
  WeatherService::new(
    Arc::new(FailingWeatherFetcher { label }),
    Arc::new(FailingWeatherStore { label }),
  )
}

fn test_config() -> Arc<Config> {
  Arc::new(Config {
    port: 0,
    database_url: "postgres://example".to_string(),
    cors_allow_origin: "*".to_string(),
    weather_config: Some(WeatherConfig {
      open_meteo_base_url: "http://example.test".to_string(),
      refresh_interval: Duration::from_secs(900),
      request_timeout: Duration::from_secs(5),
    }),
  })
}

fn unexpected_call(label: &'static str, dependency: &'static str) -> ApiError {
  ApiError::Internal(format!("{dependency} should not be called by {label} tests"))
}
