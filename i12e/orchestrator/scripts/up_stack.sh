#!/bin/sh
set -eu

COMPOSE_FILE="i12e/orchestrator/docker-compose.yml"

usage() {
  cat <<'USAGE' >&2
Usage: sh i12e/orchestrator/scripts/up_stack.sh <dev|prod> [full|llm-proxy-ollama]

Stacks:
  full              Start weather, cockpit, service-assistant, STT, TTS, and LLM services.
  llm-proxy-ollama  Start weather, cockpit, service-assistant, and direct Ollama LLM proxy mode.
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
    ;;
  *)
    usage
    exit 2
    ;;
esac

case "$stack" in
  full)
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

start_postgres_and_migrate() {
  compose up --detach --build i12e-postgres
  compose run --rm --no-deps i12e-postgres-migrate
}

start_ollama_and_pull_model() {
  compose up --detach service-llm-runtime
  compose run --rm --no-deps service-llm-pull
}

start_full_stack() {
  compose up --detach --build \
    service-weather \
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
    docker compose --env-file "$env_file" --file "$COMPOSE_FILE" up --detach --build \
    service-weather \
    service-llm-runtime \
    service-assistant \
    app-cockpit
}

start_postgres_and_migrate
start_ollama_and_pull_model

case "$stack" in
  full)
    start_full_stack
    ;;
  llm-proxy-ollama)
    start_llm_proxy_ollama_stack
    ;;
esac
