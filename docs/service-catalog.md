# Service Catalog

Source of truth:

- Local dev/release-style stack: `i12e/orchestrator/docker-compose.yml`
- Production server deploy bundle: `i12e/orchestrator/deploy/docker-compose.prod.yml`

## Active local orchestrator services

| Service                 | Purpose                     | Container port(s)      |
|-------------------------|-----------------------------|------------------------|
| `app-cockpit`           | Cockpit web application     | `3000/tcp`             |
| `i12e-postgres`         | PostgreSQL database         | `5432/tcp`             |
| `i12e-postgres-migrate` | One-off migration runner    | None (no exposed port) |
| `service-backend`       | Integrated backend HTTP API | `8080/tcp`             |

The local orchestrator currently starts only PostgreSQL, migrations, Backend, and Cockpit.

## Active production deploy services

| Service                 | Purpose                                 | Container port(s)      |
|-------------------------|-----------------------------------------|------------------------|
| `app-cockpit`           | Cockpit web application                 | `3000/tcp`             |
| `i12e-gateway`          | Production Nginx entrypoint for Cockpit | `8080/tcp`             |
| `i12e-postgres`         | PostgreSQL database                     | `5432/tcp`             |
| `i12e-postgres-migrate` | One-off migration runner                | None (no exposed port) |
| `service-backend`       | Integrated backend HTTP API             | `8080/tcp`             |

## Implemented but not active in orchestrator

These services have project code and standalone Nx targets, but their orchestrator compose blocks are commented out.

| Service               | Purpose                                            | Container port(s)      |
|-----------------------|----------------------------------------------------|------------------------|
| `service-stt`         | Faster-whisper STT adapter                         | `8081/tcp`             |
| `service-tts`         | Qwen3-TTS voice-clone adapter                      | `8082/tcp`             |
| `service-llm-runtime` | Ollama runtime                                     | `11434/tcp`            |
| `service-llm-pull`    | One-off Ollama model puller                        | None (no exposed port) |
| `service-llm`         | OpenAI-compatible LLM adapter                      | `8083/tcp`             |
| `service-assistant`   | Assistant turn orchestration (`STT -> LLM -> TTS`) | `8080/tcp`             |

## Production server host port mappings

Production server deployment uses the code-free deploy bundle. It exposes only the gateway by default.

| Service           | Compose mapping                        | Default host -> container |
|-------------------|----------------------------------------|---------------------------|
| `i12e-gateway`    | `${GATEWAY_BIND}:${GATEWAY_PORT}:8080` | `127.0.0.1:4000 -> 8080`  |
| `app-cockpit`     | None                                   | None                      |
| `service-backend` | None                                   | None                      |
| `i12e-postgres`   | None                                   | None                      |

Tailscale is managed by the host and can forward HTTPS traffic to `127.0.0.1:4000`.

## Local host port mappings by environment

Defaults come from:

- `i12e/orchestrator/.env.dev`
- `i12e/orchestrator/.env.prod.example` for local release-style testing

Runtime local production values come from ignored `i12e/orchestrator/.env.prod`.

| Service                 | Compose mapping         | Dev / staging default (host -> container) | Prod default (host -> container) |
|-------------------------|-------------------------|-------------------------------------------|----------------------------------|
| `app-cockpit`           | `${COCKPIT_PORT}:3000`  | `3000 -> 3000`                            | `4000 -> 3000`                   |
| `i12e-postgres`         | `${POSTGRES_PORT}:5432` | `3001 -> 5432`                            | `4001 -> 5432`                   |
| `i12e-postgres-migrate` | None                    | None                                      | None                             |
| `service-backend`       | `${BACKEND_PORT}:8080`  | `3010 -> 8080`                            | `4010 -> 8080`                   |

The assistant, STT, TTS, and LLM port variables still exist in env templates but are inactive until the matching compose service blocks are re-enabled.

If re-enabled in `i12e/orchestrator/docker-compose.yml`, their local compose host mappings would be:

| Service               | Compose mapping             | Dev default (host -> container) | Local prod template default (host -> container) |
|-----------------------|-----------------------------|---------------------------------|-------------------------------------------------|
| `service-assistant`   | `${ASSISTANT_PORT}:8080`    | `3020 -> 8080`                  | `4020 -> 8080`                                  |
| `service-stt`         | `${STT_PORT}:8081`          | `3030 -> 8081`                  | `4030 -> 8081`                                  |
| `service-tts`         | `${TTS_PORT}:8082`          | `3040 -> 8082`                  | `4040 -> 8082`                                  |
| `service-llm-runtime` | `${LLM_RUNTIME_PORT}:11434` | `3051 -> 11434`                 | `4051 -> 11434`                                 |
| `service-llm`         | `${LLM_PORT}:8083`          | `3050 -> 8083`                  | `4050 -> 8083`                                  |

## Related environment differences

| Variable                    | Dev                           | Prod                          |
|-----------------------------|-------------------------------|-------------------------------|
| `COCKPIT_NODE_ENV`          | `development`                 | `production`                  |
| `COMPOSE_PROJECT_NAME`      | `central-i12e-dev`            | `central-i12e-prod`           |
| `BACKEND_BASE_URL`          | `http://service-backend:8080` | `http://service-backend:8080` |
| `VITE_BACKEND_API_BASE_URL` | `http://localhost:3010`       | `http://localhost:4010`       |

The code-free production deploy bundle adds:

| Variable          | Production default               |
|-------------------|----------------------------------|
| `CENTRAL_VERSION` | `stable`                         |
| `GATEWAY_BIND`    | `127.0.0.1`                      |
| `GATEWAY_PORT`    | `4000`                           |
| `CENTRAL_ORIGIN`  | `https://central.example.ts.net` |

## Internal service endpoints (compose network)

| Service           | Endpoint                      |
|-------------------|-------------------------------|
| `i12e-gateway`    | `http://i12e-gateway:8080`    |
| `app-cockpit`     | `http://app-cockpit:3000`     |
| `i12e-postgres`   | `i12e-postgres:5432`          |
| `service-backend` | `http://service-backend:8080` |

Assistant, STT, TTS, and LLM endpoints exist only when their commented compose blocks are re-enabled or when services are run standalone.

## Non-orchestrated local dev ports

| Service             | Mode                                                                     | Host port(s) |
|---------------------|--------------------------------------------------------------------------|--------------|
| `cockpit`           | Vite dev server (`pnpm nx run cockpit:start`)                            | `5000`       |
| `cockpit`           | Container run (`pnpm nx run cockpit:container-run`)                      | `5000`       |
| `postgres`          | Standalone container run (`pnpm nx run i12e-postgres:run`)               | `5001`       |
| `backend`           | Standalone container run (`pnpm nx run backend:container-run`)           | `5010`       |
| `stt-service`       | Standalone container run (`pnpm nx run stt-service:container-run`)       | `5030`       |
| `tts-service`       | Standalone container run (`pnpm nx run tts-service:container-run`)       | `5040`       |
| `llm-service`       | Standalone container run (`pnpm nx run llm-service:container-run`)       | `5050`       |
| `assistant-service` | Standalone container run (`pnpm nx run assistant-service:container-run`) | `5020`       |
