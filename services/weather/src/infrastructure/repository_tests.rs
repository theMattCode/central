use chrono::Utc;
use serde_json::Value;

use super::WeatherSnapshotRepository;
use crate::domain::model::{
    CurrentWeatherPayload, WeatherLocationPayload, WeatherMetaPayload, WeatherSnapshotResponse,
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

async fn ensure_table_exists(repository: &WeatherSnapshotRepository) {
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
            )
            "#,
        )
        .await
        .expect("ensure snapshot table exists");
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
    ensure_table_exists(&repository).await;

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
