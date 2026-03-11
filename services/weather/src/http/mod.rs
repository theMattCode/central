mod handlers;

use axum::{
    http::{HeaderValue, Method},
    routing::get,
    Router,
};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::warn;

use crate::context::Context;

pub fn build_router(context: Context) -> Router {
    let cors = build_cors_layer(&context.config.cors_allow_origin);

    Router::new()
        .route("/healthz", get(handlers::healthz))
        .route("/api/v1/weather/current", get(handlers::current_weather))
        .route("/api/v1/weather/forecast", get(handlers::forecast_weather))
        .route("/api/v1/weather/stream", get(handlers::stream_weather))
        .with_state(context)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}

fn build_cors_layer(allow_origin: &str) -> CorsLayer {
    let base = CorsLayer::new()
        .allow_methods([Method::GET, Method::OPTIONS])
        .allow_headers(Any);

    if allow_origin == "*" {
        return base.allow_origin(Any);
    }

    match HeaderValue::from_str(allow_origin) {
        Ok(origin) => base.allow_origin(origin),
        Err(_) => {
            warn!("Invalid WEATHER_CORS_ALLOW_ORIGIN='{allow_origin}', falling back to wildcard.");
            base.allow_origin(Any)
        }
    }
}

#[cfg(test)]
mod tests;
