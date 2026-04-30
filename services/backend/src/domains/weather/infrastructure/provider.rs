use std::{sync::Arc, time::Duration};

use chrono::{DateTime, LocalResult, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use reqwest::Client;
use serde::Deserialize;
use tracing::{info, warn};

use crate::{
    domains::weather::domain::{
        contracts::WeatherDataFetcher,
        model::{
            CurrentWeatherPayload, HourlyWeatherPayload, WeatherForecastMetaPayload,
            WeatherForecastResponse, WeatherLocationPayload, WeatherLocationQuery,
            WeatherMetaPayload, WeatherSnapshotResponse,
        },
    },
    error::ApiError,
};

const OPEN_METEO_PROVIDER: &str = "open-meteo";
const OPEN_METEO_MODEL: &str = "dwd-icon";
const CURRENT_WEATHER_FIELDS: &str =
    "weather_code,temperature_2m,apparent_temperature,is_day,precipitation,relative_humidity_2m,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover";
const FORECAST_HOURLY_FIELDS: &str =
  "weather_code,temperature_2m,apparent_temperature,is_day,precipitation,rain,snowfall,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,cloud_cover";

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
        let payload = self
            .request_open_meteo(
                location,
                vec![("current", CURRENT_WEATHER_FIELDS.to_string())],
            )
            .await?;

        let current = payload.current.ok_or_else(|| {
            ApiError::Upstream("Open-Meteo response is missing current weather.".to_string())
        })?;

        let snapshot = WeatherSnapshotResponse {
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
                provider: OPEN_METEO_PROVIDER.to_string(),
                model: OPEN_METEO_MODEL.to_string(),
                fetched_at: Utc::now(),
                source_time: current.time,
            },
        };

        info!(
            lat = snapshot.location.latitude,
            lon = snapshot.location.longitude,
            timezone = %snapshot.location.timezone,
            source_time = %snapshot.meta.source_time,
            "Fetched weather snapshot from Open-Meteo"
        );

        Ok(snapshot)
    }

    pub async fn fetch_hourly_forecast(
        &self,
        location: &WeatherLocationQuery,
        hours_past: u16,
        hours_future: u16,
    ) -> Result<WeatherForecastResponse, ApiError> {
        let payload = self
            .request_open_meteo(
                location,
                vec![
                    ("hourly", FORECAST_HOURLY_FIELDS.to_string()),
                    ("timeformat", "unixtime".to_string()),
                    ("past_hours", hours_past.to_string()),
                    ("forecast_hours", hours_future.to_string()),
                ],
            )
            .await?;

        let hourly = payload.hourly.ok_or_else(|| {
            ApiError::Upstream("Open-Meteo response is missing hourly forecast.".to_string())
        })?;
        let mapped_hourly = map_hourly_forecast(hourly, &payload.timezone)?;

        let forecast = WeatherForecastResponse {
            location: WeatherLocationPayload {
                latitude: payload.latitude,
                longitude: payload.longitude,
                timezone: payload.timezone,
            },
            hourly: mapped_hourly,
            meta: WeatherForecastMetaPayload {
                provider: OPEN_METEO_PROVIDER.to_string(),
                model: OPEN_METEO_MODEL.to_string(),
                fetched_at: Utc::now(),
            },
        };

        info!(
            lat = forecast.location.latitude,
            lon = forecast.location.longitude,
            timezone = %forecast.location.timezone,
            hours_past,
            hours_future,
            received = forecast.hourly.len(),
            "Fetched hourly forecast from Open-Meteo"
        );

        Ok(forecast)
    }

    async fn request_open_meteo(
        &self,
        location: &WeatherLocationQuery,
        mut extra_query: Vec<(&str, String)>,
    ) -> Result<OpenMeteoResponse, ApiError> {
        let url = format!("{}/v1/dwd-icon", self.base_url);
        let latitude = location.latitude;
        let longitude = location.longitude;
        let timezone = location.timezone.clone();

        extra_query.push(("latitude", latitude.to_string()));
        extra_query.push(("longitude", longitude.to_string()));
        extra_query.push(("timezone", timezone.clone()));

        let request = self
            .http
            .get(&url)
            .query(&extra_query)
            .build()
            .map_err(|error| {
                ApiError::Upstream(format!("Failed to build Open-Meteo request: {error}"))
            })?;

        info!(url = %request.url(),"Requesting Open-Meteo forecast data");

        let response =
            self.http.execute(request).await.map_err(|error| {
                ApiError::Upstream(format!("Open-Meteo request failed: {error}"))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<unable to read error body>".to_string());
            warn!(
                lat = latitude,
                lon = longitude,
                timezone = %timezone,
                status = %status,
                body = %body,
                "Open-Meteo returned a non-success response"
            );
            return Err(ApiError::Upstream(format!(
                "Open-Meteo returned HTTP {status}: {body}"
            )));
        }

        let body = response.text().await.map_err(|error| {
            ApiError::Upstream(format!("Failed to read Open-Meteo response body: {error}"))
        })?;

        if let Ok(error_payload) = serde_json::from_str::<OpenMeteoErrorResponse>(&body) {
            if error_payload.error.unwrap_or(false) {
                let reason = error_payload
                    .reason
                    .unwrap_or_else(|| truncate_body(&body, 400));
                return Err(ApiError::Upstream(format!(
                    "Open-Meteo returned error payload: {reason}"
                )));
            }
        }

        serde_json::from_str::<OpenMeteoResponse>(&body).map_err(|error| {
            ApiError::Upstream(format!(
                "Invalid Open-Meteo JSON response: {error}; body={}",
                truncate_body(&body, 400)
            ))
        })
    }
}

