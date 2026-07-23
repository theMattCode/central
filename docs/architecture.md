# Architecture

## Workspace Structure

The repository is organized as a multi-project Nx workspace:

- `apps/*`: user-facing applications (currently `apps/cockpit`)
- `services/*`: backend runtime services (`backend`, `assistant`, `stt`, `tts`, `llm`)
- `i12e/*`: infrastructure and orchestration projects (`postgres`, `orchestrator`, `gateway`)
- `libs/*`: shared reusable libraries (currently `ts-log` for cross-cutting TypeScript logging)
- `docs/*`: cross-cutting repository documentation

## Runtime Components

### Cockpit (`apps/cockpit`)

- TanStack Start + React frontend.
- Fetches backend data on the cockpit server via TanStack Start server functions, then sends the result to the browser.
- Backend exposes weather current and forecast endpoints; Cockpit currently calls `/api/v1/weather/current`.
- Cockpit has assistant client code for `POST /api/v1/assistant/turn` and `POST /api/v1/assistant/turn/stream`, but the default UI does not start turns while browser VAD is disabled.
- Configuration:
  - Runtime backend base URL is configured via `BACKEND_BASE_URL` with `VITE_BACKEND_API_BASE_URL` as a browser/build-time fallback.
  - Runtime assistant service base URL is configured via `ASSISTANT_SERVICE_BASE_URL` with `VITE_ASSISTANT_API_BASE_URL` as a browser/build-time fallback.
- If neither backend variable is set, cockpit defaults to `http://localhost:3010` for local orchestrator-driven development.
- If neither assistant variable is set, cockpit defaults to `http://localhost:3020`, matching the standalone assistant container run target.

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
- The standalone service supports `proxy` mode with faster-whisper STT, Qwen3-TTS voice cloning, and an Ollama-based LLM wrapper. The orchestrator compose definitions for those support services are currently commented out, so the active dev/prod stack does not start assistant services by default.

### Persistence (`i12e/postgres`)

- PostgreSQL image with bootstrap init scripts and forward-only SQL migrations.
- Migration application is handled by `apply-migrations.sh`.

### Orchestration (`i12e/orchestrator`)

- Docker Compose project used to start the active local stack.
- Separate environment files define dev and prod default port mappings. Assistant model settings remain in env templates for the commented assistant support services.
- Production releases are code-free on the server: CI publishes a tested core image set to GHCR plus a deploy bundle with `docker-compose.prod.yml`, `central-update`, and `.env.prod.example`.
- The production baseline runs PostgreSQL, a migration job, Backend, Cockpit, and an Nginx gateway on one Docker Compose host. Assistant, voice, STT, TTS, and LLM services are optional future production profiles, not part of the baseline.

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

### Finance

1. Browser opens the Finance Dashboard in Cockpit.
2. Cockpit server functions call backend finance APIs.
3. Backend persists finance data in PostgreSQL through forward-only migrations under `i12e/postgres/migrations`.
4. Finance stays one backend domain with focused subareas for accounts, ledger, budgets, reminders, and dashboard reporting. Investment tracking is deferred to a later feature slice.
5. Dashboard summaries combine account balances, month-to-date cashflow, budget progress, and upcoming reminders.
6. The existing manual transaction MVP is not production-used and can be replaced by the new finance model instead of maintained as a parallel compatibility path.
7. Finance implementation should start with a shared foundation migration and backend model/API skeleton for accounts, ledger entries, balance snapshots, categories, budgets, and reminders before building feature-specific UI.
8. The foundation should support manual entry first while leaving room for later imported or bank-synced ledger entries through explicit source/import metadata.
9. Investment valuation is deferred; a later slice can add investment accounts, securities, positions, investment transactions, price snapshots, and quote-provider adapters.
10. Tax tracking is outside the first full finance management phase.
11. The Finance Dashboard should be a mobile-first, dense, calm operational view with strong first-glance hierarchy, account balance groups, month-to-date cashflow, budget progress, and upcoming-reminder actions; desktop layouts should use the additional space for a richer but still work-focused presentation.
12. Finance keeps a lightweight privacy baseline: backend APIs remain private behind Cockpit, the first phase does not add auth or multi-user hardening, sensitive finance details should not be logged, and finance data should not be sent to third parties without an explicit future integration.
13. Finance dashboard summaries should be computed live from the finance tables first; cached summary tables should wait for a measured performance need.

### Voice

1. Browser VAD is currently disabled, so Cockpit does not capture speech segments in the default UI.
2. When the implemented turn client is invoked, Cockpit posts audio to assistant-service's streaming endpoint.
3. Assistant-service performs `STT -> streamed LLM -> chunked TTS`.
4. Browser plays synthesized chunks as they arrive.
5. Cockpit still exposes a non-streaming server function path for fallback flows.

This flow exists in the Cockpit and assistant-service code, but the assistant service and support runtimes are not active in the default orchestrator compose stack while their service blocks remain commented out.

## Boundary Rules

- Keep UI and presentation concerns in `apps/*`.
- Keep backend business logic and adapters in `services/*`.
- Keep infrastructure/container/migration concerns in `i12e/*`.
- Promote cross-project reusable code into `libs/*` when duplication appears.
- Prefer Cockpit server functions when they already own the boundary; direct browser-to-service calls are reserved for cases like the voice streaming path that need end-to-end streaming semantics.
- In the production baseline, Backend is private and is not exposed directly through the gateway. System-health views should be implemented through Cockpit or another explicit web app boundary.

## Shared Library Packaging

- Workspace libraries can be consumed directly as `workspace:*` packages when the caller's toolchain can compile TypeScript source from the linked package.
- `@central/ts-log` is currently consumed this way by `apps/cockpit`: the package export points at source, and cockpit's Vite build bundles it without a separate library build step.
- If a shared library later needs to be consumed as a prebuilt artifact, switch its package exports to `dist/*`, add the relevant library build as a prerequisite for consumers, and keep Docker dependency-install layers aware of the workspace package manifest.
