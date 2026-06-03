use chrono::{DateTime, Duration as ChronoDuration, Timelike, Utc};
use serde_json::Value;

use super::WeatherSnapshotRepository;
use crate::domains::weather::model::{
    CurrentWeatherPayload, HourlyWeatherPayload, WeatherForecastMetaPayload,
    WeatherForecastResponse, WeatherLocationPayload, WeatherMetaPayload, WeatherSnapshotResponse,
};

fn weather_test_db_url() -> Option<String> {
    std::env::var("WEATHER_TEST_DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn test_snapshot(source_time: &str, weather_code: i32, timezone: &str) -> WeatherSnapshotResponse {
    WeatherSnapshotResponse {
        location: WeatherLocationPayload {
            latitude: 48.4057,
            longitude: 9.0542,
            timezone: timezone.to_string(),
        },
        current: CurrentWeatherPayload {
            weather_code,
            temperature_c: 10.0,
            temperature_apparent_c: 9.0,
            is_day: true,
            precipitation: 0.5,
            wind_speed: 7.0,
            wind_direction: 120.0,
            relative_humidity: 62.0,
            pressure: 1016.0,
            cloud_cover: 40.0,
        },
        meta: WeatherMetaPayload {
            provider: "open-meteo".to_string(),
            model: "dwd-icon".to_string(),
            fetched_at: Utc::now(),
            source_time: source_time.to_string(),
        },
    }
}

fn test_hourly_payload(forecast_at: DateTime<Utc>, weather_code: i32) -> HourlyWeatherPayload {
    HourlyWeatherPayload {
        forecast_at,
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

fn test_forecast(hourly: Vec<HourlyWeatherPayload>, timezone: &str) -> WeatherForecastResponse {
    WeatherForecastResponse {
        location: WeatherLocationPayload {
            latitude: 48.4057,
            longitude: 9.0542,
            timezone: timezone.to_string(),
        },
        hourly,
        meta: WeatherForecastMetaPayload {
            provider: "open-meteo".to_string(),
            model: "dwd-icon".to_string(),
            fetched_at: Utc::now(),
        },
    }
}

fn current_utc_hour() -> DateTime<Utc> {
    Utc::now()
        .with_minute(0)
        .and_then(|value| value.with_second(0))
        .and_then(|value| value.with_nanosecond(0))
        .expect("round UTC now to hour")
}

async fn ensure_tables_exist(repository: &WeatherSnapshotRepository) {
    repository
        .client
        .batch_execute(
            r#"
            CREATE SCHEMA IF NOT EXISTS service_weather;
            CREATE TABLE IF NOT EXISTS service_weather.current_weather_snapshots (
              latitude DOUBLE PRECISION NOT NULL,
              longitude DOUBLE PRECISION NOT NULL,
              timezone TEXT NOT NULL,
              payload_version SMALLINT NOT NULL CHECK (payload_version > 0),
              current_payload JSONB NOT NULL,
              source_time TEXT NOT NULL,
              fetched_at TIMESTAMPTZ NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY (latitude, longitude)
            );
            CREATE TABLE IF NOT EXISTS service_weather.hourly_weather_forecasts (
              latitude DOUBLE PRECISION NOT NULL,
              longitude DOUBLE PRECISION NOT NULL,
              timezone TEXT NOT NULL,
              forecast_at_utc TIMESTAMPTZ NOT NULL,
              weather_code INTEGER NOT NULL,
              temperature_c DOUBLE PRECISION NOT NULL,
              temperature_apparent_c DOUBLE PRECISION NOT NULL,
              is_day BOOLEAN NOT NULL,
              precipitation_mm DOUBLE PRECISION NOT NULL,
              rain_mm DOUBLE PRECISION NOT NULL,
              snowfall_cm DOUBLE PRECISION NOT NULL,
              relative_humidity_pct DOUBLE PRECISION NOT NULL,
              wind_speed_kmh DOUBLE PRECISION NOT NULL,
              wind_gusts_kmh DOUBLE PRECISION NOT NULL,
              wind_direction_deg DOUBLE PRECISION NOT NULL,
              pressure_msl_hpa DOUBLE PRECISION NOT NULL,
              cloud_cover_pct DOUBLE PRECISION NOT NULL,
              provider TEXT NOT NULL,
              model TEXT NOT NULL,
              fetched_at TIMESTAMPTZ NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY (latitude, longitude, forecast_at_utc)
            );
            "#,
        )
        .await
        .expect("ensure weather tables exist");
}

#[tokio::test]
async fn upsert_current_snapshot_inserts_and_updates_row_for_same_location() {
    let Some(database_url) = weather_test_db_url() else {
        eprintln!("Skipping repository integration test; WEATHER_TEST_DATABASE_URL is not set.");
        return;
    };

    let repository = WeatherSnapshotRepository::connect(&database_url)
        .await
        .expect("connect repository");
    ensure_tables_exist(&repository).await;

    repository
        .client
        .execute(
            "DELETE FROM service_weather.current_weather_snapshots WHERE latitude = $1 AND longitude = $2",
            &[&48.4057_f64, &9.0542_f64],
        )
        .await
        .expect("cleanup old test row");

    let first = test_snapshot("2026-03-09T10:00", 1, "Europe/Berlin");
    repository
        .upsert_current_snapshot(&first)
        .await
        .expect("insert snapshot");

    let second = test_snapshot("2026-03-09T11:00", 61, "UTC");
    repository
        .upsert_current_snapshot(&second)
        .await
        .expect("update snapshot");

    let row = repository
        .client
        .query_one(
            r#"
            SELECT timezone, payload_version, current_payload, source_time
            FROM service_weather.current_weather_snapshots
            WHERE latitude = $1 AND longitude = $2
            "#,
            &[&48.4057_f64, &9.0542_f64],
        )
        .await
        .expect("query upserted snapshot");

    let timezone: String = row.get("timezone");
    let payload_version: i16 = row.get("payload_version");
    let current_payload: Value = row.get("current_payload");
    let source_time: String = row.get("source_time");

    assert_eq!(timezone, "UTC");
    assert_eq!(payload_version, 1);
    assert_eq!(source_time, "2026-03-09T11:00");
    assert_eq!(current_payload.get("weatherCode"), Some(&Value::from(61)));

    let row_count = repository
        .client
        .query_one(
            "SELECT COUNT(*) AS count FROM service_weather.current_weather_snapshots WHERE latitude = $1 AND longitude = $2",
            &[&48.4057_f64, &9.0542_f64],
        )
        .await
        .expect("count rows");
    let count: i64 = row_count.get("count");
    assert_eq!(count, 1);
}

#[tokio::test]
async fn upsert_hourly_forecast_keeps_past_rows_and_overwrites_future_rows() {
    let Some(database_url) = weather_test_db_url() else {
        eprintln!("Skipping repository integration test; WEATHER_TEST_DATABASE_URL is not set.");
        return;
    };

    let repository = WeatherSnapshotRepository::connect(&database_url)
        .await
        .expect("connect repository");
    ensure_tables_exist(&repository).await;

    repository
        .client
        .execute(
            "DELETE FROM service_weather.hourly_weather_forecasts WHERE latitude = $1 AND longitude = $2",
            &[&48.4057_f64, &9.0542_f64],
        )
        .await
        .expect("cleanup old hourly rows");

    let now_hour = current_utc_hour();
    let past_hour = now_hour - ChronoDuration::hours(1);
    let future_hour = now_hour + ChronoDuration::hours(1);

    let first = test_forecast(
        vec![
            test_hourly_payload(past_hour, 1),
            test_hourly_payload(future_hour, 2),
        ],
        "Europe/Berlin",
    );
    repository
        .upsert_hourly_forecast(&first)
        .await
        .expect("insert hourly forecast");

    let second = test_forecast(
        vec![
            test_hourly_payload(past_hour, 81),
            test_hourly_payload(future_hour, 82),
        ],
        "UTC",
    );
    repository
        .upsert_hourly_forecast(&second)
        .await
        .expect("upsert hourly forecast");

    let row_past = repository
        .client
        .query_one(
            r#"
            SELECT timezone, weather_code
            FROM service_weather.hourly_weather_forecasts
            WHERE latitude = $1 AND longitude = $2 AND forecast_at_utc = $3
            "#,
            &[&48.4057_f64, &9.0542_f64, &past_hour],
        )
        .await
        .expect("query past row");

    let row_future = repository
        .client
        .query_one(
            r#"
            SELECT timezone, weather_code
            FROM service_weather.hourly_weather_forecasts
            WHERE latitude = $1 AND longitude = $2 AND forecast_at_utc = $3
            "#,
            &[&48.4057_f64, &9.0542_f64, &future_hour],
        )
        .await
        .expect("query future row");

    let past_timezone: String = row_past.get("timezone");
    let past_code: i32 = row_past.get("weather_code");
    let future_timezone: String = row_future.get("timezone");
    let future_code: i32 = row_future.get("weather_code");

    assert_eq!(past_timezone, "Europe/Berlin");
    assert_eq!(past_code, 1);
    assert_eq!(future_timezone, "UTC");
    assert_eq!(future_code, 82);

    let loaded = repository
        .load_hourly_forecast_range(
            &crate::domains::weather::model::WeatherLocationQuery {
                latitude: 48.4057,
                longitude: 9.0542,
                timezone: "UTC".to_string(),
            },
            past_hour - ChronoDuration::hours(1),
            future_hour + ChronoDuration::hours(1),
        )
        .await
        .expect("load forecast range");

    assert_eq!(loaded.len(), 2);
    assert_eq!(loaded[0].weather_code, 1);
    assert_eq!(loaded[1].weather_code, 82);
}
