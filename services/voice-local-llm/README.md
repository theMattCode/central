# Voice Local LLM Service

Local OpenAI-compatible chat completion adapter for `service-voice`.

It exposes the `POST /chat/completions` contract expected by `services/voice` and forwards requests to a local Ollama runtime.

The default local model for the orchestrated dev flow is `qwen2.5:3b`, because it keeps local startup and response latency reasonable while still supporting German chat well. Override it with `VOICE_LOCAL_LLM_MODEL` when you want a larger Qwen variant. When the orchestrator is used, `VOICE_LLM_MODEL` is also accepted as the fallback source so the voice service and local Ollama wrapper stay aligned.

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
  "id": "chatcmpl-local-...",
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

- `VOICE_LOCAL_LLM_PORT` (default: `8083`)
- `VOICE_LOCAL_LLM_OLLAMA_URL` (default: `http://service-voice-local-llm-runtime:11434`)
- `VOICE_LOCAL_LLM_REQUEST_TIMEOUT_SECONDS` (default: `120`)
- `VOICE_LOCAL_LLM_DEFAULT_MODEL` (optional)

Models are pulled from Ollama lazily on the first request if they are not already present.

## Nx targets

- `pnpm nx run voice-local-llm:lint`
- `pnpm nx run voice-local-llm:test`
- `pnpm nx run voice-local-llm:typecheck`
- `pnpm nx run voice-local-llm:build`
- `pnpm nx run voice-local-llm:container-run`
