//! Process bootstrap shared by the Rust services: Sentry, tracing, and the Tokio runtime.

use std::{borrow::Cow, future::Future};

use tracing::error;
use tracing_subscriber::prelude::*;

/// Initializes Sentry and tracing, runs `run` on a multi-threaded Tokio runtime, and exits
/// with status 1 when it fails.
///
/// `fallback_release` is used when `SENTRY_RELEASE` is unset; pass `sentry::release_name!()`
/// so the release names the calling crate. `default_log_filter` applies when `RUST_LOG` is unset.
pub fn run_service<F, Fut>(
    fallback_release: Option<Cow<'static, str>>,
    default_log_filter: &str,
    run: F,
) where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<(), String>>,
{
    let sentry = sentry::init(
        sentry::ClientOptions::new()
            .maybe_release(release(
                std::env::var("SENTRY_RELEASE").ok(),
                fallback_release,
            ))
            .traces_sample_rate(1.0),
    );

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                // This crate's own events (startup failures, shutdown) are part of every service's log.
                .unwrap_or_else(|_| format!("{}=info,{default_log_filter}", module_path!()).into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .with(
            sentry::integrations::tracing::layer().event_filter(|metadata| {
                // tower_http logs every 5xx as a generic "response failed"; the API error event is the issue.
                if metadata.target().starts_with("tower_http") {
                    sentry::integrations::tracing::EventFilter::Breadcrumb
                } else {
                    sentry::integrations::tracing::default_event_filter(metadata)
                }
            }),
        )
        .init();

    let result = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(|error| format!("Failed to build Tokio runtime: {error}"))
        .and_then(|runtime| runtime.block_on(run()));

    if let Err(error) = result {
        error!("{error}");
        // Flush pending Sentry events; `process::exit` skips destructors.
        drop(sentry);
        std::process::exit(1);
    }
}

/// CI bakes `SENTRY_RELEASE` into release images; local builds fall back to the crate version.
fn release(
    configured: Option<String>,
    fallback: Option<Cow<'static, str>>,
) -> Option<Cow<'static, str>> {
    configured
        .filter(|release| !release.is_empty())
        .map(Into::into)
        .or(fallback)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefers_the_configured_release() {
        assert_eq!(
            release(Some("central@abc".into()), Some("crate@0.1.0".into())),
            Some("central@abc".into())
        );
    }

    #[test]
    fn falls_back_when_the_configured_release_is_missing_or_empty() {
        assert_eq!(
            release(None, Some("crate@0.1.0".into())),
            Some("crate@0.1.0".into())
        );
        assert_eq!(
            release(Some(String::new()), Some("crate@0.1.0".into())),
            Some("crate@0.1.0".into())
        );
    }
}
