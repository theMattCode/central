# i12e-postgres

Nx project for the persistence-layer PostgreSQL image with bootstrap initialization and forward-only SQL migrations.

## Build

```bash
pnpm nx build i12e-postgres
```

## Run

```bash
pnpm nx run i12e-postgres:run
```

Default host-to-container mapping is `5001:5432`.

Override defaults when needed:

```bash
POSTGRES_PORT=55432 POSTGRES_CONTAINER_NAME=central-i12e-postgres-dev pnpm nx run i12e-postgres:run
```

## Apply migrations

Requires the `i12e-postgres` container to be running.

```bash
pnpm nx run i12e-postgres:migrate
```

## Create a migration file

```bash
MIGRATION_NAME=create_users pnpm nx run i12e-postgres:create-migration
```
