use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

use chrono::Utc;
use serde_json::{json, Value};

use crate::{
    domain::{
        contracts::{WeatherSnapshotFetcher, WeatherSnapshotStore},
        model::{
            CurrentWeatherPayload, WeatherLocationPayload, WeatherLocationQuery,
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
    calls: Arc<AtomicUsize>,
}

#[async_trait::async_trait]
impl WeatherSnapshotFetcher for FakeFetcher {
    async fn fetch_weather_snapshot(
        &self,
        _location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        Ok(self.snapshot.clone())
    }
}

#[derive(Clone)]
struct FakeStore {
    fail_message: Option<String>,
    calls: Arc<AtomicUsize>,
}

#[async_trait::async_trait]
impl WeatherSnapshotStore for FakeStore {
    async fn upsert_current_snapshot(
        &self,
        _snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if let Some(message) = &self.fail_message {
            return Err(ApiError::Internal(message.clone()));
        }
        Ok(())
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
async fn tools_call_returns_snapshot_and_persists() {
    let fetch_calls = Arc::new(AtomicUsize::new(0));
    let store_calls = Arc::new(AtomicUsize::new(0));
    let weather_service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            calls: Arc::clone(&fetch_calls),
        }),
        Arc::new(FakeStore {
            fail_message: None,
            calls: Arc::clone(&store_calls),
        }),
    );

    let request = JsonRpcRequest {
        jsonrpc: Some("2.0".to_string()),
        id: Some(json!(1)),
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

    assert_eq!(fetch_calls.load(Ordering::SeqCst), 1);
    assert_eq!(store_calls.load(Ordering::SeqCst), 1);
    assert_eq!(
        response.pointer("/result/structuredContent/current/weatherCode"),
        Some(&Value::from(0))
    );
}

#[tokio::test]
async fn tools_call_returns_tool_error_when_persist_fails() {
    let weather_service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            calls: Arc::new(AtomicUsize::new(0)),
        }),
        Arc::new(FakeStore {
            fail_message: Some("persist failed".to_string()),
            calls: Arc::new(AtomicUsize::new(0)),
        }),
    );

    let request = JsonRpcRequest {
        jsonrpc: Some("2.0".to_string()),
        id: Some(json!(2)),
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

    assert_eq!(
        response.pointer("/result/isError"),
        Some(&Value::from(true))
    );
    assert!(response
        .pointer("/result/content/0/text")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .contains("persist failed"));
}
