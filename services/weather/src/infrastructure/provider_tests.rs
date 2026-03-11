use std::time::Duration;

use axum::{http::StatusCode, routing::get, Router};

use crate::{
    domain::model::WeatherLocationQuery, error::ApiError, infrastructure::provider::OpenMeteoClient,
};

async fn spawn_test_server(status: StatusCode, body: &'static str) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind test listener");
    let address = listener.local_addr().expect("listener address");

    let app = Router::new().route("/v1/dwd-icon", get(move || async move { (status, body) }));

    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("run test server");
    });

    format!("http://{address}")
}

fn test_location() -> WeatherLocationQuery {
    WeatherLocationQuery {
        latitude: 48.4057,
        longitude: 9.0542,
        timezone: "Europe/Berlin".to_string(),
    }
}

#[tokio::test]
async fn fetch_weather_snapshot_maps_valid_response() {
    let server_url = spawn_test_server(
        StatusCode::OK,
        r#"{
          "latitude": 48.4057,
          "longitude": 9.0542,
          "timezone": "Europe/Berlin",
          "current": {
            "time": "2026-03-09T10:00",
            "weather_code": 3,
            "temperature_2m": 8.2,
            "apparent_temperature": 6.5,
            "is_day": 1,
            "precipitation": 0.1,
            "relative_humidity_2m": 72.0,
            "wind_speed_10m": 12.2,
            "wind_direction_10m": 145.0,
            "pressure_msl": 1017.3,
            "cloud_cover": 45.0
          }
        }"#,
    )
    .await;

    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let snapshot = client
        .fetch_weather_snapshot(&test_location())
        .await
        .expect("fetch snapshot");

    assert_eq!(snapshot.location.latitude, 48.4057);
    assert_eq!(snapshot.location.longitude, 9.0542);
    assert_eq!(snapshot.location.timezone, "Europe/Berlin");
    assert_eq!(snapshot.current.weather_code, 3);
    assert_eq!(snapshot.current.temperature_c, 8.2);
    assert_eq!(snapshot.current.temperature_apparent_c, 6.5);
    assert!(snapshot.current.is_day);
    assert_eq!(snapshot.current.precipitation, 0.1);
    assert_eq!(snapshot.current.relative_humidity, 72.0);
    assert_eq!(snapshot.current.wind_speed, 12.2);
    assert_eq!(snapshot.current.wind_direction, 145.0);
    assert_eq!(snapshot.current.pressure, 1017.3);
    assert_eq!(snapshot.current.cloud_cover, 45.0);
    assert_eq!(snapshot.meta.provider, "open-meteo");
    assert_eq!(snapshot.meta.model, "dwd-icon");
    assert_eq!(snapshot.meta.source_time, "2026-03-09T10:00");
}

#[tokio::test]
async fn fetch_hourly_forecast_maps_valid_response() {
    let server_url = spawn_test_server(
        StatusCode::OK,
        r#"{
          "latitude": 48.4057,
          "longitude": 9.0542,
          "timezone": "Europe/Berlin",
          "hourly": {
            "time": [1773046800, 1773050400],
            "weather_code": [3, 61],
            "temperature_2m": [8.2, 7.9],
            "apparent_temperature": [6.5, 6.0],
            "is_day": [1, 1],
            "precipitation": [0.1, 0.6],
            "rain": [0.1, 0.6],
            "snowfall": [0.0, 0.0],
            "relative_humidity_2m": [72.0, 74.0],
            "wind_speed_10m": [12.2, 14.5],
            "wind_gusts_10m": [20.1, 24.0],
            "wind_direction_10m": [145.0, 160.0],
            "pressure_msl": [1017.3, 1016.8],
            "cloud_cover": [45.0, 68.0]
          }
        }"#,
    )
    .await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let forecast = client
        .fetch_hourly_forecast(&test_location(), 12, 24)
        .await
        .expect("fetch forecast");

    assert_eq!(forecast.location.latitude, 48.4057);
    assert_eq!(forecast.location.longitude, 9.0542);
    assert_eq!(forecast.location.timezone, "Europe/Berlin");
    assert_eq!(forecast.hourly.len(), 2);
    assert_eq!(forecast.hourly[0].weather_code, 3);
    assert_eq!(forecast.hourly[1].weather_code, 61);
    assert_eq!(forecast.hourly[0].temperature_c, 8.2);
    assert_eq!(forecast.hourly[1].rain_mm, 0.6);
    assert_eq!(forecast.hourly[1].wind_gusts_kmh, 24.0);
    assert_eq!(forecast.meta.provider, "open-meteo");
    assert_eq!(forecast.meta.model, "dwd-icon");
}

