# Weather Service

Rust backend service that fetches weather data from Open-Meteo and exposes a JSON and SSE API for widgets.

Each successful weather update is persisted to PostgreSQL in `service_weather.current_weather_snapshots`, keyed by `(latitude, longitude)`.

## Architecture

The service is organized into clear layers:

- `src/http/*`: HTTP transport layer (REST + SSE) for widget consumers.
- `src/mcp/*`: MCP transport layer for tool-based consumers.
- `src/config/*`: runtime configuration loading and parsing from environment variables.
- `src/domain/*`: domain-level contracts, models, and the `WeatherSnapshotService` use case.
- `src/infrastructure/*`: Open-Meteo and PostgreSQL adapters.
- `src/context.rs`: runtime wiring for shared dependencies injected into HTTP handlers.
- `src/main.rs`: process bootstrap and runtime mode selection (`http`, `mcp`, `both`).

Request flow (HTTP and MCP):

1. Transport layer validates input and builds `WeatherLocationQuery`.
2. `WeatherSnapshotService` fetches the latest snapshot via `OpenMeteoClient`.
3. `WeatherSnapshotService` persists the snapshot via `WeatherSnapshotRepository`.
4. The same snapshot is returned to the caller.

Persistence model:

- Table: `service_weather.current_weather_snapshots`
- Key: one row per location via `(latitude, longitude)` primary key
- Storage: full `CurrentWeatherPayload` in `jsonb` (`current_payload`) plus `payload_version`
- Write strategy: `INSERT ... ON CONFLICT (latitude, longitude) DO UPDATE`

Refresh model:

- Backend SSE polling interval defaults to `WEATHER_REFRESH_INTERVAL_SECONDS=900` (15 minutes).
- Client-triggered manual refresh (`GET /api/v1/weather/current`) follows the same service path and also persists.

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
- `WEATHER_REFRESH_INTERVAL_SECONDS` (default: `900`)
- `WEATHER_REQUEST_TIMEOUT_SECONDS` (default: `10`)
- `WEATHER_OPEN_METEO_BASE_URL` (default: `https://api.open-meteo.com`)
- `WEATHER_DATABASE_URL` (default: `postgres://central:central@postgres:5432/central`)
- `WEATHER_CORS_ALLOW_ORIGIN` (default: `*`)

## Logging

The service uses structured logs via `tracing`.

- Startup logs include active runtime mode and key runtime settings.
- Update flow logs include fetch, persist, and transport events for HTTP and MCP.
- Failures include structured fields such as coordinates and error code.
- PostgreSQL startup uses retry logic (10 attempts, 1s delay) to absorb short orchestrator startup races.

Control verbosity with `RUST_LOG`:

- Default fallback: `weather_service=info,axum=info,tower_http=info`
- More verbose service logs: `RUST_LOG=weather_service=debug,axum=info,tower_http=info`

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
