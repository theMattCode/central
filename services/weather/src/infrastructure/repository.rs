use std::{sync::Arc, time::Duration};

use chrono::{DateTime, Timelike, Utc};
use tokio_postgres::{Client, NoTls, config::Host};
use tracing::{error, info, warn};

use crate::{
    domain::{
        contracts::WeatherDataStore,
        model::{
            HourlyWeatherPayload, WeatherForecastMetaPayload, WeatherForecastResponse,
            WeatherLocationPayload, WeatherLocationQuery, WeatherMetaPayload, WeatherSnapshotResponse,
        },
    },
    error::ApiError,
};

const DB_CONNECT_MAX_ATTEMPTS: usize = 10;
const DB_CONNECT_RETRY_DELAY: Duration = Duration::from_secs(1);

const CURRENT_WEATHER_PAYLOAD_VERSION: i16 = 1;

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

const SELECT_CURRENT_WEATHER_SQL: &str = r#"
SELECT
  timezone,
  current_payload,
  source_time,
  fetched_at
FROM service_weather.current_weather_snapshots
WHERE latitude = $1
  AND longitude = $2
"#;

const UPSERT_HOURLY_FORECAST_SQL: &str = r#"
INSERT INTO service_weather.hourly_weather_forecasts (
  latitude,
  longitude,
  timezone,
  forecast_at_utc,
  weather_code,
  temperature_c,
  temperature_apparent_c,
  is_day,
  precipitation_mm,
  rain_mm,
  snowfall_cm,
  relative_humidity_pct,
  wind_speed_kmh,
  wind_gusts_kmh,
  wind_direction_deg,
  pressure_msl_hpa,
  cloud_cover_pct,
  provider,
  model,
  fetched_at,
  updated_at
)
VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
  $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
)
ON CONFLICT (latitude, longitude, forecast_at_utc)
DO UPDATE SET
  timezone = EXCLUDED.timezone,
  weather_code = EXCLUDED.weather_code,
  temperature_c = EXCLUDED.temperature_c,
  temperature_apparent_c = EXCLUDED.temperature_apparent_c,
  is_day = EXCLUDED.is_day,
  precipitation_mm = EXCLUDED.precipitation_mm,
  rain_mm = EXCLUDED.rain_mm,
  snowfall_cm = EXCLUDED.snowfall_cm,
  relative_humidity_pct = EXCLUDED.relative_humidity_pct,
  wind_speed_kmh = EXCLUDED.wind_speed_kmh,
  wind_gusts_kmh = EXCLUDED.wind_gusts_kmh,
  wind_direction_deg = EXCLUDED.wind_direction_deg,
  pressure_msl_hpa = EXCLUDED.pressure_msl_hpa,
  cloud_cover_pct = EXCLUDED.cloud_cover_pct,
  provider = EXCLUDED.provider,
  model = EXCLUDED.model,
  fetched_at = EXCLUDED.fetched_at,
  updated_at = NOW()
WHERE EXCLUDED.forecast_at_utc >= $21
"#;

const SELECT_HOURLY_FORECAST_SNAPSHOT_SQL: &str = r#"
SELECT
  timezone,
  forecast_at_utc,
  weather_code,
  temperature_c,
  temperature_apparent_c,
  is_day,
  precipitation_mm,
  rain_mm,
  snowfall_cm,
  relative_humidity_pct,
  wind_speed_kmh,
  wind_gusts_kmh,
  wind_direction_deg,
  pressure_msl_hpa,
  cloud_cover_pct,
  provider,
  model,
  fetched_at
FROM service_weather.hourly_weather_forecasts
WHERE latitude = $1
  AND longitude = $2
  AND forecast_at_utc >= $3
  AND forecast_at_utc <= $4
ORDER BY forecast_at_utc ASC
"#;

#[cfg(test)]
const SELECT_HOURLY_FORECAST_RANGE_SQL: &str = r#"
SELECT
  forecast_at_utc,
  weather_code,
  temperature_c,
  temperature_apparent_c,
  is_day,
  precipitation_mm,
  rain_mm,
  snowfall_cm,
  relative_humidity_pct,
  wind_speed_kmh,
  wind_gusts_kmh,
  wind_direction_deg,
  pressure_msl_hpa,
  cloud_cover_pct
