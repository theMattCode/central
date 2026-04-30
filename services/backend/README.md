# Backend Service

Rust + Axum backend service for Central.

The service is intentionally modular: shared process concerns live at the service root, while feature code lives under `src/domains/*`. Weather is currently the first domain.

## Structure

- `src/main.rs`: process bootstrap and dependency wiring.
- `src/config`: runtime configuration from environment variables.
- `src/http`: integrated HTTP API router, health endpoint, CORS, and tracing middleware.
- `src/context.rs`: request state shared by domain routers.
- `src/error.rs`: shared application errors and HTTP mapping.
- `src/domains/weather`: weather domain model, use case, Open-Meteo adapter, PostgreSQL repository, and HTTP routes.

## API

### Backend

- `GET /healthz`

### Weather Domain

- `GET /api/v1/weather/current?lat=48.4057&lon=9.0542&timezone=Europe/Berlin`
- `GET /api/v1/weather/forecast?lat=48.4057&lon=9.0542&timezone=Europe/Berlin&hoursPast=48&hoursFuture=240`
- `GET /api/v1/weather/stream?lat=48.4057&lon=9.0542&timezone=Europe/Berlin`

Weather responses are cached in PostgreSQL. Current snapshots are served from cache until they are older than 15 minutes; stale or missing entries are refreshed from Open-Meteo and persisted asynchronously.

## Configuration

- `BACKEND_PORT` (default: `5010`)
- `BACKEND_DATABASE_URL` (default: `postgres://central:central@localhost:3001/central`)
- `BACKEND_CORS_ALLOW_ORIGIN` (default: `*`)
- `WEATHER_REFRESH_INTERVAL_SECONDS` (default: `900`)
- `WEATHER_REQUEST_TIMEOUT_SECONDS` (default: `10`)
- `WEATHER_OPEN_METEO_BASE_URL` (default: `https://api.open-meteo.com`)

If you run standalone PostgreSQL (`pnpm nx run i12e-postgres:run`), set `BACKEND_DATABASE_URL=postgres://central:central@localhost:5001/central`.

## Validate

```bash
pnpm nx run backend:lint
pnpm nx run backend:test
pnpm nx run backend:typecheck
pnpm nx run backend:build
pnpm nx run backend:container-build
pnpm nx run backend:container-run
```
