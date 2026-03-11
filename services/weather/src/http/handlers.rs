use std::{convert::Infallible, time::Duration};

use async_stream::stream;
use axum::{
    extract::{Query, State},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use tokio::time::MissedTickBehavior;
use tracing::{info, warn};

use crate::{
    context::Context,
    domain::model::{
        WeatherForecastQueryInput, WeatherForecastResponse, WeatherQueryInput, WeatherSnapshotResponse,
    },
    error::ApiError,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct HealthResponse {
    status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamErrorPayload {
    code: &'static str,
    message: String,
    timestamp: DateTime<Utc>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StreamErrorEnvelope {
    error: StreamErrorPayload,
}

pub(super) async fn healthz() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

pub(super) async fn current_weather(
    State(context): State<Context>,
    Query(query): Query<WeatherQueryInput>,
) -> Result<Json<WeatherSnapshotResponse>, ApiError> {
    let location = query.into_location()?;
    info!(
        lat = location.latitude,
        lon = location.longitude,
        timezone = %location.timezone,
        "Received manual weather refresh request"
    );

    let snapshot = match context.weather_service.get_current_snapshot(&location).await {
        Ok(snapshot) => snapshot,
        Err(error) => {
            warn!(
                lat = location.latitude,
                lon = location.longitude,
                timezone = %location.timezone,
                code = error.code(),
                error = %error,
                "Manual weather refresh failed"
            );
            return Err(error);
        }
    };

    info!(
        lat = snapshot.location.latitude,
        lon = snapshot.location.longitude,
        timezone = %snapshot.location.timezone,
        source_time = %snapshot.meta.source_time,
        "Manual weather refresh succeeded"
    );

    Ok(Json(snapshot))
}

pub(super) async fn forecast_weather(
    State(context): State<Context>,
    Query(query): Query<WeatherForecastQueryInput>,
) -> Result<Json<WeatherForecastResponse>, ApiError> {
    let forecast_query = query.into_forecast_query()?;
    let hours_past = forecast_query.hours_past;
    let hours_future = forecast_query.hours_future;
    let location = forecast_query.location;
    info!(
        lat = location.latitude,
        lon = location.longitude,
        timezone = %location.timezone,
        hours_past,
        hours_future,
        "Received forecast refresh request"
    );

    let forecast = match context
        .weather_service
        .get_hourly_forecast(&location, hours_past, hours_future)
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
                "Forecast refresh request failed"
            );
            return Err(error);
        }
    };

    info!(
        lat = forecast.location.latitude,
        lon = forecast.location.longitude,
        timezone = %forecast.location.timezone,
        hourly_points = forecast.hourly.len(),
        "Forecast refresh request succeeded"
    );

    Ok(Json(forecast))
}

pub(super) async fn stream_weather(
    State(context): State<Context>,
    Query(query): Query<WeatherQueryInput>,
) -> Result<Sse<impl futures_core::Stream<Item = Result<Event, Infallible>>>, ApiError> {
    let location = query.into_location()?;
    let latitude = location.latitude;
    let longitude = location.longitude;
    let timezone = location.timezone.clone();
    let refresh_interval = context.config.refresh_interval;
    let refresh_interval_seconds = refresh_interval.as_secs();
    let context = context.clone();

    info!(
        lat = latitude,
        lon = longitude,
        timezone = %timezone,
        refresh_interval_seconds,
        "Opened weather snapshot stream"
    );

    let updates = stream! {
        let mut interval = tokio::time::interval(refresh_interval);
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);
        interval.tick().await;

        loop {
            match context.weather_service.get_current_snapshot(&location).await {
                Ok(snapshot) => {
                    info!(
                        lat = latitude,
                        lon = longitude,
                        timezone = %timezone,
                        source_time = %snapshot.meta.source_time,
                        "Weather stream snapshot updated"
                    );
                    match serde_json::to_string(&snapshot) {
                        Ok(payload) => yield Ok(Event::default().event("snapshot").data(payload)),
                        Err(error) => {
                            warn!(
                                lat = latitude,
                                lon = longitude,
                                timezone = %timezone,
                                error = %error,
                                "Failed to serialize weather snapshot for SSE stream"
                            );
                            let envelope = StreamErrorEnvelope {
                                error: StreamErrorPayload {
                                    code: "serialization_error",
                                    message: format!("Failed to serialize weather snapshot: {error}"),
                                    timestamp: Utc::now(),
                                },
                            };

                            if let Ok(payload) = serde_json::to_string(&envelope) {
                                yield Ok(Event::default().event("error").data(payload));
                            }
                        }
                    }
                }
                Err(error) => {
                    warn!(
                        lat = latitude,
                        lon = longitude,
                        timezone = %timezone,
                        code = error.code(),
                        error = %error,
                        "Weather stream refresh failed"
                    );
                    let envelope = StreamErrorEnvelope {
                        error: StreamErrorPayload {
                            code: error.code(),
                            message: error.to_string(),
                            timestamp: Utc::now(),
                        },
                    };

                    if let Ok(payload) = serde_json::to_string(&envelope) {
                        yield Ok(Event::default().event("error").data(payload));
                    }
                }
            }

            interval.tick().await;
        }
    };

    Ok(Sse::new(updates).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(20))
            .text("keepalive"),
    ))
}
