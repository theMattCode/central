# Architecture

## Workspace Structure

The repository is organized as a multi-project Nx workspace:

- `apps/*`: user-facing applications (currently `apps/cockpit`)
- `services/*`: backend runtime services (`backend`, `assistant`, `stt`, `tts`, `llm`); the Rust services share one
  Cargo workspace (`services/Cargo.toml`)
- `i12e/*`: infrastructure and orchestration projects (`postgres`, `orchestrator`, `gateway`)
- `libs/*`: shared reusable libraries (none yet; code moves here once a second project needs it)
- `docs/*`: cross-cutting repository documentation; domain language lives in `docs/domains/*`

Project names, targets, and commands are listed in [toolchain](./toolchain.md); ports in the
[service catalog](./service-catalog.md).

## Runtime Components

### Cockpit (`apps/cockpit`)

- TanStack Start + React frontend.
- Fetches backend data on the cockpit server via TanStack Start server functions, then sends the result to the browser.
- Backend exposes weather current and forecast endpoints; Cockpit currently calls `/api/v1/weather/current`.
- Cockpit has assistant client code for `POST /api/v1/assistant/turn` and `POST /api/v1/assistant/turn/stream`, but the default UI does not start turns while browser VAD is disabled.
- Configuration:
  - Runtime backend base URL is configured via `BACKEND_BASE_URL` with `VITE_BACKEND_API_BASE_URL` as a browser/build-time fallback.
  - Runtime assistant service base URL is configured via `ASSISTANT_SERVICE_BASE_URL` with `VITE_ASSISTANT_API_BASE_URL` as a browser/build-time fallback.
  - Without either variable, cockpit falls back to the dev stack host ports (`http://localhost:3010` and `http://localhost:3020`).

### Backend Service (`services/backend`)

- Rust + Axum service that exposes one integrated HTTP API.
- Shared process concerns live at the service root:
  - `config`: runtime configuration.
  - `http`: health endpoint, routing, CORS, and request tracing.
  - `context`/`main`: dependency wiring and process bootstrap.
- Domain-specific code lives under `src/domains/*`.
- Finance is implemented as `src/domains/finance`, with its transaction use case, PostgreSQL persistence adapter, and HTTP route module on top of the finance foundation model (accounts, ledger, budgets, recurring plans); see [finance domain](./domains/finance.md).
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
- `proxy` mode uses faster-whisper STT, Qwen3-TTS voice cloning, and an Ollama-based LLM wrapper. The assistant and these support services run in the dev stack only when the `voice` compose profile is enabled; they are not part of production.

### Persistence (`i12e/postgres`)

- PostgreSQL image with bootstrap init scripts and forward-only SQL migrations.
- Migration application is handled by `apply-migrations.sh`.

### Orchestration (`i12e/orchestrator`)

- `docker-compose.yml` is the hot-reload dev stack; voice services sit behind the `voice` profile.
- `deploy/docker-compose.prod.yml` is the only production definition. Local `pnpm prod` runs it with an overlay that builds the images from the checkout.
- Production releases are code-free on the server: CI publishes a tested core image set to GHCR plus a deploy bundle with `docker-compose.prod.yml`, `central-update`, and `.env.prod.example` (see [deployment](./deployment.md) and [ADR 0002](./adr/0002-single-host-compose-image-release.md)).
- The production baseline runs PostgreSQL, a migration job, Backend, Cockpit, and an Nginx gateway on one Docker Compose host. Assistant, voice, STT, TTS, and LLM services are not part of the baseline.

### Gateway (`i12e/gateway`)

- Nginx reverse proxy for the production baseline.
- Exposes one HTTP entrypoint to the host, bound to `127.0.0.1` by default for Tailscale Serve.
- Proxies public application traffic to Cockpit.
- Keeps Backend and PostgreSQL private on the Compose network.

## Data Flow

### Production HTTP

1. The user reaches the host through Tailscale.
2. Tailscale Serve forwards to the local gateway port.
3. Nginx proxies application traffic to Cockpit.
4. Cockpit server functions call Backend over the private Compose network.
5. Backend reads and writes PostgreSQL over the private Compose network.

### Weather

1. Browser requests cockpit.
2. Cockpit widget calls a TanStack Start server function.
3. The server function requests the backend weather API.
4. The backend weather domain checks the PostgreSQL cache first.
5. If the cache is stale or missing, the backend fetches fresh data from Open-Meteo.
6. Fresh responses are returned immediately; persistence writes happen asynchronously.
7. Cockpit serializes widget data to the client and can refresh through server functions without exposing backend directly to the browser.

### Finance Cash

1. Browser opens `/finance/transactions`.
2. Cockpit server functions call backend finance APIs.
3. Backend persists manual income and expense transactions in PostgreSQL, each booked on a financial account.
4. Summaries are computed from transactions filtered by transaction date.
5. Financial accounts are managed on `/finance/accounts` through the same server-function path.

### Voice

1. Browser VAD is currently disabled, so Cockpit does not capture speech segments in the default UI.
2. When the implemented turn client is invoked, Cockpit posts audio to assistant-service's streaming endpoint.
3. Assistant-service performs `STT -> streamed LLM -> chunked TTS`.
4. Browser plays synthesized chunks as they arrive.
5. Cockpit still exposes a non-streaming server function path for fallback flows.

This flow exists in the Cockpit and assistant-service code; the assistant service and support runtimes run only with `COMPOSE_PROFILES=voice`.

## Boundary Rules

- Keep UI and presentation concerns in `apps/*`.
- Keep backend business logic and adapters in `services/*`.
- Keep infrastructure/container/migration concerns in `i12e/*`.
- Promote cross-project reusable code into `libs/*` when duplication appears.
- Prefer Cockpit server functions when they already own the boundary; direct browser-to-service calls are reserved for cases like the voice streaming path that need end-to-end streaming semantics.
- In the production baseline, Backend is private and is not exposed directly through the gateway. System-health views should be implemented through Cockpit or another explicit web app boundary.

## Shared Library Packaging

- Workspace libraries can be consumed directly as `workspace:*` packages when the caller's toolchain can compile TypeScript source from the linked package.
- Point the package export at source so the consumer's Vite build bundles the library without a separate library build step.
- If a shared library later needs to be consumed as a prebuilt artifact, switch its package exports to `dist/*`, add the relevant library build as a prerequisite for consumers, and keep Docker dependency-install layers aware of the workspace package manifest.
