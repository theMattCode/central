# Service Catalog

Source of truth: `i12e/orchestrator/docker-compose.yml`.

## Orchestrated services

| Service                 | Purpose                                            | Container port(s)      |
| ----------------------- | -------------------------------------------------- | ---------------------- |
| `app-cockpit`           | Cockpit web application                            | `3000/tcp`             |
| `i12e-postgres`         | PostgreSQL database                                | `5432/tcp`             |
| `i12e-postgres-migrate` | One-off migration runner                           | None (no exposed port) |
| `service-backend`       | Integrated backend HTTP API                        | `8080/tcp`             |
| `service-stt`           | Faster-whisper STT adapter                         | `8081/tcp`             |
| `service-tts`           | Qwen3-TTS voice-clone adapter                      | `8082/tcp`             |
| `service-llm-runtime`   | Ollama runtime                                     | `11434/tcp`            |
| `service-llm-pull`      | One-off Ollama model puller                        | None (no exposed port) |
| `service-llm`           | OpenAI-compatible LLM adapter                      | `8083/tcp`             |
| `service-assistant`     | Assistant turn orchestration (`STT -> LLM -> TTS`) | `8080/tcp`             |

## Host port mappings by environment

Defaults come from:

- `i12e/orchestrator/.env.dev`
- `i12e/orchestrator/.env.prod.example`

Runtime production values come from ignored `i12e/orchestrator/.env.prod`.

| Service                 | Compose mapping             | Dev / staging default (host -> container) | Prod default (host -> container) |
| ----------------------- | --------------------------- | ----------------------------------------- | -------------------------------- |
| `app-cockpit`           | `${COCKPIT_PORT}:3000`      | `3000 -> 3000`                            | `4000 -> 3000`                   |
| `i12e-postgres`         | `${POSTGRES_PORT}:5432`     | `3001 -> 5432`                            | `4001 -> 5432`                   |
| `i12e-postgres-migrate` | None                        | None                                      | None                             |
| `service-backend`       | `${BACKEND_PORT}:8080`      | `3010 -> 8080`                            | `4010 -> 8080`                   |
| `service-stt`           | `${STT_PORT}:8081`          | `3030 -> 8081`                            | `4030 -> 8081`                   |
| `service-tts`           | `${TTS_PORT}:8082`          | `3040 -> 8082`                            | `4040 -> 8082`                   |
| `service-llm-runtime`   | `${LLM_RUNTIME_PORT}:11434` | `3051 -> 11434`                           | `4051 -> 11434`                  |
| `service-llm`           | `${LLM_PORT}:8083`          | `3050 -> 8083`                            | `4050 -> 8083`                   |
| `service-assistant`     | `${ASSISTANT_PORT}:8080`    | `3020 -> 8080`                            | `4020 -> 8080`                   |

## Related environment differences

| Variable                      | Dev                                  | Prod                                 |
| ----------------------------- | ------------------------------------ | ------------------------------------ |
| `COCKPIT_NODE_ENV`            | `development`                        | `production`                         |
| `COMPOSE_PROJECT_NAME`        | `central-i12e-dev`                   | `central-i12e-prod`                  |
| `BACKEND_BASE_URL`            | `http://service-backend:8080`        | `http://service-backend:8080`        |
| `ASSISTANT_SERVICE_BASE_URL`  | `http://service-assistant:8080`      | `http://service-assistant:8080`      |
| `VITE_BACKEND_API_BASE_URL`   | `http://localhost:3010`              | `http://localhost:4010`              |
| `VITE_ASSISTANT_API_BASE_URL` | `http://localhost:3020`              | `http://localhost:4020`              |
| `ASSISTANT_BACKEND_MODE`      | `proxy`                              | `proxy`                              |
| `STT_URL`                     | `http://service-stt:8081/transcribe` | `http://service-stt:8081/transcribe` |
| `TTS_URL`                     | `http://service-tts:8082/synthesize` | `http://service-tts:8082/synthesize` |
| `LLM_BASE_URL`                | `http://service-llm:8083`            | `http://service-llm:8083`            |
| `LLM_MODEL`                   | `qwen3.5:4b`                         | `qwen3:8b`                           |

## Internal service endpoints (compose network)

| Service               | Endpoint                           |
| --------------------- | ---------------------------------- |
| `app-cockpit`         | `http://app-cockpit:3000`          |
| `i12e-postgres`       | `i12e-postgres:5432`               |
| `service-backend`     | `http://service-backend:8080`      |
| `service-stt`         | `http://service-stt:8081`          |
| `service-tts`         | `http://service-tts:8082`          |
| `service-llm-runtime` | `http://service-llm-runtime:11434` |
| `service-llm`         | `http://service-llm:8083`          |
| `service-assistant`   | `http://service-assistant:8080`    |

## Non-orchestrated local dev ports

| Service             | Mode                                                                     | Host port(s) |
| ------------------- | ------------------------------------------------------------------------ | ------------ |
| `cockpit`           | Vite dev server (`pnpm nx run cockpit:start`)                            | `5000`       |
| `cockpit`           | Container run (`pnpm nx run cockpit:container-run`)                      | `5000`       |
| `postgres`          | Standalone container run (`pnpm nx run i12e-postgres:run`)               | `5001`       |
| `backend`           | Standalone container run (`pnpm nx run backend:container-run`)           | `5010`       |
| `stt-service`       | Standalone container run (`pnpm nx run stt-service:container-run`)       | `5030`       |
| `tts-service`       | Standalone container run (`pnpm nx run tts-service:container-run`)       | `5040`       |
| `llm-service`       | Standalone container run (`pnpm nx run llm-service:container-run`)       | `5050`       |
| `assistant-service` | Standalone container run (`pnpm nx run assistant-service:container-run`) | `5020`       |
