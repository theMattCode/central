use async_trait::async_trait;

use crate::error::ApiError;
use crate::domains::weather::model::{
  WeatherForecastResponse, WeatherLocationQuery, WeatherSnapshotResponse,
};

#[async_trait]
pub trait WeatherDataFetcher: Send + Sync {
    async fn fetch_weather_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError>;

    async fn fetch_hourly_forecast(
        &self,
        location: &WeatherLocationQuery,
        hours_past: u16,
        hours_future: u16,
    ) -> Result<WeatherForecastResponse, ApiError>;
}

#[async_trait]
pub trait WeatherDataStore: Send + Sync {
    async fn upsert_current_snapshot(
        &self,
        snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError>;

    async fn load_current_snapshot(
        &self,
        _location: &WeatherLocationQuery,
    ) -> Result<Option<WeatherSnapshotResponse>, ApiError> {
        Ok(None)
    }

    async fn upsert_hourly_forecast(
        &self,
        forecast: &WeatherForecastResponse,
    ) -> Result<(), ApiError>;

    async fn load_hourly_forecast_snapshot(
        &self,
        _location: &WeatherLocationQuery,
        _start_inclusive: chrono::DateTime<chrono::Utc>,
        _end_inclusive: chrono::DateTime<chrono::Utc>,
    ) -> Result<Option<WeatherForecastResponse>, ApiError> {
        Ok(None)
    }

    #[cfg(test)]
    async fn load_hourly_forecast_range(
        &self,
        location: &WeatherLocationQuery,
        start_inclusive: chrono::DateTime<chrono::Utc>,
        end_inclusive: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<crate::domains::weather::model::HourlyWeatherPayload>, ApiError>;
}
