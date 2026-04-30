use std::sync::Arc;

use chrono::{DateTime, Duration as ChronoDuration, Timelike, Utc};
use tracing::{info, warn};

use crate::{
    domains::weather::domain::{
        contracts::{WeatherDataFetcher, WeatherDataStore},
        model::{WeatherForecastResponse, WeatherLocationQuery, WeatherSnapshotResponse},
    },
    error::ApiError,
};

const STALE_AFTER_MINUTES: i64 = 15;

#[derive(Clone)]
pub struct WeatherSnapshotService {
    fetcher: Arc<dyn WeatherDataFetcher>,
    store: Arc<dyn WeatherDataStore>,
    stale_after: ChronoDuration,
}

impl WeatherSnapshotService {
    pub fn new(fetcher: Arc<dyn WeatherDataFetcher>, store: Arc<dyn WeatherDataStore>) -> Self {
        Self {
            fetcher,
            store,
            stale_after: ChronoDuration::minutes(STALE_AFTER_MINUTES),
        }
    }

    pub async fn get_current_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
        let cached = self.store.load_current_snapshot(location).await?;
        if let Some(snapshot) = cached {
            if self.is_fresh(snapshot.meta.fetched_at) {
                info!(
                    lat = snapshot.location.latitude,
                    lon = snapshot.location.longitude,
                    timezone = %snapshot.location.timezone,
                    fetched_at = %snapshot.meta.fetched_at,
                    "Serving current weather snapshot from database cache"
                );
                return Ok(snapshot);
            }

            info!(
                lat = snapshot.location.latitude,
                lon = snapshot.location.longitude,
                timezone = %snapshot.location.timezone,
                fetched_at = %snapshot.meta.fetched_at,
                stale_after_minutes = STALE_AFTER_MINUTES,
                "Current weather snapshot cache is stale; fetching fresh data"
            );
        } else {
            info!(
                lat = location.latitude,
                lon = location.longitude,
                timezone = %location.timezone,
                "Current weather snapshot cache miss; fetching fresh data"
            );
        }

        let snapshot = self.fetcher.fetch_weather_snapshot(location).await?;
        self.persist_current_snapshot_async(snapshot.clone(), location.clone());

        info!(
            lat = snapshot.location.latitude,
            lon = snapshot.location.longitude,
            timezone = %snapshot.location.timezone,
            source_time = %snapshot.meta.source_time,
            "Fetched fresh current weather snapshot; persistence scheduled asynchronously"
        );

