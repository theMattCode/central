# Architecture

## Workspace Structure

The repository is organized as a multi-project Nx workspace:

- `apps/*`: user-facing applications (currently `apps/cockpit`)
- `services/*`: backend runtime services (currently `services/weather`)
- `i12e/*`: infrastructure and orchestration projects (`postgres`, `orchestrator`)
- `libs/*`: shared reusable libraries (currently reserved for future extraction)
- `docs/*`: cross-cutting repository documentation

## Runtime Components

### Cockpit (`apps/cockpit`)

- TanStack Start + React frontend.
- Calls the weather service over HTTP (`/api/v1/weather/current` and `/api/v1/weather/forecast`).
- Runtime weather service base URL is configured via `VITE_WEATHER_API_BASE_URL`.

### Weather Service (`services/weather`)

- Rust + Axum service with layered modules:
  - `domain`: contracts, models, and use cases.
  - `infrastructure`: Open-Meteo adapter and PostgreSQL persistence adapter.
  - `http`: REST + SSE transport.
  - `mcp`: MCP stdio transport.
  - `config`/`context`/`main`: configuration and process wiring.
- Runs in `http`, `mcp`, or `both` runtime modes.

### Persistence (`i12e/postgres`)

- PostgreSQL image with bootstrap init scripts and forward-only SQL migrations.
- Migration application is handled by `apply-migrations.sh`.

### Orchestration (`i12e/orchestrator`)

- Docker Compose project used to start the full local stack.
- Separate environment files define dev and prod default port mappings.

## Data Flow

1. Cockpit requests weather data from weather-service.
2. Weather-service checks PostgreSQL cache first.
3. If cache is stale or missing, weather-service fetches fresh data from Open-Meteo.
4. Fresh responses are returned immediately; persistence writes happen asynchronously.
5. Cockpit renders snapshots and can manually refresh.

## Boundary Rules

- Keep UI and presentation concerns in `apps/*`.
- Keep backend business logic and adapters in `services/*`.
- Keep infrastructure/container/migration concerns in `i12e/*`.
- Promote cross-project reusable code into `libs/*` when duplication appears.
