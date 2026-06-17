# i12e-orchestrator

Nx project for orchestrating local infrastructure and app containers.

## Validate

```bash
pnpm nx run i12e-orchestrator:lint
pnpm nx run i12e-orchestrator:test
pnpm nx run i12e-orchestrator:typecheck
pnpm nx run i12e-orchestrator:build
```

## Daily Commands

Start the hot development stack:

```bash
pnpm dev
```

This delegates to `pnpm nx run i12e-orchestrator:dev`, which starts the stack with [`docker-compose.dev.yml`](./docker-compose.dev.yml):

- Cockpit runs Vite dev server HMR.
- Backend runs under `cargo watch`.
- Assistant, STT, TTS, and LLM adapter compose blocks are currently commented out, so they are not part of `pnpm dev`.

Stop it with:

```bash
pnpm dev:down
```

Create the local production env file once:

```bash
cp i12e/orchestrator/.env.prod.example i12e/orchestrator/.env.prod
```

Edit `i12e/orchestrator/.env.prod` and set real secrets, especially:

- `POSTGRES_PASSWORD`
- `BACKEND_DATABASE_URL`
- `BACKEND_CORS_ALLOW_ORIGIN`
- `ASSISTANT_CORS_ALLOW_ORIGIN` if assistant services are re-enabled

Prod startup refuses placeholder DB credentials or wildcard CORS.

Start the release-style production stack:

```bash
pnpm prod
```

Stop it with:

```bash
pnpm prod:down
```

Check status and logs:

```bash
pnpm ps:dev
pnpm logs:dev
pnpm ps:prod
pnpm logs:prod
```

## Startup Behavior

`pnpm prod` is the local release-style stack used from the repository checkout. The production-server path is the code-free deploy bundle in [`deploy/`](./deploy/): CI publishes tested images to GHCR, and the server runs `central-update` with `stable` or an exact release tag.

The `up-*` Nx targets delegate startup sequencing to [`scripts/up_stack.sh`](./scripts/up_stack.sh).

Startup order:

1. Start PostgreSQL with Compose health waiting.
2. Run migrations.
3. Start application services.

Long-running services use `SERVICE_RESTART_POLICY`; dev sets `no`, prod example sets `unless-stopped`.

## Advanced Targets

Release-style detached development stack:

```bash
pnpm nx run i12e-orchestrator:up-dev
```

Experimental dev with mock STT/TTS and direct Ollama:

```bash
pnpm nx run i12e-orchestrator:up-dev-llm-proxy-ollama
```

This target currently references assistant and Ollama compose services that are commented out in `docker-compose.yml`. If those services are re-enabled, it keeps `service-assistant` in `llm-proxy` mode and points it at:

- `http://service-llm-runtime:11434/v1/chat/completions`

This is the thinnest LLM integration path in the repo because `service-assistant` talks to Ollama directly and keeps STT/TTS mocked. The commented Ollama runtime definition requests `gpus: all`.

## Default assistant stack

The default assistant stack is implemented in service code but disabled in the active orchestrator compose files. The commented configuration keeps `service-assistant` in `proxy` mode and points it at:

- `http://service-stt:8081/transcribe`
- `http://service-tts:8082/synthesize`
- `http://service-llm:8083/chat/completions`

This path keeps the `llm-service` wrapper in front of Ollama, which is useful when you want lazy model pulls and a repo-owned adapter boundary. It reuses `LLM_MODEL` from `i12e/orchestrator/.env.dev`.
The STT, TTS, and Ollama runtime service definitions request `gpus: all`. Re-enabling them requires Docker GPU support on the host, typically NVIDIA Container Toolkit on Linux.

## Experimental voice stack smoke test

```bash
pnpm nx run i12e-orchestrator:smoke-dev-voice
```

This target depends on the currently commented assistant support services. Once those are re-enabled, it starts the voice stack if needed, then runs one spoken roundtrip through STT, Qwen via Ollama, and TTS.

Override these environment variables when needed:

- `SMOKE_VOICE_TEXT`
- `SMOKE_VOICE_LANGUAGE`

`pnpm dev`, `pnpm prod`, and `up-dev` bring up:

- Cockpit app (`app-cockpit` service)
- PostgreSQL (`i12e-postgres` service)
- Migration runner (`i12e-postgres-migrate`) as a one-off container (`--rm`)
- Backend (`service-backend` service, serving finance and weather domains)

Assistant backend, Faster-whisper STT, Qwen3-TTS, Ollama runtime, and LLM wrapper code exists in `services/*`, but the orchestrator service blocks are commented out.

Environment files:

- `i12e/orchestrator/.env.dev`: tracked local dev defaults.
- `i12e/orchestrator/.env.prod.example`: tracked production template.
- `i12e/orchestrator/.env.prod`: ignored local production config.

When cockpit runs inside the compose network, its server-side runtime reaches backend through `http://service-backend:8080`.

Cockpit's browser bundle is separate: in Compose it should use the published host port (`http://localhost:3010` in dev by default) for any direct browser fetches.

Service and port mapping details (including dev/prod differences) are documented in [`docs/service-catalog.md`](../../docs/service-catalog.md).

## Stop all services

```bash
pnpm dev:down
pnpm prod:down
```

## Re-run migrations

Requires `i12e-postgres` to already be running.

```bash
pnpm nx run i12e-orchestrator:migrate-dev
pnpm nx run i12e-orchestrator:migrate-prod
```

## Service status and logs

```bash
pnpm ps:dev
pnpm logs:dev
pnpm ps:prod
pnpm logs:prod
```
