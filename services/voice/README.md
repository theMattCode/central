# Voice Service

Rust backend service that owns the voice-turn orchestration boundary for Central.

The intended request path is:

1. Browser VAD cuts a speech segment locally.
2. Cockpit posts the segment to `service-voice`.
3. `service-voice` performs `STT -> streamed LLM -> chunked TTS`.
4. Cockpit receives transcript, response deltas, and audio chunks, then starts playback before the full turn finishes.

## Why this shape fits `central`

- Browser clients never call model-serving infrastructure directly.
- Cockpit stays responsible for app/session/auth boundaries.
- Model-serving details stay behind a Rust/Axum service, matching the existing `services/weather` pattern.
- The standalone service can still run in `mock` mode for quick wiring tests, while the orchestrated stack defaults to local STT, TTS, and LLM services.

## Architecture

The service is intentionally smaller than `service-weather`:

- `src/http/*`: HTTP transport layer.
- `src/domain/*`: turn models, ports, and `VoiceTurnService`.
- `src/infrastructure/*`: mock and HTTP upstream adapters.
- `src/config.rs`: runtime configuration from environment variables.
- `src/context.rs`: dependency wiring for request handlers.
- `src/error.rs`: shared application errors + HTTP mapping.
- `src/main.rs`: process bootstrap.

## Endpoint

### `GET /healthz`

Returns service status and backend mode.

### `POST /api/v1/voice/turn`

Request body:

```json
{
  "audioBase64": "<base64 wav bytes>",
  "audioMimeType": "audio/wav",
  "language": "de",
  "voiceInstruction": "Ruhige, warme deutsche Stimme."
}
```

### `POST /api/v1/voice/turn/stream`

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

### `VOICE_BACKEND_MODE=mock`

- Returns deterministic transcript and response text.
- Generates a short silent WAV payload.
- Best for isolated service tests that should not start model-serving infrastructure.

### `VOICE_BACKEND_MODE=llm-proxy`

- Uses the configured LLM upstream.
- Keeps the mock STT transcript and mock silent WAV response.
- Best for validating a real chat model before provisioning STT and TTS runtimes.

Required upstream boundaries:

- `VOICE_LLM_BASE_URL`
- `VOICE_LLM_MODEL`

`VOICE_LLM_BASE_URL` may be either:

- An OpenAI-compatible base URL such as `https://api.openai.com/v1` or `http://localhost:11434/v1`
- A service root that exposes `POST /chat/completions`, such as `http://service-voice-local-llm:8083`
- The full chat completions endpoint itself

### `VOICE_BACKEND_MODE=openai`

- Uses OpenAI-native speech-to-text and text-to-speech endpoints.
- Reuses the OpenAI-compatible chat completion wiring for the LLM boundary.
- Best when one OpenAI account should cover the complete `STT -> LLM -> TTS` path.

Required configuration:

- `VOICE_LLM_BASE_URL` (typically `https://api.openai.com/v1`)
- `VOICE_LLM_API_KEY`
- `VOICE_LLM_MODEL`
- `VOICE_STT_MODEL`
- `VOICE_TTS_MODEL`

Optional configuration:

- `VOICE_TTS_VOICE` (defaults to `alloy`)

### `VOICE_BACKEND_MODE=proxy`

Uses three upstream boundaries:

- `VOICE_STT_URL`
- `VOICE_LLM_BASE_URL`
- `VOICE_TTS_URL`

`VOICE_LLM_BASE_URL` may be either an OpenAI-compatible base URL such as `http://service-voice-local-llm-runtime:11434/v1`, a service root that exposes `POST /chat/completions`, or the full chat completions endpoint itself.

`VOICE_STT_URL` is expected to accept:

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

`VOICE_TTS_URL` is expected to accept:

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

For a local LLM-only path in this repository, keep `VOICE_BACKEND_MODE=llm-proxy` and point:

- `VOICE_LLM_BASE_URL` to `http://service-voice-local-llm-runtime:11434/v1`
- `VOICE_LLM_MODEL` to your local Ollama model name

For a fully local STT/TTS setup in this repository, use the `voice-local-stt` and `voice-local-tts` services, then point:

- `VOICE_STT_URL` to `http://service-voice-local-stt:8081/transcribe`
- `VOICE_TTS_URL` to `http://service-voice-local-tts:8082/synthesize`

For a fully local STT/TTS/LLM setup in this repository, either point directly at the Ollama runtime:

- `VOICE_STT_URL` to `http://service-voice-local-stt:8081/transcribe`
- `VOICE_TTS_URL` to `http://service-voice-local-tts:8082/synthesize`
- `VOICE_LLM_BASE_URL` to `http://service-voice-local-llm-runtime:11434/v1`
- `VOICE_LLM_MODEL` to your local Ollama model name

Or keep the `voice-local-llm` wrapper when you want lazy model pulls and a repo-owned adapter boundary:

- `VOICE_STT_URL` to `http://service-voice-local-stt:8081/transcribe`
- `VOICE_TTS_URL` to `http://service-voice-local-tts:8082/synthesize`
- `VOICE_LLM_BASE_URL` to `http://service-voice-local-llm:8083`
- `VOICE_LLM_MODEL` to your local Ollama model name, for example `qwen2.5:3b`

## Configuration

- `VOICE_PORT` (default: `5020`)
- `VOICE_BACKEND_MODE` (`mock`, `llm-proxy`, `openai`, or `proxy`, standalone default: `mock`; orchestrator default: `proxy`)
- `VOICE_REQUEST_TIMEOUT_SECONDS` (default: `30`)
- `VOICE_TTS_STREAM_SOFT_LIMIT_CHARS` (default: `220`, larger values improve local TTS prosody but delay the first streamed audio chunk)
- `VOICE_CORS_ALLOW_ORIGIN` (default: `*`)
- `VOICE_DEFAULT_LANGUAGE` (default: `de`)
- `VOICE_DEFAULT_VOICE_INSTRUCTION` (default: calm German voice instruction)
- `VOICE_ASSISTANT_NAME` (default: `Jarvis`, only used when `VOICE_LLM_SYSTEM_PROMPT` is unset)
- `VOICE_LLM_BASE_URL` (required in `llm-proxy`, `openai`, and `proxy` modes; for example `https://api.openai.com/v1`, `http://localhost:11434/v1`, or `http://service-voice-local-llm:8083`)
- `VOICE_LLM_API_KEY` (required in `openai` mode, optional otherwise)
- `VOICE_LLM_MODEL` (required in `llm-proxy`, `openai`, and `proxy` modes)
- `VOICE_LLM_SYSTEM_PROMPT` (default: concise German assistant prompt)
- `VOICE_STT_MODEL` (required in `openai` mode)
- `VOICE_STT_URL` (required in `proxy` mode)
- `VOICE_TTS_MODEL` (required in `openai` mode)
- `VOICE_TTS_URL` (required in `proxy` mode)
- `VOICE_TTS_VOICE` (default: `alloy`)

## Logging

The service uses structured logs via `tracing`.

- Startup logs include backend mode and upstream configuration presence.
- Turn logs include transcript length and response length.
- Upstream failures are surfaced as structured error responses.

## Nx targets

- `pnpm nx run voice-service:lint`
- `pnpm nx run voice-service:test`
- `pnpm nx run voice-service:typecheck`
- `pnpm nx run voice-service:build`
- `pnpm nx run voice-service:container-build`
- `pnpm nx run voice-service:container-run`
