#!/bin/sh
set -eu

usage() {
  cat <<'USAGE' >&2
Usage: sh i12e/orchestrator/scripts/stack.sh <dev|prod> <command> [compose args...]

Environments:
  dev   Hot-reload stack from docker-compose.yml with .env.dev.
  prod  Release image set built from this checkout, run with
        deploy/docker-compose.prod.yml and the ignored .env.prod.

Commands:
  up       Start PostgreSQL, run migrations, start the stack.
           dev: foreground `compose watch`; prod: detached.
  start    dev only: like up, but detached and without file watching.
  migrate  Run migrations against the running PostgreSQL.
  down     Stop the stack (all profiles).
  logs     Follow logs.
  ps       Show service status.
  *        Any other command is passed to `docker compose`.

Set COMPOSE_PROFILES=voice to include the assistant, STT, TTS, and LLM services.
USAGE
}

orchestrator_dir="i12e/orchestrator"
environment="${1:-}"
command="${2:-}"
[ "$#" -ge 2 ] || { usage; exit 2; }
shift 2

case "$environment" in
  dev)
    compose_options="--env-file $orchestrator_dir/.env.dev --file $orchestrator_dir/docker-compose.yml"
    ;;
  prod)
    env_file="$orchestrator_dir/.env.prod"
    if [ ! -f "$env_file" ]; then
      echo "Missing ${env_file}. Create it from ${orchestrator_dir}/deploy/.env.prod.example first." >&2
      exit 2
    fi
    if grep -Eq '^(POSTGRES_PASSWORD=change-me|BACKEND_DATABASE_URL=.*change-me|BACKEND_CORS_ALLOW_ORIGIN=\*)$' "$env_file"; then
      echo "Refusing to start prod with placeholder secrets or wildcard CORS in ${env_file}." >&2
      exit 2
    fi
    # Tag locally built images separately from images pulled from GHCR.
    export CENTRAL_VERSION=local
    compose_options="--env-file $env_file"
    compose_options="$compose_options --file $orchestrator_dir/deploy/docker-compose.prod.yml"
    compose_options="$compose_options --file $orchestrator_dir/docker-compose.prod.local.yml"
    ;;
  *)
    usage
    exit 2
    ;;
esac

compose() {
  # shellcheck disable=SC2086 # compose_options holds only paths without spaces.
  docker compose $compose_options "$@"
}

start_postgres_and_migrate() {
  compose up --detach --build --wait i12e-postgres
  compose run --rm i12e-postgres-migrate
}

case "$command" in
  up)
    start_postgres_and_migrate
    if [ "$environment" = dev ]; then
      compose watch "$@"
    else
      compose up --detach --build --wait service-backend app-cockpit i12e-gateway "$@"
    fi
    ;;
  start)
    if [ "$environment" != dev ]; then
      echo "The start command is only supported for dev; use up for prod." >&2
      exit 2
    fi
    start_postgres_and_migrate
    compose up --detach --build --wait "$@"
    ;;
  migrate)
    compose run --rm --no-deps i12e-postgres-migrate "$@"
    ;;
  down)
    compose --profile '*' down --remove-orphans "$@"
    ;;
  logs)
    compose logs --follow --tail=100 "$@"
    ;;
  ps)
    compose ps "$@"
    ;;
  *)
    compose "$command" "$@"
    ;;
esac
