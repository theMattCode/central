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

`VOICE_BACKEND_MODE=mock` is the safest first boot path for local UI integration. Use `VOICE_BACKEND_MODE=llm-proxy` to validate a real LLM first, `VOICE_BACKEND_MODE=openai` for a full OpenAI voice stack, then `VOICE_BACKEND_MODE=proxy` when STT / TTS / LLM upstreams are provided by separate runtimes.

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

Start the development environment with local faster-whisper and Piper adapters wired into `service-voice`:

```bash
nx run i12e-orchestrator:up-dev-local-voice
```

Start the development environment with local faster-whisper, local Piper, and a local Qwen LLM through Ollama:

```bash
nx run i12e-orchestrator:up-dev-all-local-voice
```

This target defaults to `VOICE_LOCAL_LLM_MODEL=qwen2.5:3b` and raises the `service-voice` request timeout to 120 seconds for local inference. Override `VOICE_LOCAL_LLM_MODEL` when you want a larger or different Qwen variant.

Run a full local voice smoke test, including stack startup, STT, LLM, and TTS:

```bash
nx run i12e-orchestrator:smoke-dev-all-local-voice
```

Override `SMOKE_VOICE_TEXT` and `SMOKE_VOICE_LANGUAGE` when you want to exercise a different sample input.

To start the production environment use:

```bash
nx run i12e-orchestrator:up-prod
```

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
