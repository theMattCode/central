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
