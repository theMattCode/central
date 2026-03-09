use std::{
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};

use chrono::Utc;
use reqwest::StatusCode;

use crate::{
    context::Context,
    config::{Config, RuntimeMode},
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
    calls: Arc<AtomicUsize>,
}

#[async_trait::async_trait]
impl WeatherSnapshotStore for FakeStore {
    async fn upsert_current_snapshot(
        &self,
        _snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
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
            weather_code: 2,
            temperature_c: 7.0,
            temperature_apparent_c: 5.0,
            is_day: true,
            precipitation: 0.0,
            wind_speed: 4.0,
            wind_direction: 90.0,
            relative_humidity: 65.0,
            pressure: 1012.0,
            cloud_cover: 30.0,
        },
        meta: WeatherMetaPayload {
            provider: "open-meteo".to_string(),
            model: "dwd-icon".to_string(),
            fetched_at: Utc::now(),
            source_time: "2026-03-09T12:00".to_string(),
        },
    }
}

async fn spawn_http_server(context: Context) -> String {
    let app = super::build_router(context);
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
        runtime_mode: RuntimeMode::Http,
        port: 0,
        refresh_interval: Duration::from_secs(900),
        open_meteo_base_url: "http://example.test".to_string(),
        database_url: "postgres://example".to_string(),
        request_timeout: Duration::from_secs(5),
        cors_allow_origin: "*".to_string(),
    })
}

#[tokio::test]
async fn current_weather_returns_snapshot_and_persists() {
    let fetch_calls = Arc::new(AtomicUsize::new(0));
    let store_calls = Arc::new(AtomicUsize::new(0));
    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            calls: Arc::clone(&fetch_calls),
        }),
        Arc::new(FakeStore {
            calls: Arc::clone(&store_calls),
        }),
    );
    let context = Context {
        config: test_config(),
        weather_service: service,
    };

    let base_url = spawn_http_server(context).await;
    let response = reqwest::get(format!(
        "{base_url}/api/v1/weather/current?lat=48.4057&lon=9.0542&timezone=Europe/Berlin"
    ))
    .await
    .expect("request current weather");

    assert_eq!(response.status(), StatusCode::OK);
    let payload: serde_json::Value = response.json().await.expect("json payload");
    assert_eq!(payload["current"]["weatherCode"], 2);
    assert_eq!(fetch_calls.load(Ordering::SeqCst), 1);
    assert_eq!(store_calls.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn current_weather_manual_refresh_persists_each_call() {
    let fetch_calls = Arc::new(AtomicUsize::new(0));
    let store_calls = Arc::new(AtomicUsize::new(0));
    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            calls: Arc::clone(&fetch_calls),
        }),
        Arc::new(FakeStore {
            calls: Arc::clone(&store_calls),
        }),
    );
    let context = Context {
        config: test_config(),
        weather_service: service,
    };

    let base_url = spawn_http_server(context).await;
    let url = format!("{base_url}/api/v1/weather/current?lat=48.4057&lon=9.0542");

    reqwest::get(&url)
        .await
        .expect("first manual refresh request");
    reqwest::get(&url)
        .await
        .expect("second manual refresh request");

    assert_eq!(fetch_calls.load(Ordering::SeqCst), 2);
    assert_eq!(store_calls.load(Ordering::SeqCst), 2);
}
