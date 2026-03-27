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

## Start dev with local faster-whisper and Piper

```bash
pnpm nx run i12e-orchestrator:up-dev-local-voice
```

This keeps `service-voice` in `proxy` mode and points it at:

- `http://service-voice-local-stt:8081/transcribe`
- `http://service-voice-local-tts:8082/synthesize`

## Start dev with local faster-whisper, Piper, and Qwen via Ollama

```bash
pnpm nx run i12e-orchestrator:up-dev-all-local-voice
```

This keeps `service-voice` in `proxy` mode and points it at:

- `http://service-voice-local-stt:8081/transcribe`
- `http://service-voice-local-tts:8082/synthesize`
- `http://service-voice-local-llm:8083/chat/completions`

The default local model is `qwen2.5:3b`. Override it with `VOICE_LOCAL_LLM_MODEL` when you want a different Qwen variant. If only `VOICE_LLM_MODEL` is set in `i12e/orchestrator/.env.dev`, the all-local-voice dev target now reuses that value for the local Ollama wrapper as well.

## Start dev with local voice + GPU-backed Ollama

```bash
pnpm nx run i12e-orchestrator:up-dev-all-local-voice-gpu
```

This applies [`docker-compose.gpu.yml`](./docker-compose.gpu.yml) and requests `gpus: all` for `service-voice-local-llm-runtime`. It requires Docker GPU support on the host, typically NVIDIA Container Toolkit on Linux.

## Smoke-test the complete local voice stack

```bash
pnpm nx run i12e-orchestrator:smoke-dev-all-local-voice
```

This target starts the complete local voice stack if needed, then runs one spoken roundtrip through local STT, local Qwen via Ollama, and local TTS.

Override these environment variables when needed:

- `SMOKE_VOICE_TEXT`
- `SMOKE_VOICE_LANGUAGE`

## Start all services (prod)

```bash
pnpm nx run i12e-orchestrator:up-prod
```

This brings up:

- Cockpit app (`app-cockpit` service)
- PostgreSQL (`i12e-postgres` service)
- Migration runner (`i12e-postgres-migrate`) as a one-off container (`--rm`)
- Weather backend (`service-weather` service)
- Voice backend (`service-voice` service)

Environment defaults are stored in:

- `i12e/orchestrator/.env.dev`
- `i12e/orchestrator/.env.prod`

When cockpit runs inside the compose network, its server-side runtime must reach weather-service through `http://service-weather:8080` and voice-service through `http://service-voice:8080`.

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
