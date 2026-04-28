# TTS Service

Text-to-speech HTTP adapter for `service-assistant`.

It exposes the JSON contract expected by `services/assistant` in `ASSISTANT_BACKEND_MODE=proxy` and uses `Piper` under the hood.
The adapter loads and reuses a `PiperVoice` in-process after the first request instead of launching a fresh `piper` subprocess for every synthesis call.

## Endpoint

### `GET /healthz`

Returns service status and effective model configuration.

### `POST /synthesize`

Request body:

```json
{
  "text": "Hallo Welt",
  "language": "de",
  "voiceInstruction": "Ruhige, warme deutsche Stimme."
}
```

Response body:

```json
{
  "audioBase64": "<base64 wav bytes>",
  "audioMimeType": "audio/wav"
}
```

## Configuration

- `TTS_PORT` (default: `8082`)
- `TTS_EXECUTABLE` (default: `piper`, retained for backward compatibility and no longer used on the hot path)
- `TTS_MODEL` (default: `de_DE-thorsten-medium`)
- `TTS_SPEAKER` (optional)
- `TTS_DATA_DIR` (optional)
- `TTS_DOWNLOAD_DIR` (optional)
- `TTS_SENTENCE_SILENCE` (default: `0`)
- `TTS_USE_CUDA` (default: `false`)
- `TTS_VOLUME` (default: `1`)
- `TTS_NORMALIZE_AUDIO` (default: `true`)

`TTS_MODEL` can be a Piper short model name or a local `.onnx` model path.
When a short model name is used, the service downloads the voice on the first synthesis request into
`TTS_DOWNLOAD_DIR` (or `TTS_DATA_DIR` when no download directory is set), so the first request may take longer.
After that first request, the loaded Piper model stays resident in the service process and is reused for later requests.
If quality matters more than cold-start time, prefer a `high` Piper voice when one is available for the language.
In the orchestrator compose stack, this service is built with GPU runtime dependencies, requests `gpus: all`, and defaults to `TTS_USE_CUDA=true`.

`voiceInstruction` is passed through the JSON boundary, but Piper does not follow free-form style instructions the way the OpenAI TTS path does. For local quality tuning, prefer choosing a better voice model and adjusting `TTS_SENTENCE_SILENCE`, `TTS_VOLUME`, and the streamed chunk size in `service-assistant`.

## Nx targets

- `pnpm nx run tts-service:lint`
- `pnpm nx run tts-service:test`
- `pnpm nx run tts-service:typecheck`
- `pnpm nx run tts-service:build`
- `pnpm nx run tts-service:container-run`
