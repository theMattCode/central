use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};

use crate::{
    domain::{
      contracts::{WeatherDataFetcher, WeatherDataStore},
        model::{
          CurrentWeatherPayload, HourlyWeatherPayload, WeatherForecastMetaPayload,
          WeatherForecastResponse, WeatherLocationPayload, WeatherLocationQuery,
            WeatherMetaPayload, WeatherSnapshotResponse,
        },
        service::WeatherSnapshotService,
    },
    error::ApiError,
};

type ForecastLoadCall = (WeatherLocationQuery, DateTime<Utc>, DateTime<Utc>);

#[derive(Clone)]
struct FakeFetcher {
    snapshot: Option<WeatherSnapshotResponse>,
  forecast: Option<WeatherForecastResponse>,
  snapshot_error_message: Option<String>,
  forecast_error_message: Option<String>,
  snapshot_calls: Arc<Mutex<Vec<WeatherLocationQuery>>>,
  forecast_calls: Arc<Mutex<Vec<(WeatherLocationQuery, u16, u16)>>>,
}

#[async_trait::async_trait]
impl WeatherDataFetcher for FakeFetcher {
    async fn fetch_weather_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
      self.snapshot_calls
            .lock()
        .expect("lock fetcher snapshot calls")
            .push(location.clone());

      if let Some(message) = &self.snapshot_error_message {
            return Err(ApiError::Upstream(message.clone()));
        }

        self.snapshot
            .clone()
            .ok_or_else(|| ApiError::Internal("missing fake snapshot".to_string()))
    }

  async fn fetch_hourly_forecast(
    &self,
    location: &WeatherLocationQuery,
    hours_past: u16,
    hours_future: u16,
  ) -> Result<WeatherForecastResponse, ApiError> {
    self.forecast_calls
      .lock()
      .expect("lock fetcher forecast calls")
      .push((location.clone(), hours_past, hours_future));

    if let Some(message) = &self.forecast_error_message {
      return Err(ApiError::Upstream(message.clone()));
    }

    self.forecast
      .clone()
      .ok_or_else(|| ApiError::Internal("missing fake forecast".to_string()))
  }
}

#[derive(Clone)]
struct FakeStore {
  current_fail_message: Option<String>,
  forecast_fail_message: Option<String>,
  load_fail_message: Option<String>,
  cached_current: Arc<Mutex<Option<WeatherSnapshotResponse>>>,
  cached_forecast: Arc<Mutex<Option<WeatherForecastResponse>>>,
  current_calls: Arc<Mutex<Vec<WeatherSnapshotResponse>>>,
  forecast_calls: Arc<Mutex<Vec<WeatherForecastResponse>>>,
  load_calls: Arc<Mutex<Vec<ForecastLoadCall>>>,
  load_result: Arc<Mutex<Vec<HourlyWeatherPayload>>>,
}

#[async_trait::async_trait]
impl WeatherDataStore for FakeStore {
    async fn upsert_current_snapshot(
        &self,
        snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
      self.current_calls
            .lock()
        .expect("lock current store calls")
            .push(snapshot.clone());

      if let Some(message) = &self.current_fail_message {
            return Err(ApiError::Internal(message.clone()));
        }

        Ok(())
    }

  async fn upsert_hourly_forecast(
    &self,
    forecast: &WeatherForecastResponse,
  ) -> Result<(), ApiError> {
    self.forecast_calls
      .lock()
      .expect("lock forecast store calls")
      .push(forecast.clone());

    if let Some(message) = &self.forecast_fail_message {
      return Err(ApiError::Internal(message.clone()));
    }

    Ok(())
  }

  async fn load_current_snapshot(
    &self,
    _location: &WeatherLocationQuery,
  ) -> Result<Option<WeatherSnapshotResponse>, ApiError> {
    Ok(self
      .cached_current
      .lock()
      .expect("lock cached current")
      .clone())
  }

  async fn load_hourly_forecast_snapshot(
    &self,
    _location: &WeatherLocationQuery,
    _start_inclusive: DateTime<Utc>,
    _end_inclusive: DateTime<Utc>,
  ) -> Result<Option<WeatherForecastResponse>, ApiError> {
    Ok(self
      .cached_forecast
      .lock()
      .expect("lock cached forecast")
      .clone())
  }

