# Service Catalog

Source of truth: `i12e/orchestrator/docker-compose.yml`.

## Orchestrated services

| Service                 | Purpose                  | Container port(s)      |
|-------------------------|--------------------------|------------------------|
| `service-weather`       | Weather backend HTTP API | `8080/tcp`             |
| `i12e-postgres`         | PostgreSQL database      | `5432/tcp`             |
| `i12e-postgres-migrate` | One-off migration runner | None (no exposed port) |
| `app-cockpit`           | Cockpit web application  | `3000/tcp`             |

## Host port mappings by environment

Defaults come from:
- `i12e/orchestrator/.env.dev`
- `i12e/orchestrator/.env.prod`

| Service                 | Compose mapping         | Dev/staging default (host -> container) | Prod default (host -> container) |
|-------------------------|-------------------------|-----------------------------------------|----------------------------------|
| `app-cockpit`           | `${COCKPIT_PORT}:3000`  | `3000 -> 3000`                          | `4000 -> 3000`                   |
| `i12e-postgres`         | `${POSTGRES_PORT}:5432` | `3001 -> 5432`                          | `4001 -> 5432`                   |
| `service-weather`       | `${WEATHER_PORT}:8080`  | `3010 -> 8080`                          | `4010 -> 8080`                   |
| `i12e-postgres-migrate` | None                    | None                                    | None                             |

## Related environment differences

| Variable               | Dev                      | Prod                    |
|------------------------|--------------------------|-------------------------|
| `COMPOSE_PROJECT_NAME` | `central-i12e-dev`       | `central-i12e-prod`     |
| `COCKPIT_NODE_ENV`     | `development`            | `production`            |
| `WEATHER_API_BASE_URL` | `http://localhost:3010`  | `http://localhost:4010` |

## Internal service endpoints (compose network)

| Service           | Endpoint                      |
|-------------------|-------------------------------|
| `service-weather` | `http://service-weather:8080` |
| `i12e-postgres`   | `i12e-postgres:5432`          |
| `app-cockpit`     | `http://app-cockpit:3000`     |

## Non-orchestrated local dev ports

| Service    | Mode                                                                   | Host port(s) |
|------------|------------------------------------------------------------------------|--------------|
| `cockpit`  | Vite dev server (`pnpm nx run cockpit:start`)                          | `5000`       |
| `cockpit`  | Container run (`pnpm nx run cockpit:container-run`)                    | `5000`       |
| `postgres` | Standalone container run (`pnpm nx run i12e-postgres:run`)             | `5001`       |
| `weather`  | Standalone container run (`pnpm nx run weather-service:container-run`) | `5010`       |
