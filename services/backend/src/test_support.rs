use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};

use crate::config::{Config, WeatherConfig};
use crate::context::Context;
use crate::domains::finance::repository::FinanceRepository;
use crate::domains::finance::service::FinanceService;
use crate::domains::weather::contracts::{WeatherDataFetcher, WeatherDataStore};
use crate::domains::weather::model::{
  HourlyWeatherPayload, WeatherForecastResponse, WeatherLocationQuery, WeatherSnapshotResponse,
};
use crate::domains::weather::service::WeatherService;
use crate::error::ApiError;

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
      weather_service: failing_weather_service(label),
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

pub(crate) fn failing_finance_service(label: &'static str) -> FinanceService {
  FinanceService::new(Arc::new(FinanceRepository::failing(label)))
}

pub(crate) fn failing_weather_service(label: &'static str) -> WeatherService {
  WeatherService::new(
    Arc::new(FailingWeatherFetcher { label }),
    Arc::new(FailingWeatherStore { label }),
  )
}

pub(crate) async fn spawn_http_server(context: Context) -> String {
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