#[tokio::test]
async fn fetch_hourly_forecast_maps_iso_time_response() {
    let server_url = spawn_test_server(
        StatusCode::OK,
        r#"{
          "latitude": 48.4057,
          "longitude": 9.0542,
          "timezone": "Europe/Berlin",
          "hourly": {
            "time": ["2026-03-09T10:00", "2026-03-09T11:00"],
            "weather_code": [3, 61],
            "temperature_2m": [8.2, 7.9],
            "apparent_temperature": [6.5, 6.0],
            "is_day": [1, 1],
            "precipitation": [0.1, 0.6],
            "rain": [0.1, 0.6],
            "snowfall": [0.0, 0.0],
            "relative_humidity_2m": [72.0, 74.0],
            "wind_speed_10m": [12.2, 14.5],
            "wind_gusts_10m": [20.1, 24.0],
            "wind_direction_10m": [145.0, 160.0],
            "pressure_msl": [1017.3, 1016.8],
            "cloud_cover": [45.0, 68.0]
          }
        }"#,
    )
    .await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let forecast = client
        .fetch_hourly_forecast(&test_location(), 12, 24)
        .await
        .expect("fetch forecast");

    assert_eq!(forecast.hourly.len(), 2);
    assert_eq!(forecast.hourly[0].weather_code, 3);
    assert_eq!(forecast.hourly[0].forecast_at.to_rfc3339(), "2026-03-09T09:00:00+00:00");
}

#[tokio::test]
async fn fetch_hourly_forecast_skips_rows_with_null_values() {
    let server_url = spawn_test_server(
        StatusCode::OK,
        r#"{
          "latitude": 48.4057,
          "longitude": 9.0542,
          "timezone": "Europe/Berlin",
          "hourly": {
            "time": [1773046800, 1773050400],
            "weather_code": [3, null],
            "temperature_2m": [8.2, 7.9],
            "apparent_temperature": [6.5, 6.0],
            "is_day": [1, 1],
            "precipitation": [0.1, 0.6],
            "rain": [0.1, 0.6],
            "snowfall": [0.0, 0.0],
            "relative_humidity_2m": [72.0, 74.0],
            "wind_speed_10m": [12.2, 14.5],
            "wind_gusts_10m": [20.1, 24.0],
            "wind_direction_10m": [145.0, 160.0],
            "pressure_msl": [1017.3, 1016.8],
            "cloud_cover": [45.0, 68.0]
          }
        }"#,
    )
    .await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let forecast = client
        .fetch_hourly_forecast(&test_location(), 12, 24)
        .await
        .expect("fetch forecast");

    assert_eq!(forecast.hourly.len(), 1);
    assert_eq!(forecast.hourly[0].weather_code, 3);
}

#[tokio::test]
async fn fetch_hourly_forecast_returns_error_when_all_rows_have_null_values() {
    let server_url = spawn_test_server(
        StatusCode::OK,
        r#"{
          "latitude": 48.4057,
          "longitude": 9.0542,
          "timezone": "Europe/Berlin",
          "hourly": {
            "time": [1773046800, 1773050400],
            "weather_code": [null, null],
            "temperature_2m": [8.2, 7.9],
            "apparent_temperature": [6.5, 6.0],
            "is_day": [1, 1],
            "precipitation": [0.1, 0.6],
            "rain": [0.1, 0.6],
            "snowfall": [0.0, 0.0],
            "relative_humidity_2m": [72.0, 74.0],
            "wind_speed_10m": [12.2, 14.5],
            "wind_gusts_10m": [20.1, 24.0],
            "wind_direction_10m": [145.0, 160.0],
            "pressure_msl": [1017.3, 1016.8],
            "cloud_cover": [45.0, 68.0]
          }
        }"#,
    )
    .await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let error = client
        .fetch_hourly_forecast(&test_location(), 12, 24)
        .await
        .expect_err("expected no usable row error");

    match error {
        ApiError::Upstream(message) => {
            assert!(message.contains("no usable hourly forecast points"));
        }
        other => panic!("expected ApiError::Upstream, got {other:?}"),
    }
}

