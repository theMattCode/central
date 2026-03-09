use std::{sync::Arc, time::Duration};

use chrono::Utc;
use reqwest::Client;
use serde::Deserialize;

use crate::{
    error::ApiError,
    weather::model::{
        CurrentWeatherPayload, WeatherLocationPayload, WeatherLocationQuery, WeatherMetaPayload,
        WeatherSnapshotResponse,
    },
};

const CURRENT_WEATHER_FIELDS: &str =
    "weather_code,temperature_2m,apparent_temperature,is_day,precipitation,relative_humidity_2m,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover";

#[derive(Clone)]
pub struct OpenMeteoClient {
    base_url: Arc<str>,
    http: Client,
}

impl OpenMeteoClient {
    pub fn new(base_url: String, timeout: Duration) -> Result<Self, ApiError> {
        let http = Client::builder()
            .timeout(timeout)
            .build()
            .map_err(|error| {
                ApiError::Internal(format!("Failed to initialize HTTP client: {error}"))
            })?;

        Ok(Self {
            base_url: Arc::from(base_url.trim_end_matches('/').to_string()),
            http,
        })
    }

    pub async fn fetch_weather_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
        let url = format!("{}/v1/dwd-icon", self.base_url);

        let response = self
            .http
            .get(&url)
            .query(&[
                ("latitude", location.latitude.to_string()),
                ("longitude", location.longitude.to_string()),
                ("timezone", location.timezone.clone()),
                ("current", CURRENT_WEATHER_FIELDS.to_string()),
            ])
            .send()
            .await
            .map_err(|error| ApiError::Upstream(format!("Open-Meteo request failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<unable to read error body>".to_string());
            return Err(ApiError::Upstream(format!(
                "Open-Meteo returned HTTP {status}: {body}"
            )));
        }

        let payload: OpenMeteoResponse = response.json().await.map_err(|error| {
            ApiError::Upstream(format!("Invalid Open-Meteo JSON response: {error}"))
        })?;

        let current = payload.current.ok_or_else(|| {
            ApiError::Upstream("Open-Meteo response is missing current weather.".to_string())
        })?;

        Ok(WeatherSnapshotResponse {
            location: WeatherLocationPayload {
                latitude: payload.latitude,
                longitude: payload.longitude,
                timezone: payload.timezone,
            },
            current: CurrentWeatherPayload {
                weather_code: current.weather_code,
                temperature_c: current.temperature_2m,
                temperature_apparent_c: current.apparent_temperature,
                is_day: current.is_day == 1,
                precipitation: current.precipitation,
                wind_speed: current.wind_speed_10m,
                wind_direction: current.wind_direction_10m,
                relative_humidity: current.relative_humidity_2m,
                pressure: current.pressure_msl,
                cloud_cover: current.cloud_cover,
            },
            meta: WeatherMetaPayload {
                provider: "open-meteo".to_string(),
                model: "dwd-icon".to_string(),
                fetched_at: Utc::now(),
                source_time: current.time,
            },
        })
    }
}

#[derive(Debug, Deserialize)]
struct OpenMeteoResponse {
    latitude: f64,
    longitude: f64,
    timezone: String,
    current: Option<OpenMeteoCurrent>,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoCurrent {
    time: String,
    weather_code: i32,
    temperature_2m: f64,
    apparent_temperature: f64,
    is_day: i32,
    precipitation: f64,
    relative_humidity_2m: f64,
    wind_speed_10m: f64,
    wind_direction_10m: f64,
    pressure_msl: f64,
    cloud_cover: f64,
}
