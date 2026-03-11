use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde_json::{json, Value};

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

use super::{process_request, tool_error_result, weather_tool_definition, JsonRpcRequest};

#[derive(Clone)]
struct FakeFetcher {
    snapshot: WeatherSnapshotResponse,
    forecast: WeatherForecastResponse,
    current_calls: Arc<AtomicUsize>,
    forecast_calls: Arc<AtomicUsize>,
}

#[async_trait::async_trait]
impl WeatherDataFetcher for FakeFetcher {
    async fn fetch_weather_snapshot(
        &self,
        _location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
        self.current_calls.fetch_add(1, Ordering::SeqCst);
        Ok(self.snapshot.clone())
    }

    async fn fetch_hourly_forecast(
        &self,
        _location: &WeatherLocationQuery,
        _hours_past: u16,
        _hours_future: u16,
    ) -> Result<WeatherForecastResponse, ApiError> {
        self.forecast_calls.fetch_add(1, Ordering::SeqCst);
        Ok(self.forecast.clone())
    }
}

#[derive(Clone)]
struct FakeStore {
    current_fail_message: Option<String>,
    forecast_fail_message: Option<String>,
    load_fail_message: Option<String>,
    current_calls: Arc<AtomicUsize>,
    forecast_calls: Arc<AtomicUsize>,
    load_calls: Arc<AtomicUsize>,
    loaded_forecast: Arc<Vec<HourlyWeatherPayload>>,
}

#[async_trait::async_trait]
impl WeatherDataStore for FakeStore {
    async fn upsert_current_snapshot(
        &self,
        _snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
        self.current_calls.fetch_add(1, Ordering::SeqCst);
        if let Some(message) = &self.current_fail_message {
            return Err(ApiError::Internal(message.clone()));
        }
        Ok(())
    }

    async fn upsert_hourly_forecast(
        &self,
        _forecast: &WeatherForecastResponse,
    ) -> Result<(), ApiError> {
        self.forecast_calls.fetch_add(1, Ordering::SeqCst);
        if let Some(message) = &self.forecast_fail_message {
            return Err(ApiError::Internal(message.clone()));
        }
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
        _start_inclusive: chrono::DateTime<chrono::Utc>,
        _end_inclusive: chrono::DateTime<chrono::Utc>,
    ) -> Result<Option<WeatherForecastResponse>, ApiError> {
        self.load_calls.fetch_add(1, Ordering::SeqCst);
        if let Some(message) = &self.load_fail_message {
            return Err(ApiError::Internal(message.clone()));
        }
        Ok(None)
    }

    async fn load_hourly_forecast_range(
        &self,
        _location: &WeatherLocationQuery,
        _start_inclusive: chrono::DateTime<chrono::Utc>,
        _end_inclusive: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<HourlyWeatherPayload>, ApiError> {
        self.load_calls.fetch_add(1, Ordering::SeqCst);
        if let Some(message) = &self.load_fail_message {
            return Err(ApiError::Internal(message.clone()));
        }
        Ok(self.loaded_forecast.as_ref().clone())
    }
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

fn test_forecast(hourly: Vec<HourlyWeatherPayload>) -> WeatherForecastResponse {
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
            fetched_at: Utc::now(),
        },
    }
}

fn test_snapshot() -> WeatherSnapshotResponse {
    WeatherSnapshotResponse {
        location: WeatherLocationPayload {
            latitude: 48.4057,
            longitude: 9.0542,
            timezone: "Europe/Berlin".to_string(),
        },
        current: CurrentWeatherPayload {
            weather_code: 0,
            temperature_c: 10.0,
            temperature_apparent_c: 9.0,
            is_day: true,
            precipitation: 0.0,
            wind_speed: 5.0,
            wind_direction: 180.0,
            relative_humidity: 55.0,
            pressure: 1013.0,
            cloud_cover: 20.0,
        },
        meta: WeatherMetaPayload {
            provider: "open-meteo".to_string(),
            model: "dwd-icon".to_string(),
            fetched_at: Utc::now(),
            source_time: "2026-03-09T13:00".to_string(),
        },
    }
}

fn fake_store(loaded_forecast: Vec<HourlyWeatherPayload>) -> FakeStore {
    FakeStore {
        current_fail_message: None,
        forecast_fail_message: None,
        load_fail_message: None,
        current_calls: Arc::new(AtomicUsize::new(0)),
        forecast_calls: Arc::new(AtomicUsize::new(0)),
        load_calls: Arc::new(AtomicUsize::new(0)),
        loaded_forecast: Arc::new(loaded_forecast),
    }
}

#[test]
fn weather_tool_definition_contains_expected_name() {
    let tool = weather_tool_definition();
    assert_eq!(tool.get("name"), Some(&json!("get_current_weather")));
}

#[test]
fn tool_error_result_sets_is_error_flag() {
    let result = tool_error_result("example".to_string());
    assert_eq!(result.get("isError"), Some(&json!(true)));
}

#[tokio::test]
async fn tools_list_returns_current_and_forecast_tools() {
    let weather_service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            forecast: test_forecast(vec![test_hourly_payload("2026-03-09T13:00:00Z", 0)]),
            current_calls: Arc::new(AtomicUsize::new(0)),
            forecast_calls: Arc::new(AtomicUsize::new(0)),
        }),
        Arc::new(fake_store(vec![test_hourly_payload(
            "2026-03-09T13:00:00Z",
            0,
        )])),
    );

    let request = JsonRpcRequest {
        jsonrpc: Some("2.0".to_string()),
        id: Some(json!(1)),
        method: "tools/list".to_string(),
        params: json!({}),
    };

    let response = process_request(request, &weather_service)
        .await
        .expect("mcp response");
    let names = response
        .pointer("/result/tools")
        .and_then(Value::as_array)
        .expect("tools list")
        .iter()
        .filter_map(|tool| tool.get("name"))
        .filter_map(Value::as_str)
        .collect::<Vec<_>>();

    assert!(names.contains(&"get_current_weather"));
    assert!(names.contains(&"get_weather_forecast"));
}

