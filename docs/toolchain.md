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

### Voice service container

Build the voice service container image:

```bash
nx run voice-service:container-build
```

Run the voice service container image:

```bash
nx run voice-service:container-run
```

The voice container run target publishes `5020:8080`.

The standalone voice container still defaults to `VOICE_BACKEND_MODE=mock` unless environment overrides are supplied. The orchestrated dev and prod paths default to `VOICE_BACKEND_MODE=proxy` with local STT, TTS, and LLM services wired in.

### Local STT and TTS containers

Build the local faster-whisper STT container image:

```bash
nx run voice-local-stt:build
```

Build the local Piper TTS container image:

```bash
nx run voice-local-tts:build
```

Run them standalone when needed:

```bash
nx run voice-local-stt:container-run
nx run voice-local-tts:container-run
```

The standalone local STT and TTS containers publish `5030:8081` and `5040:8082`.

### Local LLM container

Build the local Ollama wrapper container image:

```bash
nx run voice-local-llm:build
```

Run it standalone when needed:

```bash
nx run voice-local-llm:container-run
```

The standalone local LLM wrapper publishes `5050:8083`.

### Orchestrator project

Start the complete development environment with all required services:

```bash
nx run i12e-orchestrator:up-dev
```

This is the default local-first path. It starts PostgreSQL, weather, cockpit, local faster-whisper STT, local Piper TTS, the Ollama runtime, the local LLM wrapper, and `service-voice` wired through those local voice and model services.

The explicit local voice target remains available and starts the same local voice and local LLM stack:

```bash
nx run i12e-orchestrator:up-dev-local-voice
```

Start the development environment with mock STT / TTS and direct Ollama chat completions:

```bash
nx run i12e-orchestrator:up-dev-llm-proxy-ollama
```

This keeps `service-voice` in `llm-proxy` mode and points `VOICE_LLM_BASE_URL` at the Ollama runtime's OpenAI-compatible `/v1` endpoint.

Start the development environment with local faster-whisper, local Piper, and a local Qwen LLM through Ollama:

```bash
nx run i12e-orchestrator:up-dev-all-local-voice
```

This target is kept as an explicit alias for the default local stack. It keeps the `voice-local-llm` wrapper in front of Ollama for the full local STT / TTS / LLM stack. It reuses `VOICE_LLM_MODEL` from `i12e/orchestrator/.env.dev`, with `VOICE_LOCAL_LLM_MODEL` available as an override for the wrapper.
The tracked `i12e/orchestrator/.env.dev` now also biases this path toward quality over speed with a larger local STT model, less aggressive extra STT VAD, and slightly less choppy local TTS streaming.
The main compose file is GPU-backed by default for local voice services: `service-voice-local-stt`, `service-voice-local-tts`, and `service-voice-local-llm-runtime` request `gpus: all`. Local STT defaults to CUDA/FP16, local TTS defaults to CUDA, and the stack requires a Docker host with working GPU container support.

Run a full local voice smoke test, including stack startup, STT, LLM, and TTS:

```bash
nx run i12e-orchestrator:smoke-dev-all-local-voice
```

Override `SMOKE_VOICE_TEXT` and `SMOKE_VOICE_LANGUAGE` when you want to exercise a different sample input.

To start the production environment use:

```bash
nx run i12e-orchestrator:up-prod
```

The production target also starts the local voice and local LLM services by default, using the prod port mappings from `i12e/orchestrator/.env.prod`.

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
