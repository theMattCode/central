use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

pub const DEFAULT_FORECAST_HOURS_PAST: u16 = 1;
pub const DEFAULT_FORECAST_HOURS_FUTURE: u16 = 24 * 7;
pub const MAX_FORECAST_HOURS_PAST: u16 = 720;
pub const MAX_FORECAST_HOURS_FUTURE: u16 = 384;

#[derive(Debug, Deserialize, Clone)]
pub struct WeatherQueryInput {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub timezone: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct WeatherForecastQueryInput {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub timezone: Option<String>,
    #[serde(rename = "hoursPast", alias = "hours_past")]
    pub hours_past: Option<u16>,
    #[serde(rename = "hoursFuture", alias = "hours_future")]
    pub hours_future: Option<u16>,
}

#[derive(Debug, Clone)]
pub struct WeatherLocationQuery {
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
}

#[derive(Debug, Clone)]
pub struct WeatherForecastQuery {
    pub location: WeatherLocationQuery,
    pub hours_past: u16,
    pub hours_future: u16,
}

impl WeatherQueryInput {
    pub fn into_location(self) -> Result<WeatherLocationQuery, ApiError> {
        let latitude = self.lat.ok_or_else(|| {
            ApiError::BadRequest("Missing required query parameter: lat".to_string())
        })?;
        let longitude = self.lon.ok_or_else(|| {
            ApiError::BadRequest("Missing required query parameter: lon".to_string())
        })?;

        if !(-90.0..=90.0).contains(&latitude) {
            return Err(ApiError::BadRequest(
                "Query parameter lat must be within -90..90".to_string(),
            ));
        }

        if !(-180.0..=180.0).contains(&longitude) {
            return Err(ApiError::BadRequest(
                "Query parameter lon must be within -180..180".to_string(),
            ));
        }

        let timezone = self
            .timezone
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "auto".to_string());

        Ok(WeatherLocationQuery {
            latitude,
            longitude,
            timezone,
        })
    }
}

impl WeatherForecastQueryInput {
    pub fn into_forecast_query(self) -> Result<WeatherForecastQuery, ApiError> {
        let location = WeatherQueryInput {
            lat: self.lat,
            lon: self.lon,
            timezone: self.timezone,
        }
        .into_location()?;

        let hours_past = self.hours_past.unwrap_or(DEFAULT_FORECAST_HOURS_PAST);
        let hours_future = self.hours_future.unwrap_or(DEFAULT_FORECAST_HOURS_FUTURE);

        if hours_past > MAX_FORECAST_HOURS_PAST {
            return Err(ApiError::BadRequest(format!(
                "Query parameter hoursPast must be within 0..{}",
                MAX_FORECAST_HOURS_PAST
            )));
        }

        if hours_future > MAX_FORECAST_HOURS_FUTURE {
            return Err(ApiError::BadRequest(format!(
                "Query parameter hoursFuture must be within 0..{}",
                MAX_FORECAST_HOURS_FUTURE
            )));
        }

        if hours_past == 0 && hours_future == 0 {
            return Err(ApiError::BadRequest(
                "At least one of hoursPast or hoursFuture must be greater than 0".to_string(),
            ));
        }

        Ok(WeatherForecastQuery {
            location,
            hours_past,
            hours_future,
        })
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeatherSnapshotResponse {
    pub location: WeatherLocationPayload,
    pub current: CurrentWeatherPayload,
    pub meta: WeatherMetaPayload,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeatherForecastResponse {
    pub location: WeatherLocationPayload,
    pub hourly: Vec<HourlyWeatherPayload>,
    pub meta: WeatherForecastMetaPayload,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeatherLocationPayload {
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurrentWeatherPayload {
    pub weather_code: i32,
    pub temperature_c: f64,
    pub temperature_apparent_c: f64,
    pub is_day: bool,
    pub precipitation: f64,
    pub wind_speed: f64,
    pub wind_direction: f64,
    pub relative_humidity: f64,
    pub pressure: f64,
    pub cloud_cover: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HourlyWeatherPayload {
    pub forecast_at: DateTime<Utc>,
    pub weather_code: i32,
    pub temperature_c: f64,
    pub temperature_apparent_c: f64,
    pub is_day: bool,
    pub precipitation_mm: f64,
    pub rain_mm: f64,
    pub snowfall_cm: f64,
    pub relative_humidity_pct: f64,
    pub wind_speed_kmh: f64,
    pub wind_gusts_kmh: f64,
    pub wind_direction_deg: f64,
    pub pressure_msl_hpa: f64,
    pub cloud_cover_pct: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeatherMetaPayload {
    pub provider: String,
    pub model: String,
    pub fetched_at: DateTime<Utc>,
    pub source_time: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeatherForecastMetaPayload {
    pub provider: String,
    pub model: String,
    pub fetched_at: DateTime<Utc>,
}

#[cfg(test)]
#[path = "model_tests.rs"]
mod tests;
