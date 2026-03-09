use super::{parse_runtime_mode, RuntimeMode};

#[test]
fn parses_runtime_mode() {
    assert_eq!(parse_runtime_mode("http"), RuntimeMode::Http);
    assert_eq!(parse_runtime_mode("mcp"), RuntimeMode::Mcp);
    assert_eq!(parse_runtime_mode("both"), RuntimeMode::Both);
    assert_eq!(parse_runtime_mode("MCP"), RuntimeMode::Mcp);
}

#[test]
fn unknown_runtime_mode_defaults_to_http() {
    assert_eq!(parse_runtime_mode("invalid"), RuntimeMode::Http);
}
