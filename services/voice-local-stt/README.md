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

For browser-segmented audio in this repository, better quality usually comes from a larger model such as `medium` or better and disabling the extra `faster-whisper` VAD layer with `VOICE_LOCAL_STT_VAD_FILTER=false`, because the cockpit VAD already trims speech locally.
In the orchestrator compose stack, this service is built with CUDA runtime dependencies, requests `gpus: all`, and defaults to `VOICE_LOCAL_STT_DEVICE=cuda` and `VOICE_LOCAL_STT_COMPUTE_TYPE=float16`.

## Nx targets

- `pnpm nx run voice-local-stt:lint`
- `pnpm nx run voice-local-stt:test`
- `pnpm nx run voice-local-stt:typecheck`
- `pnpm nx run voice-local-stt:build`
- `pnpm nx run voice-local-stt:container-run`
