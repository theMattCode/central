use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Deserialize, Clone)]
pub struct WeatherQueryInput {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WeatherLocationQuery {
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
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

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeatherSnapshotResponse {
    pub location: WeatherLocationPayload,
    pub current: CurrentWeatherPayload,
    pub meta: WeatherMetaPayload,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WeatherLocationPayload {
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
}

#[derive(Debug, Serialize, Clone)]
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
pub struct WeatherMetaPayload {
    pub provider: String,
    pub model: String,
    pub fetched_at: DateTime<Utc>,
    pub source_time: String,
}

#[cfg(test)]
mod tests {
    use super::WeatherQueryInput;

    #[test]
    fn query_requires_lat_lon() {
        let missing_lat = WeatherQueryInput {
            lat: None,
            lon: Some(10.0),
            timezone: None,
        };

        let missing_lon = WeatherQueryInput {
            lat: Some(10.0),
            lon: None,
            timezone: None,
        };

        assert!(missing_lat.into_location().is_err());
        assert!(missing_lon.into_location().is_err());
    }

    #[test]
    fn query_validates_coordinate_ranges() {
        let invalid_lat = WeatherQueryInput {
            lat: Some(100.0),
            lon: Some(10.0),
            timezone: None,
        };

        let invalid_lon = WeatherQueryInput {
            lat: Some(10.0),
            lon: Some(200.0),
            timezone: None,
        };

        assert!(invalid_lat.into_location().is_err());
        assert!(invalid_lon.into_location().is_err());
    }

    #[test]
    fn query_defaults_timezone_to_auto() {
        let query = WeatherQueryInput {
            lat: Some(48.4057),
            lon: Some(9.0542),
            timezone: None,
        };

        let location = query.into_location().expect("query should be valid");
        assert_eq!(location.timezone, "auto");
    }

    #[test]
    fn query_uses_provided_timezone() {
        let query = WeatherQueryInput {
            lat: Some(48.4057),
            lon: Some(9.0542),
            timezone: Some("Europe/Berlin".to_string()),
        };

        let location = query.into_location().expect("query should be valid");
        assert_eq!(location.timezone, "Europe/Berlin");
    }
}
