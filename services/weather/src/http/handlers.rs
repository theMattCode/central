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

use crate::{
    app_state::AppState,
    error::ApiError,
    weather::model::{WeatherQueryInput, WeatherSnapshotResponse},
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
    State(state): State<AppState>,
    Query(query): Query<WeatherQueryInput>,
) -> Result<Json<WeatherSnapshotResponse>, ApiError> {
    let location = query.into_location()?;
    let snapshot = state.open_meteo.fetch_weather_snapshot(&location).await?;
    Ok(Json(snapshot))
}

pub(super) async fn stream_weather(
    State(state): State<AppState>,
    Query(query): Query<WeatherQueryInput>,
) -> Result<Sse<impl futures_core::Stream<Item = Result<Event, Infallible>>>, ApiError> {
    let location = query.into_location()?;
    let refresh_interval = state.config.refresh_interval;
    let open_meteo = state.open_meteo.clone();

    let updates = stream! {
        let mut interval = tokio::time::interval(refresh_interval);
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);
        interval.tick().await;

        loop {
            match open_meteo.fetch_weather_snapshot(&location).await {
                Ok(snapshot) => {
                    match serde_json::to_string(&snapshot) {
                        Ok(payload) => yield Ok(Event::default().event("snapshot").data(payload)),
                        Err(error) => {
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
                    let envelope = StreamErrorEnvelope {
                        error: StreamErrorPayload {
                            code: "upstream_error",
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
