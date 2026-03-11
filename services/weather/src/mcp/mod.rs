mod protocol;
mod transport;

use std::io;

use serde_json::{json, Value};
use tokio::io::BufReader;
use tracing::{debug, info, warn};

use crate::domain::{
    model::{WeatherForecastQueryInput, WeatherQueryInput},
    service::WeatherSnapshotService,
};

use self::protocol::{
    error_response, forecast_tool_definition, success_response, tool_error_result,
    tool_success_result, JsonRpcRequest, ToolCallParams,
};
use self::transport::{read_frame, write_frame};

const MCP_PROTOCOL_VERSION: &str = "2024-11-05";
const CURRENT_WEATHER_TOOL_NAME: &str = "get_current_weather";
const FORECAST_WEATHER_TOOL_NAME: &str = "get_weather_forecast";

fn weather_tool_definition() -> Value {
    protocol::weather_tool_definition(CURRENT_WEATHER_TOOL_NAME)
}

fn weather_forecast_tool_definition() -> Value {
    forecast_tool_definition(FORECAST_WEATHER_TOOL_NAME)
}

pub async fn run_server(weather_service: WeatherSnapshotService) -> io::Result<()> {
    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin);
    let mut writer = tokio::io::stdout();

    info!("MCP stdio server ready");

    while let Some(payload) = read_frame(&mut reader).await? {
        let response = match serde_json::from_slice::<JsonRpcRequest>(&payload) {
            Ok(request) => {
                debug!(method = %request.method, has_id = request.id.is_some(), "Received MCP request");
                process_request(request, &weather_service).await
            }
            Err(error) => Some(error_response(
                Value::Null,
                -32700,
                format!("Invalid JSON-RPC payload: {error}"),
            )),
        };

        if let Some(message) = response {
            write_frame(&mut writer, &message).await?;
        }
    }

    info!("MCP input stream closed; server shutting down");
    Ok(())
}

async fn process_request(
    request: JsonRpcRequest,
    weather_service: &WeatherSnapshotService,
) -> Option<Value> {
    let id = request.id.clone();

    match request.method.as_str() {
        "initialize" => id.map(|request_id| {
            info!("Handling MCP initialize request");
            let protocol_version = request
                .params
                .get("protocolVersion")
                .and_then(Value::as_str)
                .unwrap_or(MCP_PROTOCOL_VERSION);

            success_response(
                request_id,
                json!({
                    "protocolVersion": protocol_version,
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "weather-service",
                        "version": env!("CARGO_PKG_VERSION")
                    }
                }),
            )
        }),
        "notifications/initialized" => None,
        "ping" => {
            debug!("Handling MCP ping request");
            id.map(|request_id| success_response(request_id, json!({})))
        }
        "tools/list" => id.map(|request_id| {
            info!("Handling MCP tools/list request");
            success_response(
                request_id,
                json!({
                    "tools": [
                        weather_tool_definition(),
                        weather_forecast_tool_definition()
                    ]
                }),
            )
        }),
        "tools/call" => {
            let request_id = id?;
            info!("Handling MCP tools/call request");
            Some(handle_tool_call(request_id, request.params, weather_service).await)
        }
        other => {
            if other.starts_with("notifications/") {
                debug!("Ignoring MCP notification '{other}'");
                None
            } else {
                id.map(|request_id| {
                    error_response(request_id, -32601, format!("Method not found: {other}"))
                })
            }
        }
    }
}

async fn handle_tool_call(
    request_id: Value,
    params: Value,
    weather_service: &WeatherSnapshotService,
) -> Value {
    let parsed: ToolCallParams = match serde_json::from_value(params) {
        Ok(parsed) => parsed,
        Err(error) => {
            warn!(error = %error, "Invalid MCP tools/call params");
            return error_response(
                request_id,
                -32602,
                format!("Invalid tools/call params: {error}"),
            );
        }
    };

    match parsed.name.as_str() {
        CURRENT_WEATHER_TOOL_NAME => {
            let query_input: WeatherQueryInput = match serde_json::from_value(parsed.arguments) {
                Ok(query) => query,
                Err(error) => {
                    warn!(error = %error, "Invalid MCP weather tool arguments");
                    return success_response(
                        request_id,
                        tool_error_result(format!("Invalid tool arguments: {error}")),
                    );
                }
            };

            let location = match query_input.into_location() {
                Ok(location) => location,
                Err(error) => {
                    warn!(code = error.code(), error = %error, "Invalid MCP weather query");
                    return success_response(request_id, tool_error_result(error.to_string()));
                }
            };

            info!(
                lat = location.latitude,
                lon = location.longitude,
                timezone = %location.timezone,
                "Executing MCP weather tool"
            );

            match weather_service.get_current_snapshot(&location).await {
                Ok(snapshot) => {
                    info!(
                        lat = snapshot.location.latitude,
                        lon = snapshot.location.longitude,
                        timezone = %snapshot.location.timezone,
                        source_time = %snapshot.meta.source_time,
                        "MCP weather tool succeeded"
                    );
                    success_response(request_id, tool_success_result(snapshot))
                }
                Err(error) => {
                    warn!(
                        lat = location.latitude,
                        lon = location.longitude,
                        timezone = %location.timezone,
                        code = error.code(),
                        error = %error,
                        "MCP weather tool failed"
                    );
                    success_response(request_id, tool_error_result(error.to_string()))
                }
            }
        }
        FORECAST_WEATHER_TOOL_NAME => {
            let query_input: WeatherForecastQueryInput =
                match serde_json::from_value(parsed.arguments) {
                    Ok(query) => query,
                    Err(error) => {
                        warn!(error = %error, "Invalid MCP forecast tool arguments");
                        return success_response(
                            request_id,
                            tool_error_result(format!("Invalid tool arguments: {error}")),
                        );
                    }
                };

            let forecast_query = match query_input.into_forecast_query() {
                Ok(query) => query,
                Err(error) => {
                    warn!(code = error.code(), error = %error, "Invalid MCP forecast query");
                    return success_response(request_id, tool_error_result(error.to_string()));
                }
            };
            let location = forecast_query.location;
            let hours_past = forecast_query.hours_past;
            let hours_future = forecast_query.hours_future;

            info!(
                lat = location.latitude,
                lon = location.longitude,
                timezone = %location.timezone,
                hours_past,
                hours_future,
                "Executing MCP weather forecast tool"
            );

            match weather_service
                .get_hourly_forecast(&location, hours_past, hours_future)
                .await
            {
                Ok(forecast) => {
                    info!(
                        lat = forecast.location.latitude,
                        lon = forecast.location.longitude,
                        timezone = %forecast.location.timezone,
                        hours_past,
                        hours_future,
                        hourly_points = forecast.hourly.len(),
                        "MCP weather forecast tool succeeded"
                    );
                    success_response(request_id, tool_success_result(forecast))
                }
                Err(error) => {
                    warn!(
                        lat = location.latitude,
                        lon = location.longitude,
                        timezone = %location.timezone,
                        hours_past,
                        hours_future,
                        code = error.code(),
                        error = %error,
                        "MCP weather forecast tool failed"
                    );
                    success_response(request_id, tool_error_result(error.to_string()))
                }
            }
        }
        _ => {
            warn!(tool = %parsed.name, "Unknown MCP tool requested");
            success_response(
                request_id,
                tool_error_result(format!("Unknown tool '{}'", parsed.name)),
            )
        }
    }
}

#[cfg(test)]
mod tests;
