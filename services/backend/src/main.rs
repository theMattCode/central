mod config;
mod context;
mod domains;
mod error;
mod http;

use std::{net::SocketAddr, sync::Arc};

use config::Config;
use context::Context;
use domains::weather::{
    domain::service::WeatherSnapshotService,
    infrastructure::{provider::OpenMeteoClient, repository::WeatherSnapshotRepository},
};
use tracing::{error, info};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=info,axum=info,tower_http=info".into()),
        )
        .init();

    let config = Arc::new(Config::from_env());
    info!(
        port = config.port,
        weather_refresh_interval_seconds = config.refresh_interval.as_secs(),
        weather_request_timeout_seconds = config.request_timeout.as_secs(),
        weather_open_meteo_base_url = %config.open_meteo_base_url,
        cors_allow_origin = %config.cors_allow_origin,
        "Loaded backend configuration"
    );

    let weather_service = match build_weather_service(&config).await {
        Ok(service) => service,
        Err(error) => {
            error!("{error}");
            std::process::exit(1);
        }
    };

    if let Err(error) = run_http_server(config, weather_service).await {
        error!("{error}");
        std::process::exit(1);
    }
}

async fn build_weather_service(config: &Config) -> Result<WeatherSnapshotService, String> {
    let open_meteo =
        OpenMeteoClient::new(config.open_meteo_base_url.clone(), config.request_timeout)
            .map_err(|error| error.to_string())?;

    let weather_repository = WeatherSnapshotRepository::connect(&config.database_url)
        .await
        .map_err(|error| error.to_string())?;

    Ok(WeatherSnapshotService::new(
        Arc::new(open_meteo),
        Arc::new(weather_repository),
    ))
}

async fn run_http_server(
    config: Arc<Config>,
    weather_service: WeatherSnapshotService,
) -> Result<(), String> {
    let context = Context {
        config: Arc::clone(&config),
        weather_service,
    };
    let app = http::build_router(context);

    let address = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Starting backend HTTP service on {address}");

    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(error) => {
            return Err(format!("Failed to bind backend service socket: {error}"));
        }
    };

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|error| format!("Backend service HTTP server error: {error}"))?;

    Ok(())
}

async fn shutdown_signal() {
    if let Err(error) = tokio::signal::ctrl_c().await {
        error!("Failed to listen for shutdown signal: {error}");
    }

    info!("Shutdown signal received");
}
