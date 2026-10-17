# Backend Service

Rust + Axum backend service for Central.

The service is intentionally modular: shared process concerns live at the service root, while feature code lives under `src/domains/*`.

## Structure

- `src/main.rs`: process bootstrap and dependency wiring.
- `src/config`: runtime configuration from environment variables.
- `src/http`: integrated HTTP API router, health endpoint, CORS, and tracing middleware.
- `src/context.rs`: request state shared by domain routers.
- `src/error.rs`: shared application errors and HTTP mapping.
- `src/domains/finance`: cash transaction domain model, use case, PostgreSQL repository, and HTTP routes.
- `src/domains/weather`: weather domain model, use case, Open-Meteo adapter, PostgreSQL repository, and HTTP routes.

## API

### Backend

- `GET /healthz`

### Finance Domain

- `GET /api/v1/finance/accounts`
- `POST /api/v1/finance/accounts`
- `PUT /api/v1/finance/accounts/:id` (`409` when the currency of an account with entries changes)
- `PUT /api/v1/finance/accounts/order` (body `{ "accountIds": [...] }` with every active account exactly once)
- `POST /api/v1/finance/accounts/:id/archive`
- `POST /api/v1/finance/accounts/:id/restore`
- `GET /api/v1/finance/transactions?from=2026-05-01&to=2026-05-31`
- `POST /api/v1/finance/transactions`
- `PUT /api/v1/finance/transactions/:id`
- `DELETE /api/v1/finance/transactions/:id`

Finance manages financial accounts and the manual income and expense transactions booked on them. Every transaction
needs a `financialAccountId`; new transactions only accept active `EUR` accounts. Amounts are exposed as decimal
strings and stored in PostgreSQL as positive minor units. See the [finance domain](../../docs/domains/finance.md).

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
- `SENTRY_DSN` (default: unset, which disables Sentry; see [error monitoring](../../docs/service-catalog.md#error-monitoring))
- `SENTRY_ENVIRONMENT` (default: `development` for debug builds, `production` for release builds)

These defaults apply to a native `cargo run`. In the dev stack (`pnpm dev`) the backend listens on `8080` inside the
container and is published on host port `3010`; it reaches PostgreSQL at `i12e-postgres:5432`.

## Validate

```bash
pnpm nx run service-backend:format-check
pnpm nx run service-backend:lint
pnpm nx run service-backend:typecheck
pnpm nx run service-backend:test
pnpm nx run service-backend:build
```

`test` needs a running Docker daemon: repository tests (`*/repository_tests.rs`) start a throwaway
`postgres:18.3-alpine` container through [testcontainers](https://rust.testcontainers.org/) and apply
`i12e/postgres/init` and `i12e/postgres/migrations` before each test. Set `DOCKER_HOST` if Docker does not listen on
the default socket.
