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

## Error monitoring

Cockpit, Backend, and Assistant report errors and traces to Sentry (organization `elyverse-studio`, EU region), one
project each: `central-cockpit`, `central-backend`, `central-assistant`. Each service reads its DSN from
`SENTRY_DSN`; an empty DSN disables reporting. In the Rust services, `error`-level `tracing` events and every API response with a 5xx status become Sentry issues; `warn` and `info` become breadcrumbs. The orchestrator maps per-service variables onto it:

| Variable               | Service             | Notes                                                              |
| ---------------------- | ------------------- | ------------------------------------------------------------------ |
| `COCKPIT_SENTRY_DSN`   | `app-cockpit`       | Also the browser DSN (`VITE_SENTRY_DSN`), baked in at image build  |
| `BACKEND_SENTRY_DSN`   | `service-backend`   |                                                                    |
| `ASSISTANT_SENTRY_DSN` | `service-assistant` | Dev stack only                                                     |
| `SENTRY_ENVIRONMENT`   | all                 | Default `production`; baked into the browser bundle at image build |

`SENTRY_ENVIRONMENT` is `development` in the dev stack. The browser SDK cannot read it at runtime, so the cockpit image
bakes it in as `VITE_SENTRY_ENVIRONMENT`: `pnpm prod` uses the value from `.env.prod`, CI images use `production`.

The repository is public, so DSNs are not committed: export them in your shell for `pnpm dev`, set them in
`.env.prod`, and set the `COCKPIT_SENTRY_DSN` GitHub Actions variable for CI image builds. Cockpit uploads source
maps to Sentry during `vite build` when `SENTRY_AUTH_TOKEN` is set; image builds receive it as the BuildKit secret
`sentry_auth_token`, which CI fills from the `SENTRY_AUTH_TOKEN` repository secret. Every image built in CI is tagged
with the Sentry release `central@<commit SHA>`. On pushes to `main` and release tags, the `sentry-release` CI job
creates that release for all three projects with its commits (read from the checkout, so no Sentry GitHub integration
is needed), and `central-update` records each production deploy on it.
