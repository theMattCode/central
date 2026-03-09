mod context;
mod config;
mod domain;
mod error;
mod http;
mod infrastructure;
mod mcp;

use std::{net::SocketAddr, sync::Arc};

use context::Context;
use config::{Config, RuntimeMode};
use domain::service::WeatherSnapshotService;
use infrastructure::{provider::OpenMeteoClient, repository::WeatherSnapshotRepository};
use tracing::{error, info};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "weather_service=info,axum=info,tower_http=info".into()),
        )
        .init();

    let config = Arc::new(Config::from_env());
    info!(
        runtime_mode = ?config.runtime_mode,
        port = config.port,
        refresh_interval_seconds = config.refresh_interval.as_secs(),
        request_timeout_seconds = config.request_timeout.as_secs(),
        open_meteo_base_url = %config.open_meteo_base_url,
        cors_allow_origin = %config.cors_allow_origin,
        "Loaded weather service configuration"
    );

    let open_meteo =
        match OpenMeteoClient::new(config.open_meteo_base_url.clone(), config.request_timeout) {
            Ok(client) => client,
            Err(error) => {
                error!("{error}");
                std::process::exit(1);
            }
        };

    let weather_repository = match WeatherSnapshotRepository::connect(&config.database_url).await {
        Ok(repository) => repository,
        Err(error) => {
            error!("{error}");
            std::process::exit(1);
        }
    };

    let weather_service =
        WeatherSnapshotService::new(Arc::new(open_meteo), Arc::new(weather_repository));

    let result = match config.runtime_mode {
        RuntimeMode::Http => run_http_server(config, weather_service).await,
        RuntimeMode::Mcp => run_mcp_server(weather_service).await,
        RuntimeMode::Both => run_http_and_mcp(config, weather_service).await,
    };

    if let Err(error) = result {
        error!("{error}");
        std::process::exit(1);
    }
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
    info!("Starting weather HTTP service on {address}");

    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(error) => {
            return Err(format!("Failed to bind weather service socket: {error}"));
        }
    };

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|error| format!("Weather service HTTP server error: {error}"))?;

    Ok(())
}

async fn run_mcp_server(weather_service: WeatherSnapshotService) -> Result<(), String> {
    info!("Starting weather MCP stdio server");
    mcp::run_server(weather_service)
        .await
        .map_err(|error| format!("Weather MCP server error: {error}"))
}

async fn run_http_and_mcp(
    config: Arc<Config>,
    weather_service: WeatherSnapshotService,
) -> Result<(), String> {
    info!("Starting weather service in combined mode (HTTP + MCP)");
    let mcp_weather_service = weather_service.clone();
    let mcp_task = tokio::spawn(async move { mcp::run_server(mcp_weather_service).await });

    let http_result = run_http_server(config, weather_service).await;

    if !mcp_task.is_finished() {
        mcp_task.abort();
    } else {
        match mcp_task.await {
            Ok(Ok(())) => info!("Weather MCP server stopped"),
            Ok(Err(error)) => error!("Weather MCP server stopped with error: {error}"),
            Err(join_error) => error!("Weather MCP task join error: {join_error}"),
        }
    }

    http_result
}

async fn shutdown_signal() {
    if let Err(error) = tokio::signal::ctrl_c().await {
        error!("Failed to listen for shutdown signal: {error}");
    }

    info!("Shutdown signal received");
}
