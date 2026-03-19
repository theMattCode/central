# Voice Local TTS Service

Local text-to-speech HTTP adapter for `service-voice`.

It exposes the JSON contract expected by `services/voice` in `VOICE_BACKEND_MODE=proxy` and uses `Piper` under the hood.

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
- `VOICE_LOCAL_TTS_EXECUTABLE` (default: `piper`)
- `VOICE_LOCAL_TTS_MODEL` (default: `de_DE-thorsten-medium`)
- `VOICE_LOCAL_TTS_SPEAKER` (optional)
- `VOICE_LOCAL_TTS_DATA_DIR` (optional)
- `VOICE_LOCAL_TTS_DOWNLOAD_DIR` (optional)
- `VOICE_LOCAL_TTS_USE_CUDA` (default: `false`)

`VOICE_LOCAL_TTS_MODEL` can be a Piper short model name or a local `.onnx` model path.
When a short model name is used, the service downloads the voice on the first synthesis request into
`VOICE_LOCAL_TTS_DOWNLOAD_DIR` (or `VOICE_LOCAL_TTS_DATA_DIR` when no download directory is set), so the first request may take longer.

## Nx targets

- `pnpm nx run voice-local-tts:lint`
- `pnpm nx run voice-local-tts:test`
- `pnpm nx run voice-local-tts:typecheck`
- `pnpm nx run voice-local-tts:build`
- `pnpm nx run voice-local-tts:container-run`
