# Weather Service

Rust backend service that fetches weather data from Open-Meteo and exposes JSON and SSE APIs for widgets.

Each successful weather update is persisted to PostgreSQL:

- Current snapshots in `service_weather.current_weather_snapshots`, keyed by `(latitude, longitude)`.
- Hourly forecast rows in `service_weather.hourly_weather_forecasts`, keyed by `(latitude, longitude, forecast_at_utc)`.

## Architecture

The service is organized into clear layers:

- `src/http/*`: HTTP transport layer (REST + SSE) for widget consumers.
- `src/mcp/*`: MCP transport layer for tool-based consumers.
- `src/config/*`: runtime configuration loading and parsing from environment variables.
- `src/domain/*`: domain-level contracts, models, and the `WeatherSnapshotService` use case.
- `src/infrastructure/*`: Open-Meteo and PostgreSQL adapters.
- `src/context.rs`: runtime wiring for shared dependencies injected into HTTP handlers.
- `src/main.rs`: process bootstrap and runtime mode selection (`http`, `mcp`, `both`).

Request flow (current weather):

1. Transport layer validates input and builds `WeatherLocationQuery`.
2. `WeatherSnapshotService` attempts to load the snapshot from PostgreSQL.
3. If the cached snapshot is fresh (<15 minutes old), it is returned immediately.
4. If missing/stale, fresh data is fetched from Open-Meteo and returned.
5. Fresh data persistence runs asynchronously after response preparation.

Request flow (hourly forecast):

1. HTTP transport validates input and builds `WeatherForecastQuery` (`lat`, `lon`, `timezone`, `hoursPast`, `hoursFuture`).
2. `WeatherSnapshotService` attempts to load the requested forecast range from PostgreSQL.
3. If range data is complete and fresh (<15 minutes old), it is returned immediately.
4. If missing/stale/incomplete, fresh data is fetched from Open-Meteo and returned.
5. Fresh data persistence runs asynchronously after response preparation.
6. Future and current hours are updated on conflict; past-hour conflicts are not overwritten.
7. Upstream rows that contain `null` for required hourly fields are skipped instead of failing the entire response.

Persistence model:

- Table: `service_weather.current_weather_snapshots`
- Key: one row per location via `(latitude, longitude)` primary key
- Storage: full `CurrentWeatherPayload` in `jsonb` (`current_payload`) plus `payload_version`
- Write strategy: `INSERT ... ON CONFLICT (latitude, longitude) DO UPDATE`
- Table: `service_weather.hourly_weather_forecasts`
- Key: one row per location and hour via `(latitude, longitude, forecast_at_utc)` primary key
- Storage: typed hourly columns (temperature, precipitation, wind, humidity, pressure, cloud cover, etc.)
- Write strategy: `INSERT ... ON CONFLICT ... DO UPDATE` only when `forecast_at_utc >= current_utc_hour`

Refresh model:

- Backend SSE polling interval defaults to `WEATHER_REFRESH_INTERVAL_SECONDS=900` (15 minutes).
- HTTP and MCP calls are cache-first: responses are served from PostgreSQL when cached entries are younger than 15 minutes.
- If cached entries are older than 15 minutes (or missing/incomplete), fresh data is fetched from Open-Meteo and returned immediately.
- Freshly fetched data is persisted asynchronously after the response is prepared to keep request latency low.
- Forecast refresh persists hourly rows in one-record-per-hour form.

## Endpoints

When `WEATHER_RUNTIME_MODE=http`:

- `GET /healthz`
- `GET /api/v1/weather/current?lat=48.4057&lon=9.0542&timezone=Europe/Berlin`
- `GET /api/v1/weather/forecast?lat=48.4057&lon=9.0542&timezone=Europe/Berlin&hoursPast=48&hoursFuture=240`
- `GET /api/v1/weather/stream?lat=48.4057&lon=9.0542&timezone=Europe/Berlin`

The SSE endpoint emits:

- `event: snapshot` with JSON weather snapshots
- `event: error` with JSON error payloads

Hourly forecast query defaults and limits:

- Defaults: `hoursPast=1`, `hoursFuture=168` (7 days)
- Limits: `hoursPast <= 720`, `hoursFuture <= 384`
- At least one of `hoursPast` or `hoursFuture` must be greater than `0`

## MCP Server

When `WEATHER_RUNTIME_MODE=mcp`, the service runs as an MCP server over stdio.

When `WEATHER_RUNTIME_MODE=both`, HTTP and MCP run in the same process.

Exposed tool:

- `get_current_weather` with input schema:
  - `lat` (number, required)
  - `lon` (number, required)
  - `timezone` (string, optional, defaults to `auto`)
- `get_weather_forecast` with input schema:
  - `lat` (number, required)
  - `lon` (number, required)
  - `timezone` (string, optional, defaults to `auto`)
  - `hoursPast` (integer, optional, defaults to `1`)
  - `hoursFuture` (integer, optional, defaults to `168`)

## Configuration

- `WEATHER_RUNTIME_MODE` (default: `http`; values: `http`, `mcp`, `both`)
- `WEATHER_PORT` (default: `5010`)
- `WEATHER_REFRESH_INTERVAL_SECONDS` (default: `900`)
- `WEATHER_REQUEST_TIMEOUT_SECONDS` (default: `10`)
- `WEATHER_OPEN_METEO_BASE_URL` (default: `https://api.open-meteo.com`)
- `WEATHER_DATABASE_URL` (default: `postgres://central:central@localhost:3001/central` for local IDE/dev-host runs; orchestrator sets container-internal URL explicitly)
- `WEATHER_CORS_ALLOW_ORIGIN` (default: `*`)

If you run standalone PostgreSQL (`pnpm nx run i12e-postgres:run`), override `WEATHER_DATABASE_URL` to `postgres://central:central@localhost:5001/central`.

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