        Ok(snapshot)
    }

    pub async fn get_hourly_forecast(
        &self,
        location: &WeatherLocationQuery,
        hours_past: u16,
        hours_future: u16,
    ) -> Result<WeatherForecastResponse, ApiError> {
        let now_hour = current_utc_hour()?;
        let range_start = now_hour - ChronoDuration::hours(i64::from(hours_past));
        let range_end = now_hour + ChronoDuration::hours(i64::from(hours_future));
        let expected_points = usize::from(hours_past) + usize::from(hours_future) + 1;

        let cached = self
            .store
            .load_hourly_forecast_snapshot(location, range_start, range_end)
            .await?;
        if let Some(forecast) = cached {
            let is_complete = forecast.hourly.len() == expected_points;
            if is_complete && self.is_fresh(forecast.meta.fetched_at) {
                info!(
                    lat = forecast.location.latitude,
                    lon = forecast.location.longitude,
                    timezone = %forecast.location.timezone,
                    fetched_at = %forecast.meta.fetched_at,
                    hourly_points = forecast.hourly.len(),
                    "Serving weather forecast from database cache"
                );
                return Ok(forecast);
            }

            info!(
                lat = forecast.location.latitude,
                lon = forecast.location.longitude,
                timezone = %forecast.location.timezone,
                fetched_at = %forecast.meta.fetched_at,
                cached_points = forecast.hourly.len(),
                expected_points,
                stale_after_minutes = STALE_AFTER_MINUTES,
                "Forecast cache is stale or incomplete; fetching fresh data"
            );
        } else {
            info!(
                lat = location.latitude,
                lon = location.longitude,
                timezone = %location.timezone,
                expected_points,
                "Forecast cache miss; fetching fresh data"
            );
        }

        let forecast = self
            .fetcher
            .fetch_hourly_forecast(location, hours_past, hours_future)
            .await?;
        self.persist_forecast_async(forecast.clone(), location.clone(), hours_past, hours_future);

        info!(
            lat = forecast.location.latitude,
            lon = forecast.location.longitude,
            timezone = %forecast.location.timezone,
            hours_past,
            hours_future,
            hourly_points = forecast.hourly.len(),
            "Fetched fresh weather forecast; persistence scheduled asynchronously"
        );

        Ok(forecast)
    }

    #[cfg(test)]
    pub async fn fetch_and_store_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError> {
        let snapshot = match self.fetcher.fetch_weather_snapshot(location).await {
            Ok(snapshot) => snapshot,
            Err(error) => {
                warn!(
                    lat = location.latitude,
                    lon = location.longitude,
                    timezone = %location.timezone,
                    code = error.code(),
                    error = %error,
                    "Failed to fetch weather snapshot"
                );
                return Err(error);
            }
        };

        if let Err(error) = self.store.upsert_current_snapshot(&snapshot).await {
            warn!(
                lat = location.latitude,
                lon = location.longitude,
                timezone = %location.timezone,
                code = error.code(),
                error = %error,
                "Failed to persist weather snapshot"
            );
            return Err(error);
        }

        info!(
            lat = snapshot.location.latitude,
            lon = snapshot.location.longitude,
            timezone = %snapshot.location.timezone,
            provider = %snapshot.meta.provider,
            model = %snapshot.meta.model,
            source_time = %snapshot.meta.source_time,
            "Weather snapshot refreshed and persisted"
        );

        Ok(snapshot)
    }

    #[cfg(test)]
    pub async fn refresh_and_load_forecast(
        &self,
        location: &WeatherLocationQuery,
        hours_past: u16,
        hours_future: u16,
    ) -> Result<WeatherForecastResponse, ApiError> {
        let forecast = match self
            .fetcher
            .fetch_hourly_forecast(location, hours_past, hours_future)
            .await
        {
            Ok(forecast) => forecast,
            Err(error) => {
                warn!(
                    lat = location.latitude,
                    lon = location.longitude,
                    timezone = %location.timezone,
                    hours_past,
                    hours_future,
                    code = error.code(),
                    error = %error,
                    "Failed to fetch weather forecast"
                );
                return Err(error);
            }
        };

        if let Err(error) = self.store.upsert_hourly_forecast(&forecast).await {
            warn!(
                lat = location.latitude,
                lon = location.longitude,
                timezone = %location.timezone,
                hours_past,
                hours_future,
                code = error.code(),
                error = %error,
                "Failed to persist weather forecast"
            );
            return Err(error);
        }

        let now_hour = current_utc_hour()?;
        let range_start = now_hour - ChronoDuration::hours(i64::from(hours_past));
        let range_end = now_hour + ChronoDuration::hours(i64::from(hours_future));
        let hourly = match self
            .store
            .load_hourly_forecast_range(location, range_start, range_end)
            .await
        {
            Ok(hourly) => hourly,
            Err(error) => {
                warn!(
                    lat = location.latitude,
                    lon = location.longitude,
                    timezone = %location.timezone,
                    hours_past,
                    hours_future,
                    code = error.code(),
                    error = %error,
                    "Failed to load persisted weather forecast"
                );
                return Err(error);
            }
        };

        let response = WeatherForecastResponse {
            location: forecast.location,
            hourly,
            meta: forecast.meta,
        };

        info!(
            lat = response.location.latitude,
            lon = response.location.longitude,
            timezone = %response.location.timezone,
            provider = %response.meta.provider,
            model = %response.meta.model,
            hourly_points = response.hourly.len(),
            "Weather forecast refreshed, persisted, and loaded"
        );

        Ok(response)
    }

    fn is_fresh(&self, fetched_at: DateTime<Utc>) -> bool {
        Utc::now().signed_duration_since(fetched_at) < self.stale_after
    }

    fn persist_current_snapshot_async(
        &self,
        snapshot: WeatherSnapshotResponse,
        location: WeatherLocationQuery,
    ) {
        let store = Arc::clone(&self.store);
        tokio::spawn(async move {
            match store.upsert_current_snapshot(&snapshot).await {
                Ok(()) => info!(
                    lat = location.latitude,
                    lon = location.longitude,
                    timezone = %location.timezone,
                    source_time = %snapshot.meta.source_time,
                    "Persisted current weather snapshot asynchronously"
                ),
                Err(error) => warn!(
                    lat = location.latitude,
                    lon = location.longitude,
                    timezone = %location.timezone,
                    code = error.code(),
                    error = %error,
                    "Failed to asynchronously persist current weather snapshot"
                ),
            }
        });
    }

    fn persist_forecast_async(
        &self,
        forecast: WeatherForecastResponse,
        location: WeatherLocationQuery,
        hours_past: u16,
        hours_future: u16,
    ) {
        let store = Arc::clone(&self.store);
        tokio::spawn(async move {
            match store.upsert_hourly_forecast(&forecast).await {
                Ok(()) => info!(
                    lat = location.latitude,
                    lon = location.longitude,
                    timezone = %location.timezone,
                    hours_past,
                    hours_future,
                    hourly_points = forecast.hourly.len(),
                    "Persisted weather forecast asynchronously"
                ),
                Err(error) => warn!(
                    lat = location.latitude,
                    lon = location.longitude,
                    timezone = %location.timezone,
                    hours_past,
                    hours_future,
                    code = error.code(),
                    error = %error,
                    "Failed to asynchronously persist weather forecast"
                ),
            }
        });
    }
}

fn current_utc_hour() -> Result<DateTime<Utc>, ApiError> {
    Utc::now()
        .with_minute(0)
        .and_then(|value| value.with_second(0))
        .and_then(|value| value.with_nanosecond(0))
        .ok_or_else(|| ApiError::Internal("Failed to round current UTC time to hour".to_string()))
}

#[cfg(test)]
#[path = "service_tests.rs"]
mod tests;
