mod app_state;
mod config;
mod error;
mod http;
mod mcp;
mod weather;

use std::{net::SocketAddr, sync::Arc};

use app_state::AppState;
use config::{Config, RuntimeMode};
use tracing::{error, info};
use weather::provider::OpenMeteoClient;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "weather_service=info,axum=info,tower_http=info".into()),
        )
        .init();

    let config = Arc::new(Config::from_env());
    let open_meteo =
        match OpenMeteoClient::new(config.open_meteo_base_url.clone(), config.request_timeout) {
            Ok(client) => client,
            Err(error) => {
                error!("{error}");
                std::process::exit(1);
            }
        };

    let result = match config.runtime_mode {
        RuntimeMode::Http => run_http_server(config, open_meteo).await,
        RuntimeMode::Mcp => run_mcp_server(open_meteo).await,
        RuntimeMode::Both => run_http_and_mcp(config, open_meteo).await,
    };

    if let Err(error) = result {
        error!("{error}");
        std::process::exit(1);
    }
}

async fn run_http_server(config: Arc<Config>, open_meteo: OpenMeteoClient) -> Result<(), String> {
    let state = AppState {
        config: Arc::clone(&config),
        open_meteo,
    };
    let app = http::build_router(state);

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

async fn run_mcp_server(open_meteo: OpenMeteoClient) -> Result<(), String> {
    info!("Starting weather MCP stdio server");
    mcp::run_server(open_meteo)
        .await
        .map_err(|error| format!("Weather MCP server error: {error}"))
}

async fn run_http_and_mcp(config: Arc<Config>, open_meteo: OpenMeteoClient) -> Result<(), String> {
    info!("Starting weather service in combined mode (HTTP + MCP)");
    let mcp_client = open_meteo.clone();
    let mcp_task = tokio::spawn(async move { mcp::run_server(mcp_client).await });

    let http_result = run_http_server(config, open_meteo).await;

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