fn map_hourly_forecast(
    hourly: OpenMeteoHourly,
    timezone: &str,
) -> Result<Vec<HourlyWeatherPayload>, ApiError> {
    let expected_len = hourly.time.len();
    if expected_len == 0 {
        return Err(ApiError::Upstream(
            "Open-Meteo response contains an empty hourly forecast.".to_string(),
        ));
    }

    assert_series_length("weather_code", expected_len, hourly.weather_code.len())?;
    assert_series_length("temperature_2m", expected_len, hourly.temperature_2m.len())?;
    assert_series_length(
        "apparent_temperature",
        expected_len,
        hourly.apparent_temperature.len(),
    )?;
    assert_series_length("is_day", expected_len, hourly.is_day.len())?;
    assert_series_length("precipitation", expected_len, hourly.precipitation.len())?;
    assert_series_length("rain", expected_len, hourly.rain.len())?;
    assert_series_length("snowfall", expected_len, hourly.snowfall.len())?;
    assert_series_length(
        "relative_humidity_2m",
        expected_len,
        hourly.relative_humidity_2m.len(),
    )?;
    assert_series_length("wind_speed_10m", expected_len, hourly.wind_speed_10m.len())?;
    assert_series_length("wind_gusts_10m", expected_len, hourly.wind_gusts_10m.len())?;
    assert_series_length(
        "wind_direction_10m",
        expected_len,
        hourly.wind_direction_10m.len(),
    )?;
    assert_series_length("pressure_msl", expected_len, hourly.pressure_msl.len())?;
    assert_series_length("cloud_cover", expected_len, hourly.cloud_cover.len())?;

    let mut mapped = Vec::with_capacity(expected_len);
    let mut dropped_points = 0usize;
    for index in 0..expected_len {
        let missing_fields = missing_hourly_fields(&hourly, index);
        if !missing_fields.is_empty() {
            dropped_points += 1;
            warn!(
                index,
                missing_fields = ?missing_fields,
                time = ?hourly.time[index],
                weather_code = ?hourly.weather_code[index],
                temperature_2m = ?hourly.temperature_2m[index],
                apparent_temperature = ?hourly.apparent_temperature[index],
                is_day = ?hourly.is_day[index],
                precipitation = ?hourly.precipitation[index],
                rain = ?hourly.rain[index],
                snowfall = ?hourly.snowfall[index],
                relative_humidity_2m = ?hourly.relative_humidity_2m[index],
                wind_speed_10m = ?hourly.wind_speed_10m[index],
                wind_gusts_10m = ?hourly.wind_gusts_10m[index],
                wind_direction_10m = ?hourly.wind_direction_10m[index],
                pressure_msl = ?hourly.pressure_msl[index],
                cloud_cover = ?hourly.cloud_cover[index],
                "Skipping hourly forecast row with null field values; logging full upstream row"
            );
            continue;
        }

        let forecast_at = parse_hourly_timestamp(&hourly.time[index], timezone, index)?;

        mapped.push(HourlyWeatherPayload {
            forecast_at,
            weather_code: required_series_value(&hourly.weather_code, index, "weather_code"),
            temperature_c: required_series_value(&hourly.temperature_2m, index, "temperature_2m"),
            temperature_apparent_c: required_series_value(
                &hourly.apparent_temperature,
                index,
                "apparent_temperature",
            ),
            is_day: required_series_value(&hourly.is_day, index, "is_day") == 1,
            precipitation_mm: required_series_value(&hourly.precipitation, index, "precipitation"),
            rain_mm: required_series_value(&hourly.rain, index, "rain"),
            snowfall_cm: required_series_value(&hourly.snowfall, index, "snowfall"),
            relative_humidity_pct: required_series_value(
                &hourly.relative_humidity_2m,
                index,
                "relative_humidity_2m",
            ),
            wind_speed_kmh: required_series_value(&hourly.wind_speed_10m, index, "wind_speed_10m"),
            wind_gusts_kmh: required_series_value(&hourly.wind_gusts_10m, index, "wind_gusts_10m"),
            wind_direction_deg: required_series_value(
                &hourly.wind_direction_10m,
                index,
                "wind_direction_10m",
            ),
            pressure_msl_hpa: required_series_value(&hourly.pressure_msl, index, "pressure_msl"),
            cloud_cover_pct: required_series_value(&hourly.cloud_cover, index, "cloud_cover"),
        });
    }

    if mapped.is_empty() {
        return Err(ApiError::Upstream(
            "Open-Meteo response contains no usable hourly forecast points.".to_string(),
        ));
    }

    if dropped_points > 0 {
        warn!(
            dropped_points,
            total_points = expected_len,
            usable_points = mapped.len(),
            "Dropped hourly forecast rows containing null values"
        );
    }

    Ok(mapped)
}

