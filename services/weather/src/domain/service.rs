use std::sync::Arc;

use tracing::{info, warn};

use crate::{
    domain::{
        contracts::{WeatherSnapshotFetcher, WeatherSnapshotStore},
        model::{WeatherLocationQuery, WeatherSnapshotResponse},
    },
    error::ApiError,
};

#[derive(Clone)]
pub struct WeatherSnapshotService {
    fetcher: Arc<dyn WeatherSnapshotFetcher>,
    store: Arc<dyn WeatherSnapshotStore>,
}

impl WeatherSnapshotService {
    pub fn new(
        fetcher: Arc<dyn WeatherSnapshotFetcher>,
        store: Arc<dyn WeatherSnapshotStore>,
    ) -> Self {
        Self { fetcher, store }
    }

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
}

#[cfg(test)]
#[path = "service_tests.rs"]
mod tests;
