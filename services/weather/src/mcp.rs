use std::io;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{
    AsyncBufRead, AsyncBufReadExt, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader,
};
use tracing::debug;

use crate::weather::{
    model::{WeatherQueryInput, WeatherSnapshotResponse},
    provider::OpenMeteoClient,
};

const JSON_RPC_VERSION: &str = "2.0";
const MCP_PROTOCOL_VERSION: &str = "2024-11-05";
const WEATHER_TOOL_NAME: &str = "get_current_weather";

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: Option<String>,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolCallParams {
    name: String,
    #[serde(default)]
    arguments: Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcSuccessResponse {
    jsonrpc: &'static str,
    id: Value,
    result: Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcErrorResponse {
    jsonrpc: &'static str,
    id: Value,
    error: JsonRpcError,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

pub async fn run_server(open_meteo: OpenMeteoClient) -> io::Result<()> {
    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin);
    let mut writer = tokio::io::stdout();

    while let Some(payload) = read_frame(&mut reader).await? {
        let response = match serde_json::from_slice::<JsonRpcRequest>(&payload) {
            Ok(request) => process_request(request, &open_meteo).await,
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

    Ok(())
}

async fn process_request(request: JsonRpcRequest, open_meteo: &OpenMeteoClient) -> Option<Value> {
    let id = request.id.clone();

    match request.method.as_str() {
        "initialize" => id.map(|request_id| {
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
        "ping" => id.map(|request_id| success_response(request_id, json!({}))),
        "tools/list" => id.map(|request_id| {
            success_response(
                request_id,
                json!({
                    "tools": [
                        weather_tool_definition()
                    ]
                }),
            )
        }),
        "tools/call" => {
            let request_id = id?;
            Some(handle_tool_call(request_id, request.params, open_meteo).await)
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

async fn handle_tool_call(request_id: Value, params: Value, open_meteo: &OpenMeteoClient) -> Value {
    let parsed: ToolCallParams = match serde_json::from_value(params) {
        Ok(parsed) => parsed,
        Err(error) => {
            return error_response(
                request_id,
                -32602,
                format!("Invalid tools/call params: {error}"),
            );
        }
    };

    if parsed.name != WEATHER_TOOL_NAME {
        return success_response(
            request_id,
            tool_error_result(format!("Unknown tool '{}'", parsed.name)),
        );
    }

    let query_input: WeatherQueryInput = match serde_json::from_value(parsed.arguments) {
        Ok(query) => query,
        Err(error) => {
            return success_response(
                request_id,
                tool_error_result(format!("Invalid tool arguments: {error}")),
            );
        }
    };

    let location = match query_input.into_location() {
        Ok(location) => location,
        Err(error) => {
            return success_response(request_id, tool_error_result(error.to_string()));
        }
    };

    match open_meteo.fetch_weather_snapshot(&location).await {
        Ok(snapshot) => success_response(request_id, tool_success_result(snapshot)),
        Err(error) => success_response(request_id, tool_error_result(error.to_string())),
    }
}

fn weather_tool_definition() -> Value {
    json!({
        "name": WEATHER_TOOL_NAME,
        "description": "Fetches current weather conditions for the provided coordinates.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "lat": {
                    "type": "number",
                    "description": "Latitude in decimal degrees, from -90 to 90."
                },
                "lon": {
                    "type": "number",
                    "description": "Longitude in decimal degrees, from -180 to 180."
                },
                "timezone": {
                    "type": "string",
                    "description": "IANA timezone like Europe/Berlin. Defaults to auto."
                }
            },
            "required": ["lat", "lon"],
            "additionalProperties": false
        }
    })
}

fn tool_success_result(snapshot: WeatherSnapshotResponse) -> Value {
    let structured_content =
        serde_json::to_value(&snapshot).unwrap_or_else(|_| json!({"error": "serialization_error"}));

    let text = serde_json::to_string(&snapshot)
        .unwrap_or_else(|_| "{\"error\":\"serialization_error\"}".to_string());

    json!({
        "content": [
            {
                "type": "text",
                "text": text
            }
        ],
        "structuredContent": structured_content
    })
}

fn tool_error_result(message: String) -> Value {
    json!({
        "isError": true,
        "content": [
            {
                "type": "text",
                "text": message
            }
        ]
    })
}

fn success_response(id: Value, result: Value) -> Value {
    serde_json::to_value(JsonRpcSuccessResponse {
        jsonrpc: JSON_RPC_VERSION,
        id,
        result,
    })
    .unwrap_or_else(|_| {
        json!({
            "jsonrpc": JSON_RPC_VERSION,
            "id": Value::Null,
            "error": {
                "code": -32603,
                "message": "Failed to serialize success response"
            }
        })
    })
}

fn error_response(id: Value, code: i32, message: String) -> Value {
    serde_json::to_value(JsonRpcErrorResponse {
        jsonrpc: JSON_RPC_VERSION,
        id,
        error: JsonRpcError { code, message },
    })
    .unwrap_or_else(|_| {
        json!({
            "jsonrpc": JSON_RPC_VERSION,
            "id": Value::Null,
            "error": {
                "code": -32603,
                "message": "Failed to serialize error response"
            }
        })
    })
}

async fn read_frame<R>(reader: &mut R) -> io::Result<Option<Vec<u8>>>
where
    R: AsyncBufRead + Unpin,
{
    let mut content_length: Option<usize> = None;

    loop {
        let mut line = String::new();
        let bytes = reader.read_line(&mut line).await?;

        if bytes == 0 {
            if content_length.is_some() {
                return Err(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "Unexpected EOF while reading MCP headers",
                ));
            }

            return Ok(None);
        }

        if line == "\r\n" || line == "\n" {
            break;
        }

        let mut split = line.splitn(2, ':');
        let header_name = split.next().unwrap_or("").trim().to_ascii_lowercase();
        let header_value = split.next().unwrap_or("").trim();

        if header_name == "content-length" {
            content_length = Some(header_value.parse::<usize>().map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("Invalid Content-Length header: {error}"),
                )
            })?);
        }
    }

    let length = content_length.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "Missing Content-Length header in MCP frame",
        )
    })?;

    let mut payload = vec![0_u8; length];
    reader.read_exact(&mut payload).await?;
    Ok(Some(payload))
}

async fn write_frame<W>(writer: &mut W, payload: &Value) -> io::Result<()>
where
    W: AsyncWrite + Unpin,
{
    let encoded = serde_json::to_vec(payload).map_err(|error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("Failed to serialize JSON-RPC payload: {error}"),
        )
    })?;

    let header = format!("Content-Length: {}\r\n\r\n", encoded.len());
    writer.write_all(header.as_bytes()).await?;
    writer.write_all(&encoded).await?;
    writer.flush().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{tool_error_result, weather_tool_definition};

    #[test]
    fn weather_tool_definition_contains_expected_name() {
        let tool = weather_tool_definition();
        assert_eq!(tool.get("name"), Some(&json!("get_current_weather")));
    }

    #[test]
    fn tool_error_result_sets_is_error_flag() {
        let result = tool_error_result("example".to_string());
        assert_eq!(result.get("isError"), Some(&json!(true)));
    }
}
