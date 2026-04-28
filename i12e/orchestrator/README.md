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

This is the default local-first path. It brings up:

- Cockpit app (`app-cockpit` service)
- PostgreSQL (`i12e-postgres` service)
- Migration runner (`i12e-postgres-migrate`) as a one-off container (`--rm`)
- Weather backend (`service-weather` service)
- Local faster-whisper STT (`service-voice-local-stt` service)
- Local Piper TTS (`service-voice-local-tts` service)
- Ollama runtime (`service-voice-local-llm-runtime` service)
- Local LLM wrapper (`service-voice-local-llm` service)
- Voice backend (`service-voice` service)

## Start dev with explicit local voice target

```bash
pnpm nx run i12e-orchestrator:up-dev-local-voice
```

This target starts the same local voice and local LLM stack as `up-dev`. It keeps `service-voice` in `proxy` mode and points it at:

- `http://service-voice-local-stt:8081/transcribe`
- `http://service-voice-local-tts:8082/synthesize`
- `http://service-voice-local-llm:8083/chat/completions`

The local STT and TTS services use the standard GPU-backed compose configuration. The STT image is built with CUDA runtime dependencies, defaults to `VOICE_LOCAL_STT_DEVICE=cuda` and `VOICE_LOCAL_STT_COMPUTE_TYPE=float16`, and both services request `gpus: all`.

## Start dev with mock STT/TTS and direct Ollama

```bash
pnpm nx run i12e-orchestrator:up-dev-llm-proxy-ollama
```

This keeps `service-voice` in `llm-proxy` mode and points it at:

- `http://service-voice-local-llm-runtime:11434/v1/chat/completions`

This is the thinnest local LLM integration path in the repo because `service-voice` talks to Ollama directly and keeps STT/TTS mocked. The Ollama runtime uses the standard GPU-backed compose configuration and requests `gpus: all`.

## Start dev with GPU-backed local faster-whisper, Piper, and Qwen via Ollama

```bash
pnpm nx run i12e-orchestrator:up-dev-all-local-voice
```

This target is kept as an explicit alias for the default local stack. It keeps `service-voice` in `proxy` mode and points it at:

- `http://service-voice-local-stt:8081/transcribe`
- `http://service-voice-local-tts:8082/synthesize`
- `http://service-voice-local-llm:8083/chat/completions`

This path keeps the `voice-local-llm` wrapper in front of Ollama, which is useful when you want lazy model pulls and a repo-owned adapter boundary. It reuses `VOICE_LLM_MODEL` from `i12e/orchestrator/.env.dev`, with `VOICE_LOCAL_LLM_MODEL` available as an override for the wrapper.
The local STT, local TTS, and Ollama runtime services request `gpus: all` in the main compose file. This requires Docker GPU support on the host, typically NVIDIA Container Toolkit on Linux.

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

This brings up the same service classes as `up-dev`, using the prod ports and model settings from `i12e/orchestrator/.env.prod`:

- Cockpit app (`app-cockpit` service)
- PostgreSQL (`i12e-postgres` service)
- Migration runner (`i12e-postgres-migrate`) as a one-off container (`--rm`)
- Weather backend (`service-weather` service)
- Local faster-whisper STT (`service-voice-local-stt` service)
- Local Piper TTS (`service-voice-local-tts` service)
- Ollama runtime (`service-voice-local-llm-runtime` service)
- Local LLM wrapper (`service-voice-local-llm` service)
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
