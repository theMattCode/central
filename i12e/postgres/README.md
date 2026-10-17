# i12e-postgres

PostgreSQL 18.3 image with bootstrap initialization (`init/`) and forward-only SQL migrations (`migrations/`).

The image uses PostgreSQL 18 for built-in UUID v7 generation (see [ADR 0001](../../docs/adr/0001-postgres-18-uuid-v7.md)).
Existing PostgreSQL 16 data volumes cannot be reused directly; recreate the local dev volume or dump/restore data.
PostgreSQL 18 containers mount the data volume at `/var/lib/postgresql`.

## Migrations

Migrations are named `<NNNN>_<kebab-case-name>.sql` and applied in order by
[`scripts/apply-migrations.sh`](./scripts/apply-migrations.sh), which records applied files in
`public.schema_migrations`.

Create the next migration file:

```bash
pnpm nx run i12e-postgres:create-migration "create users"
```

Apply migrations to the running dev stack:

```bash
pnpm migrate:dev
```

## Validate

```bash
pnpm nx run i12e-postgres:lint
```

Lint syntax-checks the scripts and rejects migration files that break the naming scheme or reuse a number.
