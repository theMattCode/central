# Assistant Service

Rust backend service that owns the assistant-turn orchestration boundary for Central.

The intended request path is:

1. Browser VAD cuts a speech segment locally.
2. Cockpit posts the segment to `service-assistant`.
3. `service-assistant` performs `STT -> streamed LLM -> chunked TTS`.
4. Cockpit receives transcript, response deltas, and audio chunks, then starts playback before the full turn finishes.

## Why this shape fits `central`

- Browser clients never call model-serving infrastructure directly.
- Cockpit stays responsible for app/session/auth boundaries.
- Model-serving details stay behind a Rust/Axum service, matching the existing `services/weather` pattern.
- The standalone service can still run in `mock` mode for quick wiring tests, while the orchestrated stack defaults to STT, TTS, and LLM services.

## Architecture

The service is intentionally smaller than `service-weather`:

- `src/http/*`: HTTP transport layer.
- `src/domain/*`: turn models, ports, and `AssistantTurnService`.
- `src/infrastructure/*`: mock and HTTP upstream adapters.
- `src/config.rs`: runtime configuration from environment variables.
- `src/context.rs`: dependency wiring for request handlers.
- `src/error.rs`: shared application errors + HTTP mapping.
- `src/main.rs`: process bootstrap.

## Endpoint

### `GET /healthz`

Returns service status and backend mode.

### `POST /api/v1/assistant/turn`

Request body:

```json
{
  "audioBase64": "<base64 wav bytes>",
  "audioMimeType": "audio/wav",
  "language": "de",
  "voiceInstruction": "Ruhige, warme deutsche Stimme."
}
```

### `POST /api/v1/assistant/turn/stream`

Returns an SSE stream for the same request body. Event sequence:

- `transcript`
- `response_delta`
- `audio_chunk`
- `done`

Example `audio_chunk` event payload:

```json
{
  "chunkIndex": 0,
  "text": "Morgen wird es in Berlin leicht regnerisch.",
  "audioBase64": "<base64 wav bytes>",
  "audioMimeType": "audio/wav"
}
```

This endpoint is the preferred path for browser playback because it overlaps LLM generation and TTS synthesis instead of waiting for the full response text first.

Response body:

```json
{
  "transcript": "Wie ist das Wetter morgen?",
  "responseText": "Morgen wird es in Berlin voraussichtlich kuehl und leicht regnerisch.",
  "audioBase64": "<base64 wav bytes>",
  "audioMimeType": "audio/wav"
}
```

## Backend modes

### `ASSISTANT_BACKEND_MODE=mock`

- Returns deterministic transcript and response text.
- Generates a short silent WAV payload.
- Best for isolated service tests that should not start model-serving infrastructure.

### `ASSISTANT_BACKEND_MODE=llm-proxy`

- Uses the configured LLM upstream.
- Keeps the mock STT transcript and mock silent WAV response.
- Best for validating a real chat model before provisioning STT and TTS runtimes.

Required upstream boundaries:

- `LLM_BASE_URL`
- `LLM_MODEL`

`LLM_BASE_URL` may be either:

- An OpenAI-compatible base URL such as `https://api.openai.com/v1` or `http://localhost:11434/v1`
- A service root that exposes `POST /chat/completions`, such as `http://service-llm:8083`
- The full chat completions endpoint itself

### `ASSISTANT_BACKEND_MODE=openai`

- Uses OpenAI-native speech-to-text and text-to-speech endpoints.
- Reuses the OpenAI-compatible chat completion wiring for the LLM boundary.
- Best when one OpenAI account should cover the complete `STT -> LLM -> TTS` path.

Required configuration:

- `LLM_BASE_URL` (typically `https://api.openai.com/v1`)
- `LLM_API_KEY`
- `LLM_MODEL`
- `STT_MODEL`
- `TTS_MODEL`

Optional configuration:

- `TTS_VOICE` (defaults to `alloy`)

### `ASSISTANT_BACKEND_MODE=proxy`

Uses three upstream boundaries:

- `STT_URL`
- `LLM_BASE_URL`
- `TTS_URL`

