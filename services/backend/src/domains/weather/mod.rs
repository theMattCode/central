pub mod http;
pub mod model;
pub mod repository;
pub mod service;

pub mod contracts;
#[cfg(test)]
mod http_tests;
pub mod provider;

use axum::{routing::get, Router};

use crate::context::Context;

pub fn router() -> Router<Context> {
    Router::new()
        .route("/current", get(http::current_weather))
        .route("/forecast", get(http::forecast_weather))
        .route("/stream", get(http::stream_weather))
}
