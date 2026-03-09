use std::sync::{Arc, Mutex};

use chrono::Utc;

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

#[derive(Clone)]
struct FakeFetcher {
    snapshot: Option<WeatherSnapshotResponse>,
    error_message: Option<String>,
    calls: Arc<Mutex<Vec<WeatherLocationQuery>>>,
}

#[async_trait::async_trait]
impl WeatherSnapshotFetcher for FakeFetcher {
    async fn fetch_weather_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
        self.calls
            .lock()
            .expect("lock fetcher calls")
            .push(location.clone());

        if let Some(message) = &self.error_message {
            return Err(ApiError::Upstream(message.clone()));
        }

        self.snapshot
            .clone()
            .ok_or_else(|| ApiError::Internal("missing fake snapshot".to_string()))
    }
}

#[derive(Clone)]
struct FakeStore {
    fail_message: Option<String>,
    calls: Arc<Mutex<Vec<WeatherSnapshotResponse>>>,
}

#[async_trait::async_trait]
impl WeatherSnapshotStore for FakeStore {
    async fn upsert_current_snapshot(
        &self,
        snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
        self.calls
            .lock()
            .expect("lock store calls")
            .push(snapshot.clone());

        if let Some(message) = &self.fail_message {
            return Err(ApiError::Internal(message.clone()));
        }

        Ok(())
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

#[tokio::test]
async fn fetch_and_store_snapshot_persists_and_returns_snapshot() {
    let fetcher_calls = Arc::new(Mutex::new(Vec::new()));
    let store_calls = Arc::new(Mutex::new(Vec::new()));
    let expected_snapshot = test_snapshot(3);

    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: Some(expected_snapshot.clone()),
            error_message: None,
            calls: Arc::clone(&fetcher_calls),
        }),
        Arc::new(FakeStore {
            fail_message: None,
            calls: Arc::clone(&store_calls),
        }),
    );

    let snapshot = service
        .fetch_and_store_snapshot(&test_location())
        .await
        .expect("fetch and store should succeed");

    assert_eq!(snapshot.current.weather_code, 3);
    assert_eq!(fetcher_calls.lock().expect("lock fetcher calls").len(), 1);
    assert_eq!(store_calls.lock().expect("lock store calls").len(), 1);
    assert_eq!(
        store_calls.lock().expect("lock store calls")[0]
            .current
            .weather_code,
        3
    );
}

#[tokio::test]
async fn fetch_and_store_snapshot_propagates_fetch_error_without_persisting() {
    let fetcher_calls = Arc::new(Mutex::new(Vec::new()));
    let store_calls = Arc::new(Mutex::new(Vec::new()));

    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: None,
            error_message: Some("upstream failed".to_string()),
            calls: Arc::clone(&fetcher_calls),
        }),
        Arc::new(FakeStore {
            fail_message: None,
            calls: Arc::clone(&store_calls),
        }),
    );

    let error = service
        .fetch_and_store_snapshot(&test_location())
        .await
        .expect_err("fetch should fail");

    match error {
        ApiError::Upstream(message) => assert!(message.contains("upstream failed")),
        other => panic!("expected upstream error, got {other:?}"),
    }
    assert_eq!(fetcher_calls.lock().expect("lock fetcher calls").len(), 1);
    assert_eq!(store_calls.lock().expect("lock store calls").len(), 0);
}

#[tokio::test]
async fn fetch_and_store_snapshot_propagates_store_error() {
    let fetcher_calls = Arc::new(Mutex::new(Vec::new()));
    let store_calls = Arc::new(Mutex::new(Vec::new()));

    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: Some(test_snapshot(2)),
            error_message: None,
            calls: Arc::clone(&fetcher_calls),
        }),
        Arc::new(FakeStore {
            fail_message: Some("db write failed".to_string()),
            calls: Arc::clone(&store_calls),
        }),
    );

    let error = service
        .fetch_and_store_snapshot(&test_location())
        .await
        .expect_err("store should fail");

    match error {
        ApiError::Internal(message) => assert!(message.contains("db write failed")),
        other => panic!("expected internal error, got {other:?}"),
    }
    assert_eq!(fetcher_calls.lock().expect("lock fetcher calls").len(), 1);
    assert_eq!(store_calls.lock().expect("lock store calls").len(), 1);
}
