# Toolchain

## Stack

- Monorepo: Nx (integrated workspace)
- Package manager: pnpm
- Frontend framework: TanStack Start (React) + TypeScript
- Backend services: Rust (Axum)
- Routing: TanStack Router
- Build/dev server: Vite (via TanStack Start)
- Styling: Tailwind CSS
- Unit tests: Vitest + Testing Library
- E2E tests: Playwright
- CI: GitHub Actions
- Node requirement: `>=24` (`package.json`, `.nvmrc` uses `lts/*`)

## Command Reference

Run commands from the repository root.

### Setup

```bash
corepack enable
pnpm install
```

### Nx task execution

```bash
nx <target> <project>
nx run-many -t <target>
```

### Nx in sandboxed environments

Nx plugin workers use Unix domain sockets for IPC. In restricted sandboxes this can fail with errors like:

- `Failed to start plugin worker for plugin ...`
- `listen EPERM ... /tmp/.../d.sock`

If this occurs, run Nx commands outside the sandbox.

As a fallback for quick validation, run the underlying project commands directly (for example `pnpm exec vitest run`, `pnpm exec tsc --noEmit`, `pnpm run build`).

### CI-equivalent local check

```bash
nx run-many -t lint test build typecheck
```

### Generate a new TypeScript library

```bash
npx nx g @nx/js:lib libs/<name> --publishable --importPath=@central/<name>
```

### Persistence image project

Build the persistence-layer PostgreSQL image:

```bash
nx build i12e-postgres
```

Run the persistence-layer PostgreSQL container:

```bash
nx run i12e-postgres:run
```

The standalone PostgreSQL run target publishes `5001:5432` by default.

Override standalone container name and port when needed:

```bash
POSTGRES_PORT=55432 POSTGRES_CONTAINER_NAME=central-i12e-postgres-dev pnpm nx run i12e-postgres:run
```

Apply SQL migrations against the running PostgreSQL container:

```bash
nx run i12e-postgres:migrate
```

Create a new SQL migration file:

```bash
MIGRATION_NAME=create_users pnpm nx run i12e-postgres:create-migration
```

### Cockpit container

Build the cockpit container image:

```bash
nx run cockpit:container-build
```

Run the cockpit container image:

```bash
nx run cockpit:container-run
```

The standalone cockpit dev server (`pnpm nx run cockpit:start`) runs on `5000`.

The cockpit container run target publishes `5000:3000`.

### Weather service container

Build the weather service container image:

```bash
nx run weather-service:container-build
```

Run the weather service container image:

```bash
nx run weather-service:container-run
```

The weather container run target publishes `5010:8080`.

Weather update polling defaults to 15 minutes (`WEATHER_REFRESH_INTERVAL_SECONDS=900`), and successful updates are persisted to PostgreSQL via `WEATHER_DATABASE_URL`.

### Assistant service container

Build the assistant service container image:

```bash
nx run assistant-service:container-build
```

Run the assistant service container image:

```bash
nx run assistant-service:container-run
```

The assistant container run target publishes `5020:8080`.

The standalone assistant container still defaults to `ASSISTANT_BACKEND_MODE=mock` unless environment overrides are supplied. The orchestrated dev and prod paths default to `ASSISTANT_BACKEND_MODE=proxy` with STT, TTS, and LLM services wired in.

### STT and TTS containers

Build the faster-whisper STT container image:

```bash
nx run stt-service:build
```

Build the Piper TTS container image:

```bash
nx run tts-service:build
```

Run them standalone when needed:

```bash
nx run stt-service:container-run
nx run tts-service:container-run
```

The standalone STT and TTS containers publish `5030:8081` and `5040:8082`.

### LLM container

Build the Ollama wrapper container image:

```bash
nx run llm-service:build
```

Run it standalone when needed:

```bash
nx run llm-service:container-run
```

The standalone LLM wrapper publishes `5050:8083`.

### Orchestrator project

Start the complete development environment with all required services:

```bash
nx run i12e-orchestrator:up-dev
```

This is the default development path. It starts PostgreSQL, weather, cockpit, faster-whisper STT, Piper TTS, the Ollama runtime, the LLM wrapper, and `service-assistant`.

The orchestrator `up-*` targets share startup sequencing through `i12e/orchestrator/scripts/up_stack.sh`.

The explicit voice target remains available and starts the same assistant stack:

```bash
nx run i12e-orchestrator:up-dev-voice
```

Start the development environment with mock STT / TTS and direct Ollama chat completions:

```bash
nx run i12e-orchestrator:up-dev-llm-proxy-ollama
```

This keeps `service-assistant` in `llm-proxy` mode and points `LLM_BASE_URL` at the Ollama runtime's OpenAI-compatible `/v1` endpoint.

Start the development environment with faster-whisper, Piper, and a Qwen LLM through Ollama:

```bash
nx run i12e-orchestrator:up-dev-assistant
```

This target is kept as an explicit alias for the default stack. It keeps the `llm-service` wrapper in front of Ollama for the full STT / TTS / LLM stack and reuses `LLM_MODEL` from `i12e/orchestrator/.env.dev`.
The tracked `i12e/orchestrator/.env.dev` biases this path toward quality over speed with a larger STT model, less aggressive extra STT VAD, and slightly less choppy TTS streaming.
The main compose file is GPU-backed by default for assistant support services: `service-stt`, `service-tts`, and `service-llm-runtime` request `gpus: all`. STT defaults to CUDA/FP16, TTS defaults to CUDA, and the stack requires a Docker host with working GPU container support.

Run a full voice smoke test, including stack startup, STT, LLM, and TTS:

```bash
nx run i12e-orchestrator:smoke-dev-voice
```

Override `SMOKE_VOICE_TEXT` and `SMOKE_VOICE_LANGUAGE` when you want to exercise a different sample input.

To start the production environment use:

```bash
nx run i12e-orchestrator:up-prod
```

The production target starts the same service classes by default, using the prod port mappings from `i12e/orchestrator/.env.prod`.

The migration step runs as a one-off `postgres-migrate` container and is removed after completion.

For a complete list of orchestrated services and their port mappings, see [Service Catalog](./service-catalog.md).

Stop all orchestrated services:

```bash
nx run i12e-orchestrator:down-dev
nx run i12e-orchestrator:down-prod
```

Re-run migrations (requires PostgreSQL to already be running):

```bash
nx run i12e-orchestrator:migrate-dev
nx run i12e-orchestrator:migrate-prod
```

### Keep TypeScript project references up to date

Nx automatically updates TypeScript project references in `tsconfig.json` files to ensure they remain accurate based on project dependencies.

To manually trigger sync:

```bash
npx nx sync
```

To check sync state:

```bash
npx nx sync:check
```
