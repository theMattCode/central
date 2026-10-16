# i12e-orchestrator

Docker Compose definitions and scripts that run Central locally and in production.

## Files

| File                                                                 | Purpose                                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`docker-compose.yml`](./docker-compose.yml)                         | Local hot-reload dev stack (`pnpm dev`), voice services behind `voice`. |
| [`.env.dev`](./.env.dev)                                             | Tracked dev defaults.                                                   |
| [`deploy/docker-compose.prod.yml`](./deploy/docker-compose.prod.yml) | Production stack; shipped in the deploy bundle.                         |
| [`deploy/.env.prod.example`](./deploy/.env.prod.example)             | Production env template, for the server and for local `pnpm prod`.      |
| [`deploy/central-update`](./deploy/central-update)                   | Server update script; shipped in the deploy bundle.                     |
| [`docker-compose.prod.local.yml`](./docker-compose.prod.local.yml)   | Overlay that builds the production image set from the checkout.         |
| [`scripts/stack.sh`](./scripts/stack.sh)                             | Single entrypoint behind the root `pnpm` scripts.                       |
| [`scripts/smoke_voice.py`](./scripts/smoke_voice.py)                 | Spoken roundtrip smoke test through STT, LLM, and TTS.                  |

## Commands

| Command                                     | What it does                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                                  | Start PostgreSQL, run migrations, then `compose watch` the dev stack.       |
| `COMPOSE_PROFILES=voice pnpm dev`           | Same, including assistant, STT, TTS, Ollama runtime, and LLM adapter.       |
| `pnpm prod`                                 | Build the release image set locally and run it with the production compose. |
| `pnpm dev:down` / `pnpm prod:down`          | Stop the stack (all profiles).                                              |
| `pnpm logs:dev` / `pnpm logs:prod`          | Follow logs.                                                                |
| `pnpm ps:dev` / `pnpm ps:prod`              | Show service status.                                                        |
| `pnpm migrate:dev` / `pnpm migrate:prod`    | Re-run migrations against a running PostgreSQL.                             |
| `pnpm nx run i12e-orchestrator:smoke-voice` | Start the dev stack with the voice profile detached and run the smoke test. |
| `pnpm nx run i12e-orchestrator:lint`        | Syntax-check scripts and validate every compose configuration.              |

Any other compose command can go through the script, for example
`sh i12e/orchestrator/scripts/stack.sh dev exec service-backend sh`.

## Local production stack

Create the ignored env file once and replace the placeholder values:

```bash
cp i12e/orchestrator/deploy/.env.prod.example i12e/orchestrator/.env.prod
```

`pnpm prod` refuses placeholder DB credentials or wildcard CORS. It tags locally built images as
`ghcr.io/themattcode/central/<service>:local`, so they never collide with pulled release tags, and exposes only the
gateway (`127.0.0.1:4000` by default), like the production server.

## Voice profile

STT, TTS, and the Ollama runtime request `gpus: all` and need Docker GPU support on the host (typically NVIDIA Container
Toolkit on Linux). The assistant defaults to `proxy` mode and calls:

- `http://service-stt:8081/transcribe`
- `http://service-tts:8082/synthesize`
- `http://service-llm:8083/chat/completions`

For the thinnest LLM path, keep STT/TTS mocked and let the assistant talk to Ollama directly:

```bash
COMPOSE_PROFILES=voice ASSISTANT_BACKEND_MODE=llm-proxy LLM_BASE_URL=http://service-llm-runtime:11434/v1 pnpm dev
```

The smoke test reads `SMOKE_VOICE_TEXT` and `SMOKE_VOICE_LANGUAGE`.

Ports and environment differences are listed in the [service catalog](../../docs/service-catalog.md); production
releases are described in [deployment](../../docs/deployment.md).
