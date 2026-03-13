# Architecture

## Workspace Structure

The repository is organized as a multi-project Nx workspace:

- `apps/*`: user-facing applications (currently `apps/cockpit`)
- `services/*`: backend runtime services (currently `services/weather`)
- `i12e/*`: infrastructure and orchestration projects (`postgres`, `orchestrator`)
- `libs/*`: shared reusable libraries (currently `ts-log` for cross-cutting TypeScript logging)
- `docs/*`: cross-cutting repository documentation

## Runtime Components

### Cockpit (`apps/cockpit`)

- TanStack Start + React frontend.
- Fetches weather data on the cockpit server via TanStack Start loaders/server functions, then sends the result to the browser.
- Cockpit reaches the weather service over HTTP (`/api/v1/weather/current` and `/api/v1/weather/forecast`).
- Runtime weather service base URL is configured via `WEATHER_SERVICE_BASE_URL` with `VITE_WEATHER_API_BASE_URL` as a build-time fallback. If neither is set, cockpit defaults to `http://localhost:3010` for local orchestrator-driven development.

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

1. Browser requests cockpit.
2. Weather-service checks PostgreSQL cache first.
3. If cache is stale or missing, weather-service fetches fresh data from Open-Meteo.
4. Fresh responses are returned immediately; persistence writes happen asynchronously.
5. Cockpit serializes widget data to the client and can refresh through server functions without exposing weather-service to the browser.

## Boundary Rules

- Keep UI and presentation concerns in `apps/*`.
- Keep backend business logic and adapters in `services/*`.
- Keep infrastructure/container/migration concerns in `i12e/*`.
- Promote cross-project reusable code into `libs/*` when duplication appears.

## Shared Library Packaging

- Workspace libraries can be consumed directly as `workspace:*` packages when the caller's toolchain can compile TypeScript source from the linked package.
- `@central/ts-log` is currently consumed this way by `apps/cockpit`: the package export points at source, and cockpit's Vite build bundles it without a separate library build step.
- If a shared library later needs to be consumed as a prebuilt artifact, switch its package exports to `dist/*`, add the relevant library build as a prerequisite for consumers, and keep Docker dependency-install layers aware of the workspace package manifest.