FROM service_weather.hourly_weather_forecasts
WHERE latitude = $1
  AND longitude = $2
  AND forecast_at_utc >= $3
  AND forecast_at_utc <= $4
ORDER BY forecast_at_utc ASC
"#;

#[derive(Clone)]
pub struct WeatherSnapshotRepository {
    client: Arc<Client>,
}

impl WeatherSnapshotRepository {
    pub async fn connect(database_url: &str) -> Result<Self, ApiError> {
        let db_target = redact_database_target(database_url);
        let mut attempt = 1_usize;
        let (client, connection) = loop {
            match tokio_postgres::connect(database_url, NoTls).await {
                Ok(connected) => break connected,
                Err(error) if attempt < DB_CONNECT_MAX_ATTEMPTS => {
                    warn!(
                        attempt,
                        max_attempts = DB_CONNECT_MAX_ATTEMPTS,
                        retry_delay_seconds = DB_CONNECT_RETRY_DELAY.as_secs(),
                        database_target = %db_target,
                        error = %error,
                        error_debug = ?error,
                        "Failed to connect to PostgreSQL database; retrying"
                    );
                    tokio::time::sleep(DB_CONNECT_RETRY_DELAY).await;
                    attempt += 1;
                }
                Err(error) => {
                    return Err(ApiError::Internal(format!(
                        "Failed to connect to PostgreSQL database ({db_target}) after {attempt} attempts: {error}"
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
            database_target = %db_target,
            "Connected to PostgreSQL for weather data persistence"
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

    pub async fn load_current_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<Option<WeatherSnapshotResponse>, ApiError> {
        let row = self
            .client
            .query_opt(
                SELECT_CURRENT_WEATHER_SQL,
                &[&location.latitude, &location.longitude],
            )
            .await
            .map_err(|error| {
                ApiError::Internal(format!(
                    "Failed to load current weather snapshot for location ({}, {}, {}): {error}",
                    location.latitude, location.longitude, location.timezone
                ))
            })?;

        let Some(row) = row else {
            return Ok(None);
        };

        let current_payload: serde_json::Value = row.get("current_payload");
        let current = serde_json::from_value(current_payload).map_err(|error| {
            ApiError::Internal(format!(
                "Failed to deserialize stored current weather payload: {error}"
            ))
        })?;
        let timezone: String = row.get("timezone");
        let source_time: String = row.get("source_time");
        let fetched_at: DateTime<Utc> = row.get("fetched_at");

        Ok(Some(WeatherSnapshotResponse {
            location: WeatherLocationPayload {
                latitude: location.latitude,
                longitude: location.longitude,
                timezone,
            },
            current,
            meta: WeatherMetaPayload {
                provider: "open-meteo".to_string(),
                model: "dwd-icon".to_string(),
                fetched_at,
                source_time,
            },
        }))
    }

    pub async fn upsert_hourly_forecast(
        &self,
        forecast: &WeatherForecastResponse,
    ) -> Result<(), ApiError> {
        let latitude = forecast.location.latitude;
        let longitude = forecast.location.longitude;
        let timezone = forecast.location.timezone.clone();
        let current_utc_hour = current_utc_hour()?;
        let mut changed_rows = 0_u64;

        for point in &forecast.hourly {
            let affected_rows = self
                .client
                .execute(
                    UPSERT_HOURLY_FORECAST_SQL,
                    &[
                        &latitude,
                        &longitude,
                        &timezone,
                        &point.forecast_at,
                        &point.weather_code,
                        &point.temperature_c,
                        &point.temperature_apparent_c,
                        &point.is_day,
                        &point.precipitation_mm,
                        &point.rain_mm,
                        &point.snowfall_cm,
                        &point.relative_humidity_pct,
                        &point.wind_speed_kmh,
                        &point.wind_gusts_kmh,
                        &point.wind_direction_deg,
                        &point.pressure_msl_hpa,
                        &point.cloud_cover_pct,
                        &forecast.meta.provider,
                        &forecast.meta.model,
                        &forecast.meta.fetched_at,
                        &current_utc_hour,
                    ],
                )
                .await
                .map_err(|error| {
                    ApiError::Internal(format!(
                        "Failed to upsert hourly forecast row for location ({}, {}, {}) and hour {}: {error}",
                        latitude, longitude, timezone, point.forecast_at
                    ))
                })?;

            changed_rows += affected_rows;
        }

        info!(
            lat = latitude,
            lon = longitude,
            timezone = %timezone,
            hourly_points = forecast.hourly.len(),
            changed_rows,
            "Persisted hourly weather forecast"
        );

        Ok(())
    }

    #[cfg(test)]
    pub async fn load_hourly_forecast_range(
        &self,
        location: &WeatherLocationQuery,
        start_inclusive: DateTime<Utc>,
        end_inclusive: DateTime<Utc>,
    ) -> Result<Vec<HourlyWeatherPayload>, ApiError> {
        let rows = self
            .client
            .query(
                SELECT_HOURLY_FORECAST_RANGE_SQL,
                &[
                    &location.latitude,
                    &location.longitude,
                    &start_inclusive,
                    &end_inclusive,
                ],
            )
            .await
            .map_err(|error| {
                ApiError::Internal(format!(
                    "Failed to load hourly forecast range for location ({}, {}, {}) and range {}..{}: {error}",
                    location.latitude,
                    location.longitude,
                    location.timezone,
                    start_inclusive,
                    end_inclusive
                ))
            })?;

        let hourly = rows
            .into_iter()
            .map(|row| HourlyWeatherPayload {
                forecast_at: row.get("forecast_at_utc"),
                weather_code: row.get("weather_code"),
                temperature_c: row.get("temperature_c"),
                temperature_apparent_c: row.get("temperature_apparent_c"),
                is_day: row.get("is_day"),
                precipitation_mm: row.get("precipitation_mm"),
                rain_mm: row.get("rain_mm"),
                snowfall_cm: row.get("snowfall_cm"),
                relative_humidity_pct: row.get("relative_humidity_pct"),
                wind_speed_kmh: row.get("wind_speed_kmh"),
                wind_gusts_kmh: row.get("wind_gusts_kmh"),
                wind_direction_deg: row.get("wind_direction_deg"),
                pressure_msl_hpa: row.get("pressure_msl_hpa"),
                cloud_cover_pct: row.get("cloud_cover_pct"),
            })
            .collect::<Vec<_>>();

        info!(
            lat = location.latitude,
            lon = location.longitude,
            timezone = %location.timezone,
            hourly_points = hourly.len(),
            range_start = %start_inclusive,
            range_end = %end_inclusive,
            "Loaded hourly weather forecast range"
        );

        Ok(hourly)
    }

    pub async fn load_hourly_forecast_snapshot(
        &self,
        location: &WeatherLocationQuery,
        start_inclusive: DateTime<Utc>,
        end_inclusive: DateTime<Utc>,
    ) -> Result<Option<WeatherForecastResponse>, ApiError> {
        let rows = self
            .client
            .query(
                SELECT_HOURLY_FORECAST_SNAPSHOT_SQL,
                &[
                    &location.latitude,
                    &location.longitude,
                    &start_inclusive,
                    &end_inclusive,
                ],
            )
            .await
            .map_err(|error| {
                ApiError::Internal(format!(
                    "Failed to load hourly forecast snapshot for location ({}, {}, {}) and range {}..{}: {error}",
                    location.latitude,
                    location.longitude,
                    location.timezone,
                    start_inclusive,
                    end_inclusive
                ))
            })?;

        let Some(first_row) = rows.first() else {
            return Ok(None);
        };

        let timezone: String = first_row.get("timezone");
        let provider: String = first_row.get("provider");
        let model: String = first_row.get("model");
        let fetched_at = rows
            .iter()
            .map(|row| row.get::<_, DateTime<Utc>>("fetched_at"))
            .max()
            .unwrap_or_else(Utc::now);
        let hourly = rows
            .iter()
            .map(|row| HourlyWeatherPayload {
                forecast_at: row.get("forecast_at_utc"),
                weather_code: row.get("weather_code"),
                temperature_c: row.get("temperature_c"),
                temperature_apparent_c: row.get("temperature_apparent_c"),
                is_day: row.get("is_day"),
                precipitation_mm: row.get("precipitation_mm"),
                rain_mm: row.get("rain_mm"),
                snowfall_cm: row.get("snowfall_cm"),
                relative_humidity_pct: row.get("relative_humidity_pct"),
                wind_speed_kmh: row.get("wind_speed_kmh"),
                wind_gusts_kmh: row.get("wind_gusts_kmh"),
                wind_direction_deg: row.get("wind_direction_deg"),
                pressure_msl_hpa: row.get("pressure_msl_hpa"),
                cloud_cover_pct: row.get("cloud_cover_pct"),
            })
            .collect::<Vec<_>>();

        Ok(Some(WeatherForecastResponse {
            location: WeatherLocationPayload {
                latitude: location.latitude,
                longitude: location.longitude,
                timezone,
            },
            hourly,
            meta: WeatherForecastMetaPayload {
                provider,
                model,
                fetched_at,
            },
        }))
    }
}

fn redact_database_target(database_url: &str) -> String {
    let parsed = match database_url.parse::<tokio_postgres::Config>() {
        Ok(config) => config,
        Err(_) => return "<invalid database url>".to_string(),
    };

    let host = parsed
        .get_hosts()
        .first()
        .map(|value| match value {
            Host::Tcp(host) => host.clone(),
            Host::Unix(path) => path.display().to_string(),
        })
        .unwrap_or_else(|| "<unknown-host>".to_string());
    let port = parsed.get_ports().first().copied().unwrap_or(5432);
    let database = parsed.get_dbname().unwrap_or("<unknown-db>");

    format!("{host}:{port}/{database}")
}

fn current_utc_hour() -> Result<DateTime<Utc>, ApiError> {
    Utc::now()
        .with_minute(0)
        .and_then(|value| value.with_second(0))
        .and_then(|value| value.with_nanosecond(0))
        .ok_or_else(|| ApiError::Internal("Failed to round current UTC time to hour".to_string()))
}

#[async_trait::async_trait]
impl WeatherDataStore for WeatherSnapshotRepository {
    async fn upsert_current_snapshot(
        &self,
        snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError> {
        WeatherSnapshotRepository::upsert_current_snapshot(self, snapshot).await
    }

    async fn upsert_hourly_forecast(
        &self,
        forecast: &WeatherForecastResponse,
    ) -> Result<(), ApiError> {
        WeatherSnapshotRepository::upsert_hourly_forecast(self, forecast).await
    }

    async fn load_current_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<Option<WeatherSnapshotResponse>, ApiError> {
        WeatherSnapshotRepository::load_current_snapshot(self, location).await
    }

    async fn load_hourly_forecast_snapshot(
        &self,
        location: &WeatherLocationQuery,
        start_inclusive: DateTime<Utc>,
        end_inclusive: DateTime<Utc>,
    ) -> Result<Option<WeatherForecastResponse>, ApiError> {
        WeatherSnapshotRepository::load_hourly_forecast_snapshot(
            self,
            location,
            start_inclusive,
            end_inclusive,
        )
        .await
    }

    #[cfg(test)]
    async fn load_hourly_forecast_range(
        &self,
        location: &WeatherLocationQuery,
        start_inclusive: DateTime<Utc>,
        end_inclusive: DateTime<Utc>,
    ) -> Result<Vec<HourlyWeatherPayload>, ApiError> {
        WeatherSnapshotRepository::load_hourly_forecast_range(
            self,
            location,
            start_inclusive,
            end_inclusive,
        )
        .await
    }
}

#[cfg(test)]
#[path = "repository_tests.rs"]
mod tests;
