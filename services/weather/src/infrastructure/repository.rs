use std::{sync::Arc, time::Duration};

use tokio_postgres::{Client, NoTls};
use tracing::{error, info, warn};

use crate::{
    domain::{contracts::WeatherSnapshotStore, model::WeatherSnapshotResponse},
    error::ApiError,
};

const CURRENT_WEATHER_PAYLOAD_VERSION: i16 = 1;
const DB_CONNECT_MAX_ATTEMPTS: usize = 10;
const DB_CONNECT_RETRY_DELAY: Duration = Duration::from_secs(1);
const UPSERT_CURRENT_WEATHER_SQL: &str = r#"
INSERT INTO service_weather.current_weather_snapshots (
  latitude,
  longitude,
  timezone,
  payload_version,
  current_payload,
  source_time,
  fetched_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
ON CONFLICT (latitude, longitude)
DO UPDATE SET
  timezone = EXCLUDED.timezone,
  payload_version = EXCLUDED.payload_version,
  current_payload = EXCLUDED.current_payload,
  source_time = EXCLUDED.source_time,
  fetched_at = EXCLUDED.fetched_at,
  updated_at = NOW()
"#;

#[derive(Clone)]
pub struct WeatherSnapshotRepository {
    client: Arc<Client>,
}

impl WeatherSnapshotRepository {
    pub async fn connect(database_url: &str) -> Result<Self, ApiError> {
        let mut attempt = 1_usize;
        let (client, connection) = loop {
            match tokio_postgres::connect(database_url, NoTls).await {
                Ok(connected) => break connected,
                Err(error) if attempt < DB_CONNECT_MAX_ATTEMPTS => {
                    warn!(
                        attempt,
                        max_attempts = DB_CONNECT_MAX_ATTEMPTS,
                        retry_delay_seconds = DB_CONNECT_RETRY_DELAY.as_secs(),
                        error = %error,
                        "Failed to connect to PostgreSQL database; retrying"
                    );
                    tokio::time::sleep(DB_CONNECT_RETRY_DELAY).await;
                    attempt += 1;
                }
                Err(error) => {
                    return Err(ApiError::Internal(format!(
                        "Failed to connect to PostgreSQL database after {attempt} attempts: {error}"
                    )));
                }
            }
        };

        tokio::spawn(async move {
            if let Err(error) = connection.await {
                error!("PostgreSQL connection terminated: {error}");
            }
        });

        info!(
            attempt,
            "Connected to PostgreSQL for weather snapshot persistence"
        );

        Ok(Self {
            client: Arc::new(client),
        })
    }

    pub async fn upsert_current_snapshot(
        &self,
        snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
        let latitude = snapshot.location.latitude;
        let longitude = snapshot.location.longitude;
        let timezone = snapshot.location.timezone.clone();
        let current_payload = serde_json::to_value(&snapshot.current).map_err(|error| {
            ApiError::Internal(format!("Failed to serialize snapshot payload: {error}"))
        })?;

        self.client
            .execute(
                UPSERT_CURRENT_WEATHER_SQL,
                &[
                    &latitude,
                    &longitude,
                    &timezone,
                    &CURRENT_WEATHER_PAYLOAD_VERSION,
                    &current_payload,
                    &snapshot.meta.source_time,
                    &snapshot.meta.fetched_at,
                ],
            )
            .await
            .map_err(|error| {
                ApiError::Internal(format!(
                    "Failed to upsert current weather snapshot for location ({}, {}, {}): {error}",
                    latitude, longitude, timezone
                ))
            })?;

        info!(
            lat = latitude,
            lon = longitude,
            timezone = %timezone,
            payload_version = CURRENT_WEATHER_PAYLOAD_VERSION,
            source_time = %snapshot.meta.source_time,
            "Persisted current weather snapshot"
        );

        Ok(())
    }
}

#[async_trait::async_trait]
impl WeatherSnapshotStore for WeatherSnapshotRepository {
    async fn upsert_current_snapshot(
        &self,
        snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
        WeatherSnapshotRepository::upsert_current_snapshot(self, snapshot).await
    }
}

#[cfg(test)]
#[path = "repository_tests.rs"]
mod tests;
