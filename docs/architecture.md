# Architecture

## Workspace Structure

The repository is organized as a multi-project Nx workspace:

- `apps/*`: user-facing applications (currently `apps/cockpit`)
- `services/*`: backend runtime services (`services/backend`, `services/assistant`)
- `i12e/*`: infrastructure and orchestration projects (`postgres`, `orchestrator`)
- `libs/*`: shared reusable libraries (currently `ts-log` for cross-cutting TypeScript logging)
- `docs/*`: cross-cutting repository documentation

## Runtime Components

### Cockpit (`apps/cockpit`)

- TanStack Start + React frontend.
- Fetches data on the cockpit server via TanStack Start loaders/server functions, then sends the result to the browser.
- Cockpit reaches the backend service over HTTP for weather (`/api/v1/weather/current` and `/api/v1/weather/forecast`).
- Cockpit reaches assistant-service over HTTP (`POST /api/v1/assistant/turn` and `POST /api/v1/assistant/turn/stream`).
- Configuration:
  - Runtime backend base URL is configured via `BACKEND_BASE_URL` with `VITE_BACKEND_API_BASE_URL` as a browser/build-time fallback.
  - Runtime assistant service base URL is configured via `ASSISTANT_SERVICE_BASE_URL` with `VITE_ASSISTANT_API_BASE_URL` as a browser/build-time fallback.
- If neither backend variable is set, cockpit defaults to `http://localhost:3010` for local orchestrator-driven development.
- If neither assistant variable is set, cockpit defaults to `http://localhost:3020` for local orchestrator-driven development.

### Backend Service (`services/backend`)

- Rust + Axum service that exposes one integrated HTTP API.
- Shared process concerns live at the service root:
  - `config`: runtime configuration.
  - `http`: health endpoint, routing, CORS, and request tracing.
  - `context`/`main`: dependency wiring and process bootstrap.
- Domain-specific code lives under `src/domains/*`.
- Finance is implemented as `src/domains/finance`, with its cash transaction domain model, use case, PostgreSQL persistence adapter, and HTTP route module.
- Weather is implemented as `src/domains/weather`, with its own domain model, use case, Open-Meteo adapter, PostgreSQL persistence adapter, and HTTP route module.

### Assistant Service (`services/assistant`)

- Rust + Axum service that owns the assistant turn orchestration boundary.
- Layered modules:
  - `domain`: assistant-turn ports and orchestration.
  - `infrastructure`: mock adapters plus HTTP upstream adapters for STT, LLM, and TTS.
  - `http`: REST transport.
  - `config`/`context`/`main`: configuration and process wiring.
- Runs in either:
  - `mock` mode for local UI integration and orchestration testing.
  - `llm-proxy` mode to call an external LLM while keeping mock STT / TTS boundaries.
  - `openai` mode to use OpenAI-native STT / LLM / TTS endpoints.
  - `proxy` mode to call external STT / LLM / TTS runtimes.
- The orchestrated dev and prod stacks use `proxy` mode by default, backed by faster-whisper STT, Qwen3-TTS voice cloning, and an Ollama-based LLM wrapper.

### Persistence (`i12e/postgres`)

- PostgreSQL image with bootstrap init scripts and forward-only SQL migrations.
- Migration application is handled by `apply-migrations.sh`.

### Orchestration (`i12e/orchestrator`)

- Docker Compose project used to start the full local stack.
- Separate environment files define dev and prod default port mappings and assistant model settings.

## Data Flow

### Weather

1. Browser requests cockpit.
2. Cockpit server requests the backend weather API.
3. The backend weather domain checks the PostgreSQL cache first.
4. If the cache is stale or missing, the backend fetches fresh data from Open-Meteo.
5. Fresh responses are returned immediately; persistence writes happen asynchronously.
6. Cockpit serializes widget data to the client and can refresh through server functions without exposing backend directly to the browser.

### Finance Cash

1. Browser opens `/finance/cash`.
2. Cockpit server functions call backend finance APIs.
3. Backend persists manual income and expense transactions in PostgreSQL.
4. Monthly summaries are computed from transactions filtered by transaction date.

### Voice

1. Browser VAD cuts a speech segment locally.
2. Browser posts the segment directly to assistant-service's streaming endpoint.
3. Assistant-service performs `STT -> streamed LLM -> chunked TTS`.
4. Browser plays synthesized chunks as they arrive.
5. Cockpit still exposes a non-streaming server function path for fallback flows.

## Boundary Rules

- Keep UI and presentation concerns in `apps/*`.
- Keep backend business logic and adapters in `services/*`.
- Keep infrastructure/container/migration concerns in `i12e/*`.
- Promote cross-project reusable code into `libs/*` when duplication appears.
- Prefer Cockpit server functions when they already own the boundary; direct browser-to-service calls are reserved for cases like the voice streaming path that need end-to-end streaming semantics.

## Shared Library Packaging

- Workspace libraries can be consumed directly as `workspace:*` packages when the caller's toolchain can compile TypeScript source from the linked package.
- `@central/ts-log` is currently consumed this way by `apps/cockpit`: the package export points at source, and cockpit's Vite build bundles it without a separate library build step.
- If a shared library later needs to be consumed as a prebuilt artifact, switch its package exports to `dist/*`, add the relevant library build as a prerequisite for consumers, and keep Docker dependency-install layers aware of the workspace package manifest.