  #[cfg(test)]
  async fn load_hourly_forecast_range(
    &self,
    location: &WeatherLocationQuery,
    start_inclusive: DateTime<Utc>,
    end_inclusive: DateTime<Utc>,
  ) -> Result<Vec<HourlyWeatherPayload>, ApiError> {
    self.load_calls
      .lock()
      .expect("lock forecast load calls")
      .push((location.clone(), start_inclusive, end_inclusive));

    if let Some(message) = &self.load_fail_message {
      return Err(ApiError::Internal(message.clone()));
    }

    Ok(self
      .load_result
      .lock()
      .expect("lock load result")
      .clone())
  }
}

fn test_location() -> WeatherLocationQuery {
    WeatherLocationQuery {
        latitude: 48.4057,
        longitude: 9.0542,
        timezone: "Europe/Berlin".to_string(),
    }
}

fn test_snapshot(weather_code: i32) -> WeatherSnapshotResponse {
    WeatherSnapshotResponse {
        location: WeatherLocationPayload {
            latitude: 48.4057,
            longitude: 9.0542,
            timezone: "Europe/Berlin".to_string(),
        },
        current: CurrentWeatherPayload {
            weather_code,
            temperature_c: 8.0,
            temperature_apparent_c: 6.0,
            is_day: true,
            precipitation: 0.2,
            wind_speed: 11.0,
            wind_direction: 135.0,
            relative_humidity: 70.0,
            pressure: 1015.0,
            cloud_cover: 42.0,
        },
        meta: WeatherMetaPayload {
            provider: "open-meteo".to_string(),
            model: "dwd-icon".to_string(),
            fetched_at: Utc::now(),
            source_time: "2026-03-09T10:00".to_string(),
        },
    }
}

fn test_snapshot_with_fetched_at(
  weather_code: i32,
  fetched_at: DateTime<Utc>,
) -> WeatherSnapshotResponse {
  let mut snapshot = test_snapshot(weather_code);
  snapshot.meta.fetched_at = fetched_at;
  snapshot
}

fn test_hourly_payload(forecast_at: &str, weather_code: i32) -> HourlyWeatherPayload {
  HourlyWeatherPayload {
    forecast_at: DateTime::parse_from_rfc3339(forecast_at)
      .expect("parse forecast timestamp")
      .with_timezone(&Utc),
    weather_code,
    temperature_c: 8.0,
    temperature_apparent_c: 6.0,
    is_day: true,
    precipitation_mm: 0.4,
    rain_mm: 0.3,
    snowfall_cm: 0.0,
    relative_humidity_pct: 68.0,
    wind_speed_kmh: 14.0,
    wind_gusts_kmh: 21.0,
    wind_direction_deg: 140.0,
    pressure_msl_hpa: 1014.0,
    cloud_cover_pct: 55.0,
  }
}

fn test_forecast() -> WeatherForecastResponse {
  WeatherForecastResponse {
    location: WeatherLocationPayload {
      latitude: 48.4057,
      longitude: 9.0542,
      timezone: "Europe/Berlin".to_string(),
    },
    hourly: vec![
      test_hourly_payload("2026-03-09T10:00:00Z", 2),
      test_hourly_payload("2026-03-09T11:00:00Z", 3),
    ],
    meta: WeatherForecastMetaPayload {
      provider: "open-meteo".to_string(),
      model: "dwd-icon".to_string(),
      fetched_at: Utc::now(),
    },
  }
}

fn test_forecast_with_fetched_at(
  hourly: Vec<HourlyWeatherPayload>,
  fetched_at: DateTime<Utc>,
) -> WeatherForecastResponse {
  WeatherForecastResponse {
    location: WeatherLocationPayload {
      latitude: 48.4057,
      longitude: 9.0542,
      timezone: "Europe/Berlin".to_string(),
    },
    hourly,
    meta: WeatherForecastMetaPayload {
      provider: "open-meteo".to_string(),
      model: "dwd-icon".to_string(),
      fetched_at,
    },
  }
}

fn fake_store(load_result: Vec<HourlyWeatherPayload>) -> FakeStore {
  FakeStore {
    current_fail_message: None,
    forecast_fail_message: None,
    load_fail_message: None,
    cached_current: Arc::new(Mutex::new(None)),
    cached_forecast: Arc::new(Mutex::new(None)),
    current_calls: Arc::new(Mutex::new(Vec::new())),
    forecast_calls: Arc::new(Mutex::new(Vec::new())),
    load_calls: Arc::new(Mutex::new(Vec::new())),
    load_result: Arc::new(Mutex::new(load_result)),
  }
}

