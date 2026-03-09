use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::domain::model::WeatherSnapshotResponse;

const JSON_RPC_VERSION: &str = "2.0";

#[derive(Debug, Deserialize)]
pub(super) struct JsonRpcRequest {
    #[allow(dead_code)]
    pub(super) jsonrpc: Option<String>,
    pub(super) id: Option<Value>,
    pub(super) method: String,
    #[serde(default)]
    pub(super) params: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ToolCallParams {
    pub(super) name: String,
    #[serde(default)]
    pub(super) arguments: Value,
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

pub(super) fn weather_tool_definition(weather_tool_name: &str) -> Value {
    json!({
        "name": weather_tool_name,
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

pub(super) fn tool_success_result(snapshot: WeatherSnapshotResponse) -> Value {
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

pub(super) fn tool_error_result(message: String) -> Value {
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

pub(super) fn success_response(id: Value, result: Value) -> Value {
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

pub(super) fn error_response(id: Value, code: i32, message: String) -> Value {
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
