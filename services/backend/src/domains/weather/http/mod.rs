mod handlers;

use axum::{routing::get, Router};

use crate::context::Context;

pub fn router() -> Router<Context> {
    Router::new()
        .route("/current", get(handlers::current_weather))
        .route("/forecast", get(handlers::forecast_weather))
        .route("/stream", get(handlers::stream_weather))
}

#[cfg(test)]
mod tests;
