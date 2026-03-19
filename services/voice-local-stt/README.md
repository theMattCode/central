# Voice Local STT Service

Local speech-to-text HTTP adapter for `service-voice`.

It exposes the JSON contract expected by `services/voice` in `VOICE_BACKEND_MODE=proxy` and uses `faster-whisper` under the hood.

## Endpoint

### `GET /healthz`

Returns service status and effective model configuration.

### `POST /transcribe`

Request body:

```json
{
  "audioBase64": "<base64 wav bytes>",
  "audioMimeType": "audio/wav",
  "language": "de"
}
```

Response body:

```json
{ "text": "..." }
```

## Configuration

- `VOICE_LOCAL_STT_PORT` (default: `8081`)
- `VOICE_LOCAL_STT_MODEL` (default: `small`)
- `VOICE_LOCAL_STT_DEVICE` (default: `cpu`)
- `VOICE_LOCAL_STT_COMPUTE_TYPE` (default: `int8`)
- `VOICE_LOCAL_STT_BEAM_SIZE` (default: `5`)
- `VOICE_LOCAL_STT_VAD_FILTER` (default: `true`)

`VOICE_LOCAL_STT_MODEL` can be a standard `faster-whisper` model name or a local converted model path.

## Nx targets

- `pnpm nx run voice-local-stt:lint`
- `pnpm nx run voice-local-stt:test`
- `pnpm nx run voice-local-stt:typecheck`
- `pnpm nx run voice-local-stt:build`
- `pnpm nx run voice-local-stt:container-run`