#[tokio::test]
async fn fetch_weather_snapshot_returns_error_for_non_success_status() {
    let server_url = spawn_test_server(StatusCode::BAD_GATEWAY, "upstream broke").await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let error = client
        .fetch_weather_snapshot(&test_location())
        .await
        .expect_err("expected upstream error");

    match error {
        ApiError::Upstream(message) => {
            assert!(message.contains("HTTP 502"));
            assert!(message.contains("upstream broke"));
        }
        other => panic!("expected ApiError::Upstream, got {other:?}"),
    }
}

#[tokio::test]
async fn fetch_weather_snapshot_returns_error_when_current_is_missing() {
    let server_url = spawn_test_server(
        StatusCode::OK,
        r#"{
          "latitude": 48.4057,
          "longitude": 9.0542,
          "timezone": "Europe/Berlin",
          "current": null
        }"#,
    )
    .await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let error = client
        .fetch_weather_snapshot(&test_location())
        .await
        .expect_err("expected current missing error");

    match error {
        ApiError::Upstream(message) => {
            assert!(message.contains("missing current weather"));
        }
        other => panic!("expected ApiError::Upstream, got {other:?}"),
    }
}

#[tokio::test]
async fn fetch_hourly_forecast_returns_error_when_hourly_is_missing() {
    let server_url = spawn_test_server(
        StatusCode::OK,
        r#"{
          "latitude": 48.4057,
          "longitude": 9.0542,
          "timezone": "Europe/Berlin",
          "hourly": null
        }"#,
    )
    .await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let error = client
        .fetch_hourly_forecast(&test_location(), 1, 1)
        .await
        .expect_err("expected hourly missing error");

    match error {
        ApiError::Upstream(message) => {
            assert!(message.contains("missing hourly forecast"));
        }
        other => panic!("expected ApiError::Upstream, got {other:?}"),
    }
}

#[tokio::test]
async fn fetch_hourly_forecast_returns_error_for_mismatched_hourly_lengths() {
    let server_url = spawn_test_server(
        StatusCode::OK,
        r#"{
          "latitude": 48.4057,
          "longitude": 9.0542,
          "timezone": "Europe/Berlin",
          "hourly": {
            "time": [1773046800, 1773050400],
            "weather_code": [3],
            "temperature_2m": [8.2, 7.9],
            "apparent_temperature": [6.5, 6.0],
            "is_day": [1, 1],
            "precipitation": [0.1, 0.6],
            "rain": [0.1, 0.6],
            "snowfall": [0.0, 0.0],
            "relative_humidity_2m": [72.0, 74.0],
            "wind_speed_10m": [12.2, 14.5],
            "wind_gusts_10m": [20.1, 24.0],
            "wind_direction_10m": [145.0, 160.0],
            "pressure_msl": [1017.3, 1016.8],
            "cloud_cover": [45.0, 68.0]
          }
        }"#,
    )
    .await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let error = client
        .fetch_hourly_forecast(&test_location(), 1, 1)
        .await
        .expect_err("expected mismatch error");

    match error {
        ApiError::Upstream(message) => {
            assert!(message.contains("length mismatch"));
            assert!(message.contains("weather_code"));
        }
        other => panic!("expected ApiError::Upstream, got {other:?}"),
    }
}

#[tokio::test]
async fn fetch_weather_snapshot_returns_error_for_invalid_json() {
    let server_url = spawn_test_server(StatusCode::OK, "not-json").await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let error = client
        .fetch_weather_snapshot(&test_location())
        .await
        .expect_err("expected invalid json error");

    match error {
        ApiError::Upstream(message) => {
            assert!(message.contains("Invalid Open-Meteo JSON response"));
        }
        other => panic!("expected ApiError::Upstream, got {other:?}"),
    }
}

#[tokio::test]
async fn fetch_weather_snapshot_returns_error_for_upstream_error_payload() {
    let server_url = spawn_test_server(
        StatusCode::OK,
        r#"{
          "error": true,
          "reason": "Parameter timezone is invalid."
        }"#,
    )
    .await;
    let client = OpenMeteoClient::new(server_url, Duration::from_secs(2)).expect("create client");

    let error = client
        .fetch_weather_snapshot(&test_location())
        .await
        .expect_err("expected upstream payload error");

    match error {
        ApiError::Upstream(message) => {
            assert!(message.contains("error payload"));
            assert!(message.contains("timezone is invalid"));
        }
        other => panic!("expected ApiError::Upstream, got {other:?}"),
    }
}
