# Service Catalog

Source of truth: `i12e/orchestrator/docker-compose.yml`.

## Orchestrated services

| Service                           | Purpose                                        | Container port(s)      |
|-----------------------------------|------------------------------------------------|------------------------|
| `app-cockpit`                     | Cockpit web application                        | `3000/tcp`             |
| `i12e-postgres`                   | PostgreSQL database                            | `5432/tcp`             |
| `i12e-postgres-migrate`           | One-off migration runner                       | None (no exposed port) |
| `service-weather`                 | Weather backend HTTP API                       | `8080/tcp`             |
| `service-voice-local-stt`         | Optional local faster-whisper STT adapter      | `8081/tcp`             |
| `service-voice-local-tts`         | Optional local Piper TTS adapter               | `8082/tcp`             |
| `service-voice-local-llm-runtime` | Optional local Ollama runtime                  | `11434/tcp`            |
| `service-voice-local-llm-pull`    | One-off local Ollama model puller              | None (no exposed port) |
| `service-voice-local-llm`         | Optional local OpenAI-compatible LLM adapter   | `8083/tcp`             |
| `service-voice`                   | Voice turn orchestration (`STT -> LLM -> TTS`) | `8080/tcp`             |

## Host port mappings by environment

Defaults come from:

- `i12e/orchestrator/.env.dev`
- `i12e/orchestrator/.env.prod`

| Service                           | Compose mapping                         | Dev / staging default (host -> container) | Prod default (host -> container) |
|-----------------------------------|-----------------------------------------|-------------------------------------------|----------------------------------|
| `app-cockpit`                     | `${COCKPIT_PORT}:3000`                  | `3000 -> 3000`                            | `4000 -> 3000`                   |
| `i12e-postgres`                   | `${POSTGRES_PORT}:5432`                 | `3001 -> 5432`                            | `4001 -> 5432`                   |
| `i12e-postgres-migrate`           | None                                    | None                                      | None                             |
| `service-weather`                 | `${WEATHER_PORT}:8080`                  | `3010 -> 8080`                            | `4010 -> 8080`                   |
| `service-voice-local-stt`         | `${VOICE_LOCAL_STT_PORT}:8081`          | `3030 -> 8081`                            | Not started by default           |
| `service-voice-local-tts`         | `${VOICE_LOCAL_TTS_PORT}:8082`          | `3040 -> 8082`                            | Not started by default           |
| `service-voice-local-llm-runtime` | `${VOICE_LOCAL_LLM_RUNTIME_PORT}:11434` | `3051 -> 11434`                           | Not started by default           |
| `service-voice-local-llm`         | `${VOICE_LOCAL_LLM_PORT}:8083`          | `3050 -> 8083`                            | Not started by default           |
| `service-voice`                   | `${VOICE_PORT}:8080`                    | `3020 -> 8080`                            | `4020 -> 8080`                   |

## Related environment differences

| Variable                    | Dev                           | Prod                          |
|-----------------------------|-------------------------------|-------------------------------|
| `COCKPIT_NODE_ENV`          | `development`                 | `production`                  |
| `COMPOSE_PROJECT_NAME`      | `central-i12e-dev`            | `central-i12e-prod`           |
| `WEATHER_SERVICE_BASE_URL`  | `http://service-weather:8080` | `http://service-weather:8080` |
| `VOICE_SERVICE_BASE_URL`    | `http://service-voice:8080`   | `http://service-voice:8080`   |
| `VITE_WEATHER_API_BASE_URL` | `http://localhost:3010`       | `http://localhost:4010`       |
| `VITE_VOICE_API_BASE_URL`   | `http://localhost:3020`       | `http://localhost:4020`       |
| `VOICE_BACKEND_MODE`        | `mock`                        | `mock`                        |
| `VOICE_LLM_BASE_URL`        | Empty by default              | Empty by default              |
| `VOICE_LLM_MODEL`           | Empty by default              | Empty by default              |
| `VOICE_STT_URL`             | Empty by default              | Empty by default              |
| `VOICE_TTS_URL`             | Empty by default              | Empty by default              |

## Internal service endpoints (compose network)

| Service                           | Endpoint                                       |
|-----------------------------------|------------------------------------------------|
| `app-cockpit`                     | `http://app-cockpit:3000`                      |
| `i12e-postgres`                   | `i12e-postgres:5432`                           |
| `service-weather`                 | `http://service-weather:8080`                  |
| `service-voice-local-stt`         | `http://service-voice-local-stt:8081`          |
| `service-voice-local-tts`         | `http://service-voice-local-tts:8082`          |
| `service-voice-local-llm-runtime` | `http://service-voice-local-llm-runtime:11434` |
| `service-voice-local-llm`         | `http://service-voice-local-llm:8083`          |
| `service-voice`                   | `http://service-voice:8080`                    |

## Non-orchestrated local dev ports

| Service           | Mode                                                                   | Host port(s) |
|-------------------|------------------------------------------------------------------------|--------------|
| `cockpit`         | Vite dev server (`pnpm nx run cockpit:start`)                          | `5000`       |
| `cockpit`         | Container run (`pnpm nx run cockpit:container-run`)                    | `5000`       |
| `postgres`        | Standalone container run (`pnpm nx run i12e-postgres:run`)             | `5001`       |
| `weather`         | Standalone container run (`pnpm nx run weather-service:container-run`) | `5010`       |
| `voice-local-stt` | Standalone container run (`pnpm nx run voice-local-stt:container-run`) | `5030`       |
| `voice-local-tts` | Standalone container run (`pnpm nx run voice-local-tts:container-run`) | `5040`       |
| `voice-local-llm` | Standalone container run (`pnpm nx run voice-local-llm:container-run`) | `5050`       |
| `voice`           | Standalone container run (`pnpm nx run voice-service:container-run`)   | `5020`       |
