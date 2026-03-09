use std::{env, time::Duration};

use tracing::warn;

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum RuntimeMode {
    Http,
    Mcp,
    Both,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub runtime_mode: RuntimeMode,
    pub port: u16,
    pub refresh_interval: Duration,
    pub open_meteo_base_url: String,
    pub database_url: String,
    pub request_timeout: Duration,
    pub cors_allow_origin: String,
}

impl Config {
    pub fn from_env() -> Self {
        let runtime_mode = parse_runtime_mode(
            env::var("WEATHER_RUNTIME_MODE")
                .ok()
                .as_deref()
                .unwrap_or("http"),
        );

        let port = parse_env_or_default("WEATHER_PORT", 5010_u16);
        let refresh_interval_seconds =
            parse_env_or_default("WEATHER_REFRESH_INTERVAL_SECONDS", 900_u64);
        let request_timeout_seconds =
            parse_env_or_default("WEATHER_REQUEST_TIMEOUT_SECONDS", 10_u64);

        let open_meteo_base_url = env::var("WEATHER_OPEN_METEO_BASE_URL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "https://api.open-meteo.com".to_string());

        let database_url = env::var("WEATHER_DATABASE_URL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "postgres://central:central@postgres:5432/central".to_string());

        let cors_allow_origin = env::var("WEATHER_CORS_ALLOW_ORIGIN")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "*".to_string());

        Self {
            runtime_mode,
            port,
            refresh_interval: Duration::from_secs(refresh_interval_seconds),
            open_meteo_base_url,
            database_url,
            request_timeout: Duration::from_secs(request_timeout_seconds),
            cors_allow_origin,
        }
    }
}

fn parse_runtime_mode(raw: &str) -> RuntimeMode {
    match raw.trim().to_ascii_lowercase().as_str() {
        "http" => RuntimeMode::Http,
        "mcp" => RuntimeMode::Mcp,
        "both" => RuntimeMode::Both,
        other => {
            warn!("Unknown WEATHER_RUNTIME_MODE='{other}', defaulting to 'http'.");
            RuntimeMode::Http
        }
    }
}

fn parse_env_or_default<T>(key: &str, default_value: T) -> T
where
    T: std::str::FromStr + Copy,
{
    match env::var(key) {
        Ok(value) => match value.parse::<T>() {
            Ok(parsed) => parsed,
            Err(_) => {
                warn!("Failed to parse {key}='{value}', falling back to default value.");
                default_value
            }
        },
        Err(_) => default_value,
    }
}

#[cfg(test)]
mod tests;
