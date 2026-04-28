# LLM Service

OpenAI-compatible chat completion adapter for `service-assistant`.

It exposes the `POST /chat/completions` contract expected by `services/assistant` and forwards requests to an Ollama runtime.

The default model for the orchestrated dev flow is `qwen2.5:3b`, because it keeps startup and response latency reasonable while still supporting German chat well. Override it with `LLM_MODEL` when you want a larger Qwen variant.

## Endpoints

### `GET /healthz`

Returns wrapper status and effective upstream configuration.

### `POST /chat/completions`

Request body:

```json
{
  "model": "qwen2.5:3b",
  "messages": [
    { "role": "system", "content": "Antworte knapp." },
    { "role": "user", "content": "Hallo" }
  ],
  "temperature": 1.0
}
```

Response body:

```json
{
  "id": "chatcmpl-central-...",
  "object": "chat.completion",
  "created": 0,
  "model": "qwen2.5:3b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hallo!"
      },
      "finish_reason": "stop"
    }
  ]
}
```

## Configuration

- `LLM_PORT` (default: `8083`)
- `LLM_OLLAMA_URL` (default: `http://service-llm-runtime:11434`)
- `LLM_REQUEST_TIMEOUT_SECONDS` (default: `120`)
- `LLM_DEFAULT_MODEL` (optional)

Models are pulled from Ollama lazily on the first request if they are not already present.

## Nx targets

- `pnpm nx run llm-service:lint`
- `pnpm nx run llm-service:test`
- `pnpm nx run llm-service:typecheck`
- `pnpm nx run llm-service:build`
- `pnpm nx run llm-service:container-run`
