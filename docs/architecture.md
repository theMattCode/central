# Architecture

## Workspace Structure

The repository is organized as a multi-project Nx workspace:

- `apps/*`: user-facing applications (currently `apps/cockpit`)
- `services/*`: backend runtime services (`services/weather`, `services/voice`)
- `i12e/*`: infrastructure and orchestration projects (`postgres`, `orchestrator`)
- `libs/*`: shared reusable libraries (currently `ts-log` for cross-cutting TypeScript logging)
- `docs/*`: cross-cutting repository documentation

## Runtime Components

### Cockpit (`apps/cockpit`)

- TanStack Start + React frontend.
- Fetches data on the cockpit server via TanStack Start loaders/server functions, then sends the result to the browser.
- Cockpit reaches weather-service over HTTP (`/api/v1/weather/current` and `/api/v1/weather/forecast`).
- Cockpit reaches voice-service over HTTP (`POST /api/v1/voice/turn`).
- Configuration:
  - Runtime weather service base URL is configured via `WEATHER_SERVICE_BASE_URL` with `VITE_WEATHER_API_BASE_URL` as a build-time fallback.
  - Runtime voice service base URL is configured via `VOICE_SERVICE_BASE_URL` with `VITE_VOICE_API_BASE_URL` as a build-time fallback.
- If neither weather variable is set, cockpit defaults to `http://localhost:3010` for local orchestrator-driven development.
- If neither voice variable is set, cockpit defaults to `http://localhost:3020` for local orchestrator-driven development.

### Weather Service (`services/weather`)

- Rust + Axum service with layered modules:
  - `domain`: contracts, models, and use cases.
  - `infrastructure`: Open-Meteo adapter and PostgreSQL persistence adapter.
  - `http`: REST + SSE transport.
  - `mcp`: MCP stdio transport.
  - `config`/`context`/`main`: configuration and process wiring.
- Runs in `http`, `mcp`, or `both` runtime modes.

### Voice Service (`services/voice`)

- Rust + Axum service that owns the voice turn orchestration boundary.
- Layered modules:
  - `domain`: voice-turn ports and orchestration.
  - `infrastructure`: mock adapters plus HTTP upstream adapters for STT, LLM, and TTS.
  - `http`: REST transport.
  - `config`/`context`/`main`: configuration and process wiring.
- Runs in either:
  - `mock` mode for local UI integration and orchestration testing.
  - `llm-proxy` mode to call an external LLM while keeping mock STT / TTS boundaries.
  - `openai` mode to use OpenAI-native STT / LLM / TTS endpoints.
  - `proxy` mode to call external STT / LLM / TTS runtimes.

### Persistence (`i12e/postgres`)

- PostgreSQL image with bootstrap init scripts and forward-only SQL migrations.
- Migration application is handled by `apply-migrations.sh`.

### Orchestration (`i12e/orchestrator`)

- Docker Compose project used to start the full local stack.
- Separate environment files define dev and prod default port mappings.

## Data Flow

### Weather

1. Browser requests cockpit.
2. Cockpit server requests the weather service.
3. The weather service checks the PostgreSQL cache first.
4. If the cache is stale or missing, weather-service fetches fresh data from Open-Meteo.
5. Fresh responses are returned immediately; persistence writes happen asynchronously.
6. Cockpit serializes widget data to the client and can refresh through server functions without exposing weather-service to the browser.

### Voice

1. Browser VAD cuts a speech segment locally.
2. Browser posts the segment to a TanStack Start server function in Cockpit.
3. Cockpit forwards the request to voice-service.
4. Voice-service performs `STT -> LLM -> TTS`.
5. Cockpit returns transcript, answer text, and audio payload to the browser.
6. Browser plays the synthesized answer.

## Boundary Rules

- Keep UI and presentation concerns in `apps/*`.
- Keep backend business logic and adapters in `services/*`.
- Keep infrastructure/container/migration concerns in `i12e/*`.
- Promote cross-project reusable code into `libs/*` when duplication appears.
- Browsers should not call backend services directly when Cockpit server functions already own the boundary.

## Shared Library Packaging

- Workspace libraries can be consumed directly as `workspace:*` packages when the caller's toolchain can compile TypeScript source from the linked package.
- `@central/ts-log` is currently consumed this way by `apps/cockpit`: the package export points at source, and cockpit's Vite build bundles it without a separate library build step.
- If a shared library later needs to be consumed as a prebuilt artifact, switch its package exports to `dist/*`, add the relevant library build as a prerequisite for consumers, and keep Docker dependency-install layers aware of the workspace package manifest.