#[tokio::test]
async fn get_current_snapshot_uses_fresh_cached_snapshot() {
  let fetcher_snapshot_calls = Arc::new(Mutex::new(Vec::new()));
  let fetcher_forecast_calls = Arc::new(Mutex::new(Vec::new()));
  let store = fake_store(Vec::new());
  *store.cached_current.lock().expect("lock cached current") =
    Some(test_snapshot_with_fetched_at(71, Utc::now()));

  let service = WeatherSnapshotService::new(
    Arc::new(FakeFetcher {
      snapshot: Some(test_snapshot(3)),
      forecast: Some(test_forecast()),
      snapshot_error_message: None,
      forecast_error_message: None,
      snapshot_calls: Arc::clone(&fetcher_snapshot_calls),
      forecast_calls: Arc::clone(&fetcher_forecast_calls),
    }),
    Arc::new(store.clone()),
  );

  let snapshot = service
    .get_current_snapshot(&test_location())
    .await
    .expect("get current snapshot");

  assert_eq!(snapshot.current.weather_code, 71);
  assert_eq!(
    fetcher_snapshot_calls
      .lock()
      .expect("lock fetcher snapshot calls")
      .len(),
    0
  );
  assert_eq!(
    store
      .current_calls
      .lock()
      .expect("lock current store calls")
      .len(),
    0
  );
}

#[tokio::test]
async fn get_hourly_forecast_fetches_when_cached_data_is_stale() {
  let fetcher_snapshot_calls = Arc::new(Mutex::new(Vec::new()));
  let fetcher_forecast_calls = Arc::new(Mutex::new(Vec::new()));
  let store = fake_store(Vec::new());
  let stale_fetched_at = Utc::now() - chrono::Duration::minutes(30);
  *store.cached_forecast.lock().expect("lock cached forecast") = Some(
    test_forecast_with_fetched_at(
      vec![
        test_hourly_payload("2026-03-09T10:00:00Z", 1),
        test_hourly_payload("2026-03-09T11:00:00Z", 2),
      ],
      stale_fetched_at,
    ),
  );

  let service = WeatherSnapshotService::new(
    Arc::new(FakeFetcher {
      snapshot: Some(test_snapshot(3)),
      forecast: Some(test_forecast()),
      snapshot_error_message: None,
      forecast_error_message: None,
      snapshot_calls: Arc::clone(&fetcher_snapshot_calls),
      forecast_calls: Arc::clone(&fetcher_forecast_calls),
    }),
    Arc::new(store),
  );

  let forecast = service
    .get_hourly_forecast(&test_location(), 0, 1)
    .await
    .expect("get forecast");

  assert_eq!(forecast.hourly.len(), 2);
  assert_eq!(
    fetcher_snapshot_calls
      .lock()
      .expect("lock fetcher snapshot calls")
      .len(),
    0
  );
  assert_eq!(
    fetcher_forecast_calls
      .lock()
      .expect("lock fetcher forecast calls")
      .len(),
    1
  );
}

#[tokio::test]
async fn fetch_and_store_snapshot_persists_and_returns_snapshot() {
  let fetcher_snapshot_calls = Arc::new(Mutex::new(Vec::new()));
  let fetcher_forecast_calls = Arc::new(Mutex::new(Vec::new()));
  let store = fake_store(Vec::new());
    let expected_snapshot = test_snapshot(3);

    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: Some(expected_snapshot.clone()),
          forecast: Some(test_forecast()),
          snapshot_error_message: None,
          forecast_error_message: None,
          snapshot_calls: Arc::clone(&fetcher_snapshot_calls),
          forecast_calls: Arc::clone(&fetcher_forecast_calls),
        }),
        Arc::new(store.clone()),
    );

    let snapshot = service
        .fetch_and_store_snapshot(&test_location())
        .await
        .expect("fetch and store should succeed");

    assert_eq!(snapshot.current.weather_code, 3);
    assert_eq!(
      fetcher_snapshot_calls
        .lock()
        .expect("lock fetcher snapshot calls")
        .len(),
      1
    );
  assert_eq!(
    fetcher_forecast_calls
      .lock()
      .expect("lock fetcher forecast calls")
      .len(),
    0
  );
  assert_eq!(
    store
      .current_calls
      .lock()
      .expect("lock current store calls")
      .len(),
    1
    );
}

