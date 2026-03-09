# i12e-orchestrator

Nx project for orchestrating local infrastructure and app containers.

## Start all services (dev)

```bash
pnpm nx run i12e-orchestrator:up-dev
```

## Start all services (prod)

```bash
pnpm nx run i12e-orchestrator:up-prod
```

This brings up:

- Cockpit app (`cockpit` service)
- PostgreSQL (`postgres` service)
- Migration runner (`postgres-migrate`) as a one-off container (`--rm`)
- Weather backend (`weather` service)

Environment defaults are stored in:

- `i12e/orchestrator/.env.dev`
- `i12e/orchestrator/.env.prod`

Service and port mapping details (including dev/prod differences) are documented in [`docs/service-catalog.md`](../../docs/service-catalog.md).

The compose project names keep dev/prod container names isolated.

## Stop all services

```bash
pnpm nx run i12e-orchestrator:down-dev
pnpm nx run i12e-orchestrator:down-prod
```

## Re-run migrations

Requires `postgres` to already be running.

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
