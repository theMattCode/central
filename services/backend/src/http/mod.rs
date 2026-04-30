use axum::{
    http::{HeaderValue, Method},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::warn;

use crate::{context::Context, domains};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    status: &'static str,
}

pub fn build_router(context: Context) -> Router {
    let cors = build_cors_layer(&context.config.cors_allow_origin);

    Router::new()
        .route("/healthz", get(healthz))
        .nest("/api/v1/weather", domains::weather::http::router())
        .with_state(context)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}

async fn healthz() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
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
            warn!("Invalid BACKEND_CORS_ALLOW_ORIGIN='{allow_origin}', falling back to wildcard.");
            base.allow_origin(Any)
        }
    }
}
