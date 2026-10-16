# Service Catalog

Single reference for services, ports, and environment differences. Source of truth:

- Dev stack: [`i12e/orchestrator/docker-compose.yml`](../i12e/orchestrator/docker-compose.yml) with `.env.dev`
- Production (server and local `pnpm prod`):
  [`i12e/orchestrator/deploy/docker-compose.prod.yml`](../i12e/orchestrator/deploy/docker-compose.prod.yml) with
  `.env.prod`

Port ranges: `3xxx` is the dev stack, `4000` is the production gateway. Native `cargo run` defaults are listed in each
service README.

## Services

| Service                 | Purpose                                        | Container port | Dev host port | Prod host port   |
| ----------------------- | ---------------------------------------------- | -------------- | ------------- | ---------------- |
| `app-cockpit`           | Cockpit web application                        | `3000`         | `3000`        | —                |
| `i12e-postgres`         | PostgreSQL database                            | `5432`         | `3001`        | —                |
| `i12e-postgres-migrate` | One-off migration runner                       | —              | —             | —                |
| `service-backend`       | Integrated backend HTTP API                    | `8080`         | `3010`        | —                |
| `i12e-gateway`          | Nginx entrypoint for Cockpit (production only) | `8080`         | —             | `127.0.0.1:4000` |

### Voice profile (dev only, `COMPOSE_PROFILES=voice`)

| Service               | Purpose                                            | Container port | Dev host port |
| --------------------- | -------------------------------------------------- | -------------- | ------------- |
| `service-assistant`   | Assistant turn orchestration (`STT -> LLM -> TTS`) | `8080`         | `3020`        |
| `service-stt`         | Faster-whisper STT adapter                         | `8081`         | `3030`        |
| `service-tts`         | Qwen3-TTS voice-clone adapter                      | `8082`         | `3040`        |
| `service-llm`         | OpenAI-compatible LLM adapter                      | `8083`         | `3050`        |
| `service-llm-runtime` | Ollama runtime                                     | `11434`        | `3051`        |
| `service-llm-pull`    | One-off Ollama model puller                        | —              | —             |

Dev host ports come from `COCKPIT_PORT`, `POSTGRES_PORT`, `BACKEND_PORT`, `ASSISTANT_PORT`, `STT_PORT`, `TTS_PORT`,
`LLM_PORT`, and `LLM_RUNTIME_PORT`. In production only the gateway is published (`GATEWAY_BIND`, `GATEWAY_PORT`);
Tailscale on the host forwards HTTPS traffic to it. The standalone Cockpit Vite server (`app-cockpit:start`) uses
port `5000`.

## Internal endpoints (compose network)

| Service             | Endpoint                        |
| ------------------- | ------------------------------- |
| `i12e-gateway`      | `http://i12e-gateway:8080`      |
| `app-cockpit`       | `http://app-cockpit:3000`       |
| `i12e-postgres`     | `i12e-postgres:5432`            |
| `service-backend`   | `http://service-backend:8080`   |
| `service-assistant` | `http://service-assistant:8080` |
| `service-stt`       | `http://service-stt:8081`       |
| `service-tts`       | `http://service-tts:8082`       |
| `service-llm`       | `http://service-llm:8083`       |

## Environment differences

| Variable                    | Dev                     | Production                                          |
| --------------------------- | ----------------------- | --------------------------------------------------- |
| `COMPOSE_PROJECT_NAME`      | `central-i12e-dev`      | `central`                                           |
| `SERVICE_RESTART_POLICY`    | `no`                    | `unless-stopped`                                    |
| `BACKEND_CORS_ALLOW_ORIGIN` | `*`                     | the public origin                                   |
| `VITE_BACKEND_API_BASE_URL` | `http://localhost:3010` | not set (image default)                             |
| `CENTRAL_VERSION`           | —                       | `stable`, a release tag, or `local` for `pnpm prod` |
| `CENTRAL_ORIGIN`            | —                       | `https://central.example.ts.net`                    |

`BACKEND_BASE_URL` is `http://service-backend:8080` in both environments: Cockpit's server-side code reaches the
backend over the compose network, while browser-side fallbacks use `VITE_*` variables.
