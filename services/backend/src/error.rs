use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use thiserror::Error;
use tracing::{error, warn};

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Upstream(String),
    #[error("{0}")]
    Internal(String),
}

impl ApiError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::BadRequest(_) => "bad_request",
            Self::NotFound(_) => "not_found",
            Self::Upstream(_) => "upstream_error",
            Self::Internal(_) => "internal_error",
        }
    }

    pub fn status_code(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Upstream(_) => StatusCode::BAD_GATEWAY,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorResponse {
    error: ErrorPayload,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorPayload {
    code: String,
    message: String,
    timestamp: DateTime<Utc>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        // Error-level events become Sentry issues, warnings only breadcrumbs. Third-party outages
        // (Open-Meteo) are expected and would flood Sentry; client errors stay out of it entirely.
        match self {
            Self::Internal(_) => error!(code = self.code(), "{self}"),
            Self::Upstream(_) => warn!(code = self.code(), "{self}"),
            Self::BadRequest(_) | Self::NotFound(_) => {}
        }
        let payload = ErrorResponse {
            error: ErrorPayload {
                code: self.code().to_string(),
                message: self.to_string(),
                timestamp: Utc::now(),
            },
        };

        (status, Json(payload)).into_response()
    }
}