#[tokio::test]
async fn fetch_and_store_snapshot_propagates_fetch_error_without_persisting() {
  let fetcher_snapshot_calls = Arc::new(Mutex::new(Vec::new()));
  let fetcher_forecast_calls = Arc::new(Mutex::new(Vec::new()));
  let store = fake_store(Vec::new());

    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: None,
          forecast: Some(test_forecast()),
          snapshot_error_message: Some("upstream failed".to_string()),
          forecast_error_message: None,
          snapshot_calls: Arc::clone(&fetcher_snapshot_calls),
          forecast_calls: Arc::clone(&fetcher_forecast_calls),
        }),
        Arc::new(store.clone()),
    );

    let error = service
        .fetch_and_store_snapshot(&test_location())
        .await
        .expect_err("fetch should fail");

    match error {
        ApiError::Upstream(message) => assert!(message.contains("upstream failed")),
        other => panic!("expected upstream error, got {other:?}"),
    }
  assert_eq!(
    fetcher_snapshot_calls
      .lock()
      .expect("lock fetcher snapshot calls")
      .len(),
    1
  );
  assert_eq!(
    fetcher_forecast_calls
      .lock()
      .expect("lock fetcher forecast calls")
      .len(),
    0
  );
  assert_eq!(
    store
      .current_calls
      .lock()
      .expect("lock current store calls")
      .len(),
    0
  );
}

#[tokio::test]
async fn refresh_and_load_forecast_returns_db_range() {
  let fetcher_snapshot_calls = Arc::new(Mutex::new(Vec::new()));
  let fetcher_forecast_calls = Arc::new(Mutex::new(Vec::new()));
  let load_result = vec![
    test_hourly_payload("2026-03-08T10:00:00Z", 1),
    test_hourly_payload("2026-03-08T11:00:00Z", 2),
    test_hourly_payload("2026-03-08T12:00:00Z", 3),
  ];
  let store = fake_store(load_result.clone());

    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: Some(test_snapshot(2)),
          forecast: Some(test_forecast()),
          snapshot_error_message: None,
          forecast_error_message: None,
          snapshot_calls: Arc::clone(&fetcher_snapshot_calls),
          forecast_calls: Arc::clone(&fetcher_forecast_calls),
        }),
        Arc::new(store.clone()),
    );

  let response = service
    .refresh_and_load_forecast(&test_location(), 48, 240)
    .await
    .expect("refresh forecast should succeed");

  assert_eq!(
    fetcher_snapshot_calls
      .lock()
      .expect("lock fetcher snapshot calls")
      .len(),
    0
  );
  assert_eq!(
    fetcher_forecast_calls
      .lock()
      .expect("lock fetcher forecast calls")
      .len(),
    1
  );
  assert_eq!(
    store
      .forecast_calls
      .lock()
      .expect("lock forecast store calls")
      .len(),
    1
  );
  assert_eq!(
    store.load_calls.lock().expect("lock load calls").len(),
    1
  );
  assert_eq!(response.hourly.len(), load_result.len());
  assert_eq!(response.hourly[0].weather_code, 1);
  assert_eq!(response.hourly[2].weather_code, 3);
}

#[tokio::test]
async fn refresh_and_load_forecast_propagates_store_error() {
  let fetcher_snapshot_calls = Arc::new(Mutex::new(Vec::new()));
  let fetcher_forecast_calls = Arc::new(Mutex::new(Vec::new()));
  let mut store = fake_store(Vec::new());
  store.forecast_fail_message = Some("db write failed".to_string());

  let service = WeatherSnapshotService::new(
    Arc::new(FakeFetcher {
      snapshot: Some(test_snapshot(2)),
      forecast: Some(test_forecast()),
      snapshot_error_message: None,
      forecast_error_message: None,
      snapshot_calls: Arc::clone(&fetcher_snapshot_calls),
      forecast_calls: Arc::clone(&fetcher_forecast_calls),
        }),
    Arc::new(store.clone()),
    );

    let error = service
      .refresh_and_load_forecast(&test_location(), 12, 24)
        .await
      .expect_err("forecast store should fail");

    match error {
        ApiError::Internal(message) => assert!(message.contains("db write failed")),
        other => panic!("expected internal error, got {other:?}"),
    }
  assert_eq!(
    fetcher_forecast_calls
      .lock()
      .expect("lock fetcher forecast calls")
      .len(),
    1
  );
  assert_eq!(
    store
      .forecast_calls
      .lock()
      .expect("lock forecast store calls")
      .len(),
    1
  );
  assert_eq!(
    store.load_calls.lock().expect("lock load calls").len(),
    0
  );
  assert_eq!(
    fetcher_snapshot_calls
      .lock()
      .expect("lock fetcher snapshot calls")
      .len(),
    0
  );
}
