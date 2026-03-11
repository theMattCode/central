use super::{DEFAULT_DATABASE_URL, RuntimeMode, parse_runtime_mode};

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

#[test]
fn default_database_url_points_to_local_dev_port() {
    assert_eq!(
        DEFAULT_DATABASE_URL,
        "postgres://central:central@localhost:3001/central"
    );
}
