mod handlers;
mod payload;

use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};
use http::{header, HeaderValue, Method};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::context::Context;

pub fn build_router(context: Context) -> Router {
    let allow_origin = HeaderValue::from_str(&context.config.cors_allow_origin)
        .unwrap_or_else(|_| HeaderValue::from_static("*"));

    Router::new()
        .route("/healthz", get(handlers::healthz))
        .route("/api/v1/assistant/turn", post(handlers::run_turn))
        .route(
            "/api/v1/assistant/turn/stream",
            post(handlers::run_turn_stream),
        )
        .layer(DefaultBodyLimit::max(4 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(allow_origin)
                .allow_methods([Method::GET, Method::POST])
                .allow_headers([header::ACCEPT, header::CONTENT_TYPE]),
        )
        .with_state(context)
}
