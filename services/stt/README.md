# STT Service

Speech-to-text HTTP adapter for `service-assistant`.

It exposes the JSON contract expected by `services/assistant` in `ASSISTANT_BACKEND_MODE=proxy` and uses `faster-whisper` under the hood.

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

- `STT_PORT` (default: `8081`)
- `STT_MODEL` (default: `small`)
- `STT_DEVICE` (default: `cpu`)
- `STT_COMPUTE_TYPE` (default: `int8`)
- `STT_BEAM_SIZE` (default: `5`)
- `STT_VAD_FILTER` (default: `true`)

`STT_MODEL` can be a standard `faster-whisper` model name or a local converted model path.

For browser-segmented audio in this repository, better quality usually comes from a larger model such as `medium` or better and disabling the extra `faster-whisper` VAD layer with `STT_VAD_FILTER=false`, because the cockpit VAD already trims speech locally.
The commented orchestrator service definition is built with CUDA runtime dependencies, requests `gpus: all`, and defaults to `STT_DEVICE=cuda` and `STT_COMPUTE_TYPE=float16`. The service is not active in the default orchestrator stack while that compose block remains commented out.

## Nx targets

- `pnpm nx run stt-service:lint`
- `pnpm nx run stt-service:test`
- `pnpm nx run stt-service:typecheck`
- `pnpm nx run stt-service:build`
- `pnpm nx run stt-service:container-run`