`LLM_BASE_URL` may be either an OpenAI-compatible base URL such as `http://service-llm-runtime:11434/v1`, a service root that exposes `POST /chat/completions`, or the full chat completions endpoint itself.

`STT_URL` is expected to accept:

```json
{
  "audioBase64": "...",
  "audioMimeType": "audio/wav",
  "language": "de"
}
```

and return:

```json
{ "text": "..." }
```

`TTS_URL` is expected to accept:

```json
{
  "text": "...",
  "language": "de",
  "voiceInstruction": "..."
}
```

and return:

```json
{
  "audioBase64": "...",
  "audioMimeType": "audio/wav"
}
```

This keeps `central` aligned with its Rust/TypeScript stack while still allowing best-of-breed external model runtimes such as Faster-Whisper, Piper, Ollama, and Qwen models.

For an Ollama-only path in this repository, keep `ASSISTANT_BACKEND_MODE=llm-proxy` and point:

- `LLM_BASE_URL` to `http://service-llm-runtime:11434/v1`
- `LLM_MODEL` to your Ollama model name

For an STT/TTS setup in this repository, use the `stt-service` and `tts-service` services, then point:

- `STT_URL` to `http://service-stt:8081/transcribe`
- `TTS_URL` to `http://service-tts:8082/synthesize`

For an STT/TTS/LLM setup in this repository, either point directly at the Ollama runtime:

- `STT_URL` to `http://service-stt:8081/transcribe`
- `TTS_URL` to `http://service-tts:8082/synthesize`
- `LLM_BASE_URL` to `http://service-llm-runtime:11434/v1`
- `LLM_MODEL` to your Ollama model name

Or keep the `llm-service` wrapper when you want lazy model pulls and a repo-owned adapter boundary:

- `STT_URL` to `http://service-stt:8081/transcribe`
- `TTS_URL` to `http://service-tts:8082/synthesize`
- `LLM_BASE_URL` to `http://service-llm:8083`
- `LLM_MODEL` to your Ollama model name, for example `qwen2.5:3b`

## Configuration

- `ASSISTANT_PORT` (default: `5020`)
- `ASSISTANT_BACKEND_MODE` (`mock`, `llm-proxy`, `openai`, or `proxy`, standalone default: `mock`; orchestrator default: `proxy`)
- `ASSISTANT_REQUEST_TIMEOUT_SECONDS` (default: `30`)
- `TTS_STREAM_SOFT_LIMIT_CHARS` (default: `220`, larger values improve local TTS prosody but delay the first streamed audio chunk)
- `ASSISTANT_CORS_ALLOW_ORIGIN` (default: `*`)
- `ASSISTANT_DEFAULT_LANGUAGE` (default: `de`)
- `ASSISTANT_DEFAULT_VOICE_INSTRUCTION` (default: calm German voice instruction)
- `ASSISTANT_NAME` (default: `Jarvis`, only used when `LLM_SYSTEM_PROMPT` is unset)
- `LLM_BASE_URL` (required in `llm-proxy`, `openai`, and `proxy` modes; for example `https://api.openai.com/v1`, `http://localhost:11434/v1`, or `http://service-llm:8083`)
- `LLM_API_KEY` (required in `openai` mode, optional otherwise)
- `LLM_MODEL` (required in `llm-proxy`, `openai`, and `proxy` modes)
- `LLM_SYSTEM_PROMPT` (default: concise German assistant prompt)
- `STT_MODEL` (required in `openai` mode)
- `STT_URL` (required in `proxy` mode)
- `TTS_MODEL` (required in `openai` mode)
- `TTS_URL` (required in `proxy` mode)
- `TTS_VOICE` (default: `alloy`)

## Logging

The service uses structured logs via `tracing`.

- Startup logs include backend mode and upstream configuration presence.
- Turn logs include transcript length and response length.
- Upstream failures are surfaced as structured error responses.

## Nx targets

- `pnpm nx run assistant-service:lint`
- `pnpm nx run assistant-service:test`
- `pnpm nx run assistant-service:typecheck`
- `pnpm nx run assistant-service:build`
- `pnpm nx run assistant-service:container-build`
- `pnpm nx run assistant-service:container-run`
