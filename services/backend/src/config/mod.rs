use std::{env, time::Duration};

use tracing::warn;

const DEFAULT_DATABASE_URL: &str = "postgres://central:central@localhost:3001/central";

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub refresh_interval: Duration,
    pub open_meteo_base_url: String,
    pub database_url: String,
    pub request_timeout: Duration,
    pub cors_allow_origin: String,
}

impl Config {
    pub fn from_env() -> Self {
        let port = parse_env_or_default("BACKEND_PORT", 5010_u16);
        let refresh_interval_seconds =
            parse_env_or_default("WEATHER_REFRESH_INTERVAL_SECONDS", 900_u64);
        let request_timeout_seconds =
            parse_env_or_default("WEATHER_REQUEST_TIMEOUT_SECONDS", 10_u64);

        let open_meteo_base_url = env::var("WEATHER_OPEN_METEO_BASE_URL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "https://api.open-meteo.com".to_string());

        let database_url = env::var("BACKEND_DATABASE_URL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_DATABASE_URL.to_string());

        let cors_allow_origin = env::var("BACKEND_CORS_ALLOW_ORIGIN")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "*".to_string());

        Self {
            port,
            refresh_interval: Duration::from_secs(refresh_interval_seconds),
            open_meteo_base_url,
            database_url,
            request_timeout: Duration::from_secs(request_timeout_seconds),
            cors_allow_origin,
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