#[tokio::test]
async fn tools_call_returns_snapshot_and_persists() {
    let current_fetch_calls = Arc::new(AtomicUsize::new(0));
    let forecast_fetch_calls = Arc::new(AtomicUsize::new(0));
    let store = fake_store(vec![test_hourly_payload("2026-03-09T13:00:00Z", 0)]);
    let weather_service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            forecast: test_forecast(vec![test_hourly_payload("2026-03-09T13:00:00Z", 0)]),
            current_calls: Arc::clone(&current_fetch_calls),
            forecast_calls: Arc::clone(&forecast_fetch_calls),
        }),
        Arc::new(store.clone()),
    );

    let request = JsonRpcRequest {
        jsonrpc: Some("2.0".to_string()),
        id: Some(json!(2)),
        method: "tools/call".to_string(),
        params: json!({
          "name": "get_current_weather",
          "arguments": {
            "lat": 48.4057,
            "lon": 9.0542,
            "timezone": "Europe/Berlin"
          }
        }),
    };

    let response = process_request(request, &weather_service)
        .await
        .expect("mcp response");
    tokio::time::sleep(Duration::from_millis(20)).await;

    assert_eq!(current_fetch_calls.load(Ordering::SeqCst), 1);
    assert_eq!(forecast_fetch_calls.load(Ordering::SeqCst), 0);
    assert_eq!(store.current_calls.load(Ordering::SeqCst), 1);
    assert_eq!(store.forecast_calls.load(Ordering::SeqCst), 0);
    assert_eq!(store.load_calls.load(Ordering::SeqCst), 0);
    assert_eq!(
        response.pointer("/result/structuredContent/current/weatherCode"),
        Some(&Value::from(0))
    );
}

#[tokio::test]
async fn forecast_tool_returns_hourly_payload_and_persists() {
    let current_fetch_calls = Arc::new(AtomicUsize::new(0));
    let forecast_fetch_calls = Arc::new(AtomicUsize::new(0));
    let loaded_forecast = vec![
        test_hourly_payload("2026-03-09T13:00:00Z", 2),
        test_hourly_payload("2026-03-09T14:00:00Z", 61),
    ];
    let store = fake_store(loaded_forecast.clone());
    let weather_service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            forecast: test_forecast(loaded_forecast.clone()),
            current_calls: Arc::clone(&current_fetch_calls),
            forecast_calls: Arc::clone(&forecast_fetch_calls),
        }),
        Arc::new(store.clone()),
    );

    let request = JsonRpcRequest {
        jsonrpc: Some("2.0".to_string()),
        id: Some(json!(3)),
        method: "tools/call".to_string(),
        params: json!({
          "name": "get_weather_forecast",
          "arguments": {
            "lat": 48.4057,
            "lon": 9.0542,
            "timezone": "Europe/Berlin",
            "hoursPast": 24,
            "hoursFuture": 48
          }
        }),
    };

    let response = process_request(request, &weather_service)
        .await
        .expect("mcp response");
    tokio::time::sleep(Duration::from_millis(20)).await;

    assert_eq!(current_fetch_calls.load(Ordering::SeqCst), 0);
    assert_eq!(forecast_fetch_calls.load(Ordering::SeqCst), 1);
    assert_eq!(store.current_calls.load(Ordering::SeqCst), 0);
    assert_eq!(store.forecast_calls.load(Ordering::SeqCst), 1);
    assert_eq!(store.load_calls.load(Ordering::SeqCst), 1);
    assert_eq!(
        response.pointer("/result/structuredContent/hourly/0/weatherCode"),
        Some(&Value::from(2))
    );
    assert_eq!(
        response.pointer("/result/structuredContent/hourly/1/weatherCode"),
        Some(&Value::from(61))
    );
}

#[tokio::test]
async fn tools_call_returns_snapshot_even_when_async_persist_fails() {
    let mut store = fake_store(vec![test_hourly_payload("2026-03-09T13:00:00Z", 0)]);
    store.current_fail_message = Some("persist failed".to_string());

    let weather_service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            forecast: test_forecast(vec![test_hourly_payload("2026-03-09T13:00:00Z", 0)]),
            current_calls: Arc::new(AtomicUsize::new(0)),
            forecast_calls: Arc::new(AtomicUsize::new(0)),
        }),
        Arc::new(store),
    );

    let request = JsonRpcRequest {
        jsonrpc: Some("2.0".to_string()),
        id: Some(json!(4)),
        method: "tools/call".to_string(),
        params: json!({
          "name": "get_current_weather",
          "arguments": {
            "lat": 48.4057,
            "lon": 9.0542
          }
        }),
    };

    let response = process_request(request, &weather_service)
        .await
        .expect("mcp response");
    tokio::time::sleep(Duration::from_millis(20)).await;

    assert_eq!(response.pointer("/result/isError"), None);
    assert_eq!(
        response.pointer("/result/structuredContent/current/weatherCode"),
        Some(&Value::from(0))
    );
}
