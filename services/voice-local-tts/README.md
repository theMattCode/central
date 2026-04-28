# Voice Local TTS Service

Local text-to-speech HTTP adapter for `service-voice`.

It exposes the JSON contract expected by `services/voice` in `VOICE_BACKEND_MODE=proxy` and uses `Piper` under the hood.
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

- `VOICE_LOCAL_TTS_PORT` (default: `8082`)
- `VOICE_LOCAL_TTS_EXECUTABLE` (default: `piper`, retained for backward compatibility and no longer used on the hot path)
- `VOICE_LOCAL_TTS_MODEL` (default: `de_DE-thorsten-medium`)
- `VOICE_LOCAL_TTS_SPEAKER` (optional)
- `VOICE_LOCAL_TTS_DATA_DIR` (optional)
- `VOICE_LOCAL_TTS_DOWNLOAD_DIR` (optional)
- `VOICE_LOCAL_TTS_SENTENCE_SILENCE` (default: `0`)
- `VOICE_LOCAL_TTS_USE_CUDA` (default: `false`)
- `VOICE_LOCAL_TTS_VOLUME` (default: `1`)
- `VOICE_LOCAL_TTS_NORMALIZE_AUDIO` (default: `true`)

`VOICE_LOCAL_TTS_MODEL` can be a Piper short model name or a local `.onnx` model path.
When a short model name is used, the service downloads the voice on the first synthesis request into
`VOICE_LOCAL_TTS_DOWNLOAD_DIR` (or `VOICE_LOCAL_TTS_DATA_DIR` when no download directory is set), so the first request may take longer.
After that first request, the loaded Piper model stays resident in the service process and is reused for later requests.
If quality matters more than cold-start time, prefer a `high` Piper voice when one is available for the language.
When the GPU orchestrator overlay is used, this service switches to `VOICE_LOCAL_TTS_MODEL=de_DE-thorsten-high` and `VOICE_LOCAL_TTS_USE_CUDA=true`.

`voiceInstruction` is passed through the JSON boundary, but Piper does not follow free-form style instructions the way the OpenAI TTS path does. For local quality tuning, prefer choosing a better voice model and adjusting `VOICE_LOCAL_TTS_SENTENCE_SILENCE`, `VOICE_LOCAL_TTS_VOLUME`, and the streamed chunk size in `service-voice`.

## Nx targets

- `pnpm nx run voice-local-tts:lint`
- `pnpm nx run voice-local-tts:test`
- `pnpm nx run voice-local-tts:typecheck`
- `pnpm nx run voice-local-tts:build`
- `pnpm nx run voice-local-tts:container-run`
