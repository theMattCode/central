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
- CI: GitHub Actions, publishing tested release images to GHCR for tagged releases
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

The persistence image uses PostgreSQL 18.3. Existing local PostgreSQL 16 data volumes cannot be reused directly with PostgreSQL 18; recreate the local dev volume or dump/restore data before running the upgraded image.

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

### Backend service container

Build the backend service container image:

```bash
nx run backend:container-build
```

Run the backend service container image:

```bash
nx run backend:container-run
```

The backend container run target publishes `5010:8080`.

Weather update polling defaults to 15 minutes (`WEATHER_REFRESH_INTERVAL_SECONDS=900`), and successful updates are persisted to PostgreSQL via `BACKEND_DATABASE_URL`.

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

Build the Qwen3-TTS container image:

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

Start the complete hot-reload development environment:

```bash
pnpm dev
```

This delegates to `nx run i12e-orchestrator:dev` / `up-dev-hot`. It starts PostgreSQL, runs migrations, starts Ollama and pulls the configured model, then starts the service stack with the dev compose overlay:

- `app-cockpit` runs the Vite dev server for browser HMR.
- `service-backend` and `service-assistant` run through `cargo watch`.
- `service-stt`, `service-tts`, and `service-llm` use Docker Compose watch with restart-on-change.

Stop the dev stack with:

```bash
pnpm dev:down
```

Create the ignored production env file once:

```bash
cp i12e/orchestrator/.env.prod.example i12e/orchestrator/.env.prod
```

Set real production values in `i12e/orchestrator/.env.prod`, especially DB password and CORS origins.

Start the production environment:

```bash
pnpm prod
```

The long-term production deployment path is the code-free deploy bundle under `i12e/orchestrator/deploy`. CI publishes release images to GHCR and packages:

- `docker-compose.prod.yml`
- `central-update`
- `.env.prod.example`

On the production host, run `./central-update` from the unpacked bundle and choose `stable` or an exact release tag such as `v1.2.3`.

Stop it with:

```bash
pnpm prod:down
```

The orchestrator `up-*` targets share startup sequencing through `i12e/orchestrator/scripts/up_stack.sh`.
Startup waits for PostgreSQL and Ollama health before running migrations or pulling the configured model.
Long-running services use `SERVICE_RESTART_POLICY`; dev defaults to `no`, prod example defaults to `unless-stopped`.

Advanced targets:

```bash
nx run i12e-orchestrator:up-dev
nx run i12e-orchestrator:up-dev-llm-proxy-ollama
```

`up-dev` starts release-style dev containers without watchers.
`up-dev-llm-proxy-ollama` keeps `service-assistant` in `llm-proxy` mode and points `LLM_BASE_URL` at the Ollama runtime's OpenAI-compatible `/v1` endpoint.

The tracked `i12e/orchestrator/.env.dev` biases this path toward quality over speed with a larger STT model, less aggressive extra STT VAD, and slightly less choppy TTS streaming.
The main compose file is GPU-backed by default for assistant support services: `service-stt`, `service-tts`, and `service-llm-runtime` request `gpus: all`. STT defaults to CUDA/FP16, TTS defaults to CUDA with FlashAttention 2 installed from a prebuilt wheel, and the stack requires a Docker host with working GPU container support.

Run a full voice smoke test, including stack startup, STT, LLM, and TTS:

```bash
nx run i12e-orchestrator:smoke-dev-voice
```

Override `SMOKE_VOICE_TEXT` and `SMOKE_VOICE_LANGUAGE` when you want to exercise a different sample input.

The production target starts the same service classes by default, using port mappings from ignored `i12e/orchestrator/.env.prod`.

The migration step runs as a one-off `postgres-migrate` container and is removed after completion.

For a complete list of orchestrated services and their port mappings, see [Service Catalog](./service-catalog.md).

Stop all orchestrated services:

```bash
pnpm dev:down
pnpm prod:down
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
