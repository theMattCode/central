#!/bin/sh
set -eu

COMPOSE_FILE="i12e/orchestrator/docker-compose.yml"
DEV_COMPOSE_FILE="i12e/orchestrator/docker-compose.dev.yml"

usage() {
  cat <<'USAGE' >&2
Usage: sh i12e/orchestrator/scripts/up_stack.sh <dev|prod> [full|hot|llm-proxy-ollama]

Stacks:
  full              Start backend, cockpit, service-assistant, STT, TTS, and LLM services.
  hot               Start the dev stack with code watching and hot reload where supported.
  llm-proxy-ollama  Start backend, cockpit, service-assistant, and direct Ollama LLM proxy mode.
USAGE
}

environment="${1:-}"
stack="${2:-full}"

case "$environment" in
  dev)
    env_file="i12e/orchestrator/.env.dev"
    ;;
  prod)
    env_file="i12e/orchestrator/.env.prod"
    if [ ! -f "$env_file" ]; then
      echo "Missing ${env_file}. Create it from i12e/orchestrator/.env.prod.example and set production secrets before starting prod." >&2
      exit 2
    fi
    if grep -Eq '^(POSTGRES_PASSWORD=change-me|BACKEND_DATABASE_URL=.*change-me|BACKEND_CORS_ALLOW_ORIGIN=\*|ASSISTANT_CORS_ALLOW_ORIGIN=\*)$' "$env_file"; then
      echo "Refusing to start prod with placeholder secrets or wildcard CORS in ${env_file}." >&2
      exit 2
    fi
    ;;
  *)
    usage
    exit 2
    ;;
esac

case "$stack" in
  full)
    ;;
  hot)
    if [ "$environment" != "dev" ]; then
      echo "The hot stack is only supported for the dev environment." >&2
      exit 2
    fi
    ;;
  llm-proxy-ollama)
    if [ "$environment" != "dev" ]; then
      echo "The llm-proxy-ollama stack is only supported for the dev environment." >&2
      exit 2
    fi
    ;;
  *)
    usage
    exit 2
    ;;
esac

compose() {
  docker compose --env-file "$env_file" --file "$COMPOSE_FILE" "$@"
}

compose_hot() {
  docker compose --env-file "$env_file" --file "$COMPOSE_FILE" --file "$DEV_COMPOSE_FILE" "$@"
}

start_postgres_and_migrate() {
  compose up --detach --build --wait i12e-postgres
  compose run --rm i12e-postgres-migrate
}

start_ollama_and_pull_model() {
  compose up --detach --wait service-llm-runtime
  compose run --rm service-llm-pull
}

start_full_stack() {
  compose up --detach --build --wait \
    service-backend \
    service-stt \
    service-tts \
    service-llm-runtime \
    service-llm \
    service-assistant \
    app-cockpit
}

start_llm_proxy_ollama_stack() {
  ASSISTANT_BACKEND_MODE=llm-proxy \
    LLM_BASE_URL=http://service-llm-runtime:11434/v1 \
    docker compose --env-file "$env_file" --file "$COMPOSE_FILE" up --detach --build --wait \
    service-backend \
    service-llm-runtime \
    service-assistant \
    app-cockpit
}

start_hot_stack() {
  compose_hot watch \
    service-backend \
    service-stt \
    service-tts \
    service-llm \
    service-assistant \
    app-cockpit
}

start_postgres_and_migrate
start_ollama_and_pull_model

case "$stack" in
  full)
    start_full_stack
    ;;
  hot)
    start_hot_stack
    ;;
  llm-proxy-ollama)
    start_llm_proxy_ollama_stack
    ;;
esac