fn parse_hourly_timestamp(
    value: &OpenMeteoTimeValue,
    timezone: &str,
    index: usize,
) -> Result<DateTime<Utc>, ApiError> {
    match value {
    OpenMeteoTimeValue::Unix(timestamp) => {
      DateTime::<Utc>::from_timestamp(*timestamp, 0).ok_or_else(|| {
        ApiError::Upstream(format!(
          "Open-Meteo response contains an invalid unix hourly timestamp at index {index}: {timestamp}"
        ))
      })
    }
    OpenMeteoTimeValue::Iso(raw) => {
      if let Ok(parsed) = DateTime::parse_from_rfc3339(raw) {
        return Ok(parsed.with_timezone(&Utc));
      }

      let naive = NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M"))
        .map_err(|error| {
          ApiError::Upstream(format!(
            "Open-Meteo response contains an invalid ISO hourly timestamp at index {index}: '{raw}' ({error})"
          ))
        })?;

      let tz = timezone.parse::<Tz>().unwrap_or(chrono_tz::UTC);
      match tz.from_local_datetime(&naive) {
        LocalResult::Single(parsed) => Ok(parsed.with_timezone(&Utc)),
        LocalResult::Ambiguous(first, _) => Ok(first.with_timezone(&Utc)),
        LocalResult::None => Err(ApiError::Upstream(format!(
          "Open-Meteo timestamp '{raw}' at index {index} is not valid in timezone '{timezone}'."
        ))),
      }
    }
  }
}

fn truncate_body(body: &str, max_chars: usize) -> String {
    let normalized = body.replace('\n', " ");
    if normalized.chars().count() <= max_chars {
        return normalized;
    }

    let mut truncated = normalized.chars().take(max_chars).collect::<String>();
    truncated.push_str("...");
    truncated
}

