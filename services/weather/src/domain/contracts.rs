use async_trait::async_trait;

use crate::{
    domain::model::{WeatherLocationQuery, WeatherSnapshotResponse},
    error::ApiError,
};

#[async_trait]
pub trait WeatherSnapshotFetcher: Send + Sync {
    async fn fetch_weather_snapshot(
        &self,
        location: &WeatherLocationQuery,
    ) -> Result<WeatherSnapshotResponse, ApiError>;
}

#[async_trait]
pub trait WeatherSnapshotStore: Send + Sync {
    async fn upsert_current_snapshot(
        &self,
        snapshot: &WeatherSnapshotResponse,
    ) -> Result<(), ApiError>;
}
