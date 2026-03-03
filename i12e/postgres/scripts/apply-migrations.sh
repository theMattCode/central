#!/bin/sh
set -eu

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/opt/central/migrations}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-${POSTGRES_DB:-central}}"
PGUSER="${PGUSER:-${POSTGRES_USER:-central}}"
PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-central}}"
MIGRATION_WAIT_SECONDS="${MIGRATION_WAIT_SECONDS:-60}"

export PGPASSWORD

echo "Waiting for PostgreSQL at ${PGHOST}:${PGPORT}/${PGDATABASE}..."
waited=0
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
  if [ "$waited" -ge "$MIGRATION_WAIT_SECONDS" ]; then
    echo "Timed out after ${MIGRATION_WAIT_SECONDS}s waiting for PostgreSQL at ${PGHOST}:${PGPORT}/${PGDATABASE}." >&2
    exit 1
  fi
  sleep 1
  waited=$((waited + 1))
done

psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

set -- "$MIGRATIONS_DIR"/*.sql
if [ "$1" = "$MIGRATIONS_DIR/*.sql" ]; then
  echo "No migrations found in ${MIGRATIONS_DIR}."
  exit 0
fi

for migration in "$@"; do
  migration_id="$(basename "$migration")"
  is_applied="$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc "SELECT 1 FROM public.schema_migrations WHERE id = '$migration_id';")"

  if [ "$is_applied" = "1" ]; then
    echo "Skipping ${migration_id}; already applied."
    continue
  fi

  echo "Applying ${migration_id}..."
  psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$migration"
  psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "INSERT INTO public.schema_migrations (id) VALUES ('$migration_id');"
done

echo "Migrations complete."
