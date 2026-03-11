use std::{
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};

use chrono::{DateTime, Utc};
use reqwest::StatusCode;

use crate::{
    config::{Config, RuntimeMode},
    context::Context,
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

#[derive(Clone)]
struct FakeFetcher {
    snapshot: WeatherSnapshotResponse,
    forecast: WeatherForecastResponse,
    snapshot_calls: Arc<AtomicUsize>,
    forecast_calls: Arc<AtomicUsize>,
}

#[async_trait::async_trait]
impl WeatherDataFetcher for FakeFetcher {
    async fn fetch_weather_snapshot(
        &self,
        _location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
        self.snapshot_calls.fetch_add(1, Ordering::SeqCst);
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
    current_calls: Arc<AtomicUsize>,
    forecast_calls: Arc<AtomicUsize>,
    load_calls: Arc<AtomicUsize>,
    loaded_hourly: Arc<Vec<HourlyWeatherPayload>>,
}

#[async_trait::async_trait]
impl WeatherDataStore for FakeStore {
    async fn upsert_current_snapshot(
        &self,
        _snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
        self.current_calls.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    async fn upsert_hourly_forecast(
        &self,
        _forecast: &WeatherForecastResponse,
    ) -> Result<(), ApiError> {
        self.forecast_calls.fetch_add(1, Ordering::SeqCst);
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
        self.load_calls.fetch_add(1, Ordering::SeqCst);
        Ok(None)
    }

    async fn load_hourly_forecast_range(
        &self,
        _location: &WeatherLocationQuery,
        _start_inclusive: DateTime<Utc>,
        _end_inclusive: DateTime<Utc>,
    ) -> Result<Vec<HourlyWeatherPayload>, ApiError> {
        self.load_calls.fetch_add(1, Ordering::SeqCst);
        Ok(self.loaded_hourly.as_ref().clone())
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
    let snapshot_calls = Arc::new(AtomicUsize::new(0));
    let forecast_calls = Arc::new(AtomicUsize::new(0));
    let store_current_calls = Arc::new(AtomicUsize::new(0));
    let store_forecast_calls = Arc::new(AtomicUsize::new(0));
    let load_calls = Arc::new(AtomicUsize::new(0));
    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            forecast: test_forecast(vec![test_hourly_payload("2026-03-09T12:00:00Z", 2)]),
            snapshot_calls: Arc::clone(&snapshot_calls),
            forecast_calls: Arc::clone(&forecast_calls),
        }),
        Arc::new(FakeStore {
            current_calls: Arc::clone(&store_current_calls),
            forecast_calls: Arc::clone(&store_forecast_calls),
            load_calls: Arc::clone(&load_calls),
            loaded_hourly: Arc::new(vec![test_hourly_payload("2026-03-09T12:00:00Z", 2)]),
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
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert_eq!(payload["current"]["weatherCode"], 2);
    assert_eq!(snapshot_calls.load(Ordering::SeqCst), 1);
    assert_eq!(forecast_calls.load(Ordering::SeqCst), 0);
    assert_eq!(store_current_calls.load(Ordering::SeqCst), 1);
    assert_eq!(store_forecast_calls.load(Ordering::SeqCst), 0);
    assert_eq!(load_calls.load(Ordering::SeqCst), 0);
}

#[tokio::test]
async fn current_weather_manual_refresh_persists_each_call() {
    let snapshot_calls = Arc::new(AtomicUsize::new(0));
    let forecast_calls = Arc::new(AtomicUsize::new(0));
    let store_current_calls = Arc::new(AtomicUsize::new(0));
    let store_forecast_calls = Arc::new(AtomicUsize::new(0));
    let load_calls = Arc::new(AtomicUsize::new(0));
    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            forecast: test_forecast(vec![test_hourly_payload("2026-03-09T12:00:00Z", 2)]),
            snapshot_calls: Arc::clone(&snapshot_calls),
            forecast_calls: Arc::clone(&forecast_calls),
        }),
        Arc::new(FakeStore {
            current_calls: Arc::clone(&store_current_calls),
            forecast_calls: Arc::clone(&store_forecast_calls),
            load_calls: Arc::clone(&load_calls),
            loaded_hourly: Arc::new(vec![test_hourly_payload("2026-03-09T12:00:00Z", 2)]),
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
    tokio::time::sleep(Duration::from_millis(20)).await;

    assert_eq!(snapshot_calls.load(Ordering::SeqCst), 2);
    assert_eq!(forecast_calls.load(Ordering::SeqCst), 0);
    assert_eq!(store_current_calls.load(Ordering::SeqCst), 2);
    assert_eq!(store_forecast_calls.load(Ordering::SeqCst), 0);
    assert_eq!(load_calls.load(Ordering::SeqCst), 0);
}

#[tokio::test]
async fn forecast_weather_returns_hourly_forecast_and_persists() {
    let snapshot_calls = Arc::new(AtomicUsize::new(0));
    let forecast_calls = Arc::new(AtomicUsize::new(0));
    let store_current_calls = Arc::new(AtomicUsize::new(0));
    let store_forecast_calls = Arc::new(AtomicUsize::new(0));
    let load_calls = Arc::new(AtomicUsize::new(0));
    let loaded_hourly = vec![
        test_hourly_payload("2026-03-09T12:00:00Z", 2),
        test_hourly_payload("2026-03-09T13:00:00Z", 61),
    ];

    let service = WeatherSnapshotService::new(
        Arc::new(FakeFetcher {
            snapshot: test_snapshot(),
            forecast: test_forecast(loaded_hourly.clone()),
            snapshot_calls: Arc::clone(&snapshot_calls),
            forecast_calls: Arc::clone(&forecast_calls),
        }),
        Arc::new(FakeStore {
            current_calls: Arc::clone(&store_current_calls),
            forecast_calls: Arc::clone(&store_forecast_calls),
            load_calls: Arc::clone(&load_calls),
            loaded_hourly: Arc::new(loaded_hourly),
        }),
    );
    let context = Context {
        config: test_config(),
        weather_service: service,
    };

    let base_url = spawn_http_server(context).await;
    let response = reqwest::get(format!(
        "{base_url}/api/v1/weather/forecast?lat=48.4057&lon=9.0542&timezone=Europe/Berlin&hoursPast=24&hoursFuture=48"
    ))
    .await
    .expect("request hourly forecast");

    assert_eq!(response.status(), StatusCode::OK);
    let payload: serde_json::Value = response.json().await.expect("json payload");
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert_eq!(payload["hourly"].as_array().map(|value| value.len()), Some(2));
    assert_eq!(payload["hourly"][0]["weatherCode"], 2);
    assert_eq!(payload["hourly"][1]["weatherCode"], 61);
    assert_eq!(snapshot_calls.load(Ordering::SeqCst), 0);
    assert_eq!(forecast_calls.load(Ordering::SeqCst), 1);
    assert_eq!(store_current_calls.load(Ordering::SeqCst), 0);
    assert_eq!(store_forecast_calls.load(Ordering::SeqCst), 1);
    assert_eq!(load_calls.load(Ordering::SeqCst), 1);
}
