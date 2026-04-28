# i12e-orchestrator

Nx project for orchestrating local infrastructure and app containers.

## Validate

```bash
pnpm nx run i12e-orchestrator:lint
pnpm nx run i12e-orchestrator:test
pnpm nx run i12e-orchestrator:typecheck
pnpm nx run i12e-orchestrator:build
```

## Start all services (dev)

```bash
pnpm nx run i12e-orchestrator:up-dev
```

This is the default development path. It brings up:

- Cockpit app (`app-cockpit` service)
- PostgreSQL (`i12e-postgres` service)
- Migration runner (`i12e-postgres-migrate`) as a one-off container (`--rm`)
- Weather backend (`service-weather` service)
- Faster-whisper STT (`service-stt` service)
- Piper TTS (`service-tts` service)
- Ollama runtime (`service-llm-runtime` service)
- LLM wrapper (`service-llm` service)
- Assistant backend (`service-assistant` service)

The `up-*` Nx targets delegate shared startup sequencing to [`scripts/up_stack.sh`](./scripts/up_stack.sh). Update that script when the common PostgreSQL, migration, Ollama model pull, or service startup flow changes.

## Start dev with explicit voice target

```bash
pnpm nx run i12e-orchestrator:up-dev-voice
```

This target starts the same assistant stack as `up-dev`. It keeps `service-assistant` in `proxy` mode and points it at:

- `http://service-stt:8081/transcribe`
- `http://service-tts:8082/synthesize`
- `http://service-llm:8083/chat/completions`

The STT and TTS services use the standard GPU-backed compose configuration. The STT image is built with CUDA runtime dependencies, defaults to `STT_DEVICE=cuda` and `STT_COMPUTE_TYPE=float16`, and both services request `gpus: all`.

## Start dev with mock STT/TTS and direct Ollama

```bash
pnpm nx run i12e-orchestrator:up-dev-llm-proxy-ollama
```

This keeps `service-assistant` in `llm-proxy` mode and points it at:

- `http://service-llm-runtime:11434/v1/chat/completions`

This is the thinnest LLM integration path in the repo because `service-assistant` talks to Ollama directly and keeps STT/TTS mocked. The Ollama runtime uses the standard GPU-backed compose configuration and requests `gpus: all`.

## Start dev with GPU-backed faster-whisper, Piper, and Qwen via Ollama

```bash
pnpm nx run i12e-orchestrator:up-dev-assistant
```

This target is kept as an explicit alias for the default stack. It keeps `service-assistant` in `proxy` mode and points it at:

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

## Start all services (prod)

```bash
pnpm nx run i12e-orchestrator:up-prod
```

This brings up the same service classes as `up-dev`, using the prod ports and model settings from `i12e/orchestrator/.env.prod`:

- Cockpit app (`app-cockpit` service)
- PostgreSQL (`i12e-postgres` service)
- Migration runner (`i12e-postgres-migrate`) as a one-off container (`--rm`)
- Weather backend (`service-weather` service)
- Faster-whisper STT (`service-stt` service)
- Piper TTS (`service-tts` service)
- Ollama runtime (`service-llm-runtime` service)
- LLM wrapper (`service-llm` service)
- Assistant backend (`service-assistant` service)

Environment defaults are stored in:

- `i12e/orchestrator/.env.dev`
- `i12e/orchestrator/.env.prod`

When cockpit runs inside the compose network, its server-side runtime must reach weather-service through `http://service-weather:8080` and assistant-service through `http://service-assistant:8080`.

Cockpit's browser bundle is separate: in Compose it should use the published host ports (`http://localhost:3010` and `http://localhost:3020` in dev by default) for any direct browser fetches.

Service and port mapping details (including dev/prod differences) are documented in [`docs/service-catalog.md`](../../docs/service-catalog.md).

## Stop all services

```bash
pnpm nx run i12e-orchestrator:down-dev
pnpm nx run i12e-orchestrator:down-prod
```

## Re-run migrations

Requires `i12e-postgres` to already be running.

```bash
pnpm nx run i12e-orchestrator:migrate-dev
pnpm nx run i12e-orchestrator:migrate-prod
```

## Service status and logs

```bash
pnpm nx run i12e-orchestrator:ps-dev
pnpm nx run i12e-orchestrator:logs-dev
pnpm nx run i12e-orchestrator:ps-prod
pnpm nx run i12e-orchestrator:logs-prod
```
