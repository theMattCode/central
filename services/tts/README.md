# TTS Service

Text-to-speech HTTP adapter for `service-assistant`.

It exposes the JSON contract expected by `services/assistant` in `ASSISTANT_BACKEND_MODE=proxy` and uses Qwen3-TTS voice cloning under the hood.
The adapter loads the Qwen model and creates one reusable voice-clone prompt from `res/morgan-freeman.mp3` during service startup, then reuses that prompt for every synthesis request.

The Qwen walkthrough hosts the voice-clone instructions on the CustomVoice model card, but cloning from a reference audio clip uses the Base model. This service therefore defaults to `Qwen/Qwen3-TTS-12Hz-1.7B-Base`.

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
- `TTS_MODEL` (default: `Qwen/Qwen3-TTS-12Hz-1.7B-Base`)
- `TTS_REFERENCE_AUDIO` (default: `res/morgan-freeman.mp3`)
- `TTS_REFERENCE_TEXT_FILE` (default: `res/morgan-freeman.txt` for the bundled Morgan sample)
- `TTS_REFERENCE_TEXT` (optional; overrides `TTS_REFERENCE_TEXT_FILE` when set)
- `TTS_X_VECTOR_ONLY_MODE` (default: `false` for the bundled Morgan sample)
- `TTS_DEVICE_MAP` (default: `cuda:0`)
- `TTS_DTYPE` (default: `bfloat16`)
- `TTS_ATTENTION_IMPLEMENTATION` (default: `flash_attention_2`)
- `HF_HOME` (compose sets this under `/models/huggingface`)

Qwen's best clone quality uses both reference audio and an accurate transcript from `TTS_REFERENCE_TEXT` or `TTS_REFERENCE_TEXT_FILE`.
The service defaults to the bundled transcript in `res/morgan-freeman.txt`, so the orchestrator uses the full voice-clone prompt by default. Set `TTS_X_VECTOR_ONLY_MODE=true` when using a custom sample without a transcript.

The Docker image installs PyTorch and Torchaudio for CUDA 12.8, then installs the matching prebuilt FlashAttention 2 wheel for Python 3.12 / Torch 2.8 / Linux x86_64. The image does not compile `flash-attn` from source during normal builds. When `TTS_ATTENTION_IMPLEMENTATION=flash_attention_2`, startup fails if the `flash_attn` package is unavailable so the service does not silently run without the required attention backend.

`voiceInstruction` is kept in the HTTP contract, but the Qwen Base voice-clone path does not provide the free-form style control exposed by Qwen CustomVoice or OpenAI TTS. The service logs and ignores it while preserving the cloned Morgan voice across requests.

In the orchestrator compose stack and standalone `tts-service:container-run` target, this service requests `gpus: all`, loads Qwen onto `cuda:0`, uses the bundled `res/morgan-freeman.mp3` sample, and caches downloaded Hugging Face model files in the `central_tts_models` Docker volume.

## Nx targets

- `pnpm nx run tts-service:lint`
- `pnpm nx run tts-service:test`
- `pnpm nx run tts-service:typecheck`
- `pnpm nx run tts-service:build`
- `pnpm nx run tts-service:container-run`