fn assert_series_length(name: &str, expected: usize, actual: usize) -> Result<(), ApiError> {
    if actual != expected {
        return Err(ApiError::Upstream(format!(
      "Open-Meteo hourly forecast field '{name}' length mismatch: expected {expected}, got {actual}."
    )));
    }

    Ok(())
}

fn missing_hourly_fields(hourly: &OpenMeteoHourly, index: usize) -> Vec<&'static str> {
    let mut missing_fields = Vec::new();

    if hourly.weather_code[index].is_none() {
        missing_fields.push("weather_code");
    }
    if hourly.temperature_2m[index].is_none() {
        missing_fields.push("temperature_2m");
    }
    if hourly.apparent_temperature[index].is_none() {
        missing_fields.push("apparent_temperature");
    }
    if hourly.is_day[index].is_none() {
        missing_fields.push("is_day");
    }
    if hourly.precipitation[index].is_none() {
        missing_fields.push("precipitation");
    }
    if hourly.rain[index].is_none() {
        missing_fields.push("rain");
    }
    if hourly.snowfall[index].is_none() {
        missing_fields.push("snowfall");
    }
    if hourly.relative_humidity_2m[index].is_none() {
        missing_fields.push("relative_humidity_2m");
    }
    if hourly.wind_speed_10m[index].is_none() {
        missing_fields.push("wind_speed_10m");
    }
    if hourly.wind_gusts_10m[index].is_none() {
        missing_fields.push("wind_gusts_10m");
    }
    if hourly.wind_direction_10m[index].is_none() {
        missing_fields.push("wind_direction_10m");
    }
    if hourly.pressure_msl[index].is_none() {
        missing_fields.push("pressure_msl");
    }
    if hourly.cloud_cover[index].is_none() {
        missing_fields.push("cloud_cover");
    }

    missing_fields
}

fn required_series_value<T: Copy>(values: &[Option<T>], index: usize, name: &str) -> T {
    values[index].unwrap_or_else(|| {
        unreachable!("hourly field '{name}' at index {index} should have been validated")
    })
}

#[async_trait::async_trait]
impl WeatherDataFetcher for OpenMeteoClient {
    async fn fetch_weather_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
        OpenMeteoClient::fetch_weather_snapshot(self, location).await
    }

    async fn fetch_hourly_forecast(
        &self,
        location: &WeatherLocationQuery,
        hours_past: u16,
        hours_future: u16,
    ) -> Result<WeatherForecastResponse, ApiError> {
        OpenMeteoClient::fetch_hourly_forecast(self, location, hours_past, hours_future).await
    }
}

#[derive(Debug, Deserialize)]
struct OpenMeteoResponse {
    latitude: f64,
    longitude: f64,
    timezone: String,
    current: Option<OpenMeteoCurrent>,
    hourly: Option<OpenMeteoHourly>,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoErrorResponse {
    error: Option<bool>,
    reason: Option<String>,
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

#[derive(Debug, Deserialize)]
struct OpenMeteoHourly {
    time: Vec<OpenMeteoTimeValue>,
    weather_code: Vec<Option<i32>>,
    temperature_2m: Vec<Option<f64>>,
    apparent_temperature: Vec<Option<f64>>,
    is_day: Vec<Option<i32>>,
    precipitation: Vec<Option<f64>>,
    rain: Vec<Option<f64>>,
    snowfall: Vec<Option<f64>>,
    relative_humidity_2m: Vec<Option<f64>>,
    wind_speed_10m: Vec<Option<f64>>,
    wind_gusts_10m: Vec<Option<f64>>,
    wind_direction_10m: Vec<Option<f64>>,
    pressure_msl: Vec<Option<f64>>,
    cloud_cover: Vec<Option<f64>>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum OpenMeteoTimeValue {
    Unix(i64),
    Iso(String),
}

#[cfg(test)]
#[path = "provider_tests.rs"]
mod tests;
