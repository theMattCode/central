# Weather Service

Rust backend service that fetches weather data from Open-Meteo and exposes a JSON and SSE API for widgets.

## Endpoints

When `WEATHER_RUNTIME_MODE=http`:

- `GET /healthz`
- `GET /api/v1/weather/current?lat=48.4057&lon=9.0542&timezone=Europe/Berlin`
- `GET /api/v1/weather/stream?lat=48.4057&lon=9.0542&timezone=Europe/Berlin`

The SSE endpoint emits:

- `event: snapshot` with JSON weather snapshots
- `event: error` with JSON error payloads

## MCP Server

When `WEATHER_RUNTIME_MODE=mcp`, the service runs as an MCP server over stdio.

When `WEATHER_RUNTIME_MODE=both`, HTTP and MCP run in the same process.

Exposed tool:

- `get_current_weather` with input schema:
  - `lat` (number, required)
  - `lon` (number, required)
  - `timezone` (string, optional, defaults to `auto`)

## Configuration

- `WEATHER_RUNTIME_MODE` (default: `http`; values: `http`, `mcp`, `both`)
- `WEATHER_PORT` (default: `5010`)
- `WEATHER_REFRESH_INTERVAL_SECONDS` (default: `300`)
- `WEATHER_REQUEST_TIMEOUT_SECONDS` (default: `10`)
- `WEATHER_OPEN_METEO_BASE_URL` (default: `https://api.open-meteo.com`)
- `WEATHER_CORS_ALLOW_ORIGIN` (default: `*`)

## Docker

The container image defaults to `WEATHER_RUNTIME_MODE=both`.

`container-run` uses `docker run -i` so stdio remains available for MCP while HTTP stays available on host port `5010`.

## Nx targets

- `pnpm nx run weather-service:lint`
- `pnpm nx run weather-service:test`
- `pnpm nx run weather-service:typecheck`
- `pnpm nx run weather-service:build`
- `pnpm nx run weather-service:container-build`
- `pnpm nx run weather-service:container-run`
