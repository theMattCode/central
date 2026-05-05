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
- Backend and assistant run under `cargo watch`.
- STT, TTS, and LLM adapter containers restart when their Python source changes.

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
- `ASSISTANT_CORS_ALLOW_ORIGIN`

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

The `up-*` Nx targets delegate startup sequencing to [`scripts/up_stack.sh`](./scripts/up_stack.sh).

Startup order:

1. Start PostgreSQL with Compose health waiting.
2. Run migrations.
3. Start Ollama with Compose health waiting.
4. Pull configured model.
5. Start application services.

Long-running services use `SERVICE_RESTART_POLICY`; dev sets `no`, prod example sets `unless-stopped`.

## Advanced Targets

Release-style detached development stack:

```bash
pnpm nx run i12e-orchestrator:up-dev
```

Dev with mock STT/TTS and direct Ollama:

```bash
pnpm nx run i12e-orchestrator:up-dev-llm-proxy-ollama
```

This keeps `service-assistant` in `llm-proxy` mode and points it at:

- `http://service-llm-runtime:11434/v1/chat/completions`

This is the thinnest LLM integration path in the repo because `service-assistant` talks to Ollama directly and keeps STT/TTS mocked. The Ollama runtime uses the standard GPU-backed compose configuration and requests `gpus: all`.

## Default assistant stack

`up-dev`, `up-dev-hot`, and `pnpm dev` keep `service-assistant` in `proxy` mode and point it at:

- `http://service-stt:8081/transcribe`
- `http://service-tts:8082/synthesize`
- `http://service-llm:8083/chat/completions`

This path keeps the `llm-service` wrapper in front of Ollama, which is useful when you want lazy model pulls and a repo-owned adapter boundary. It reuses `LLM_MODEL` from `i12e/orchestrator/.env.dev`.
The STT, TTS, and Ollama runtime services request `gpus: all` in the main compose file. This requires Docker GPU support on the host, typically NVIDIA Container Toolkit on Linux.

## Smoke-test the complete voice stack

```bash
pnpm nx run i12e-orchestrator:smoke-dev-voice
```

This target starts the complete voice stack if needed, then runs one spoken roundtrip through STT, Qwen via Ollama, and TTS.

Override these environment variables when needed:

- `SMOKE_VOICE_TEXT`
- `SMOKE_VOICE_LANGUAGE`

`pnpm dev`, `pnpm prod`, and advanced `up-*` targets bring up:

- Cockpit app (`app-cockpit` service)
- PostgreSQL (`i12e-postgres` service)
- Migration runner (`i12e-postgres-migrate`) as a one-off container (`--rm`)
- Backend (`service-backend` service, currently serving the weather domain)
- Faster-whisper STT (`service-stt` service)
- Qwen3-TTS voice cloning (`service-tts` service)
- Ollama runtime (`service-llm-runtime` service)
- LLM wrapper (`service-llm` service)
- Assistant backend (`service-assistant` service)

Environment files:

- `i12e/orchestrator/.env.dev`: tracked local dev defaults.
- `i12e/orchestrator/.env.prod.example`: tracked production template.
- `i12e/orchestrator/.env.prod`: ignored local production config.

When cockpit runs inside the compose network, its server-side runtime must reach backend through `http://service-backend:8080` and assistant-service through `http://service-assistant:8080`.

Cockpit's browser bundle is separate: in Compose it should use the published host ports (`http://localhost:3010` and `http://localhost:3020` in dev by default) for any direct browser fetches.

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
