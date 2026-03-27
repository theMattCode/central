# Cockpit

TanStack Start frontend application for the Central dashboard.

Current primary routes:

- `/` for the overview dashboard
- `/jarvis` for the dedicated Jarvis workspace

## Jarvis Route

The `/jarvis` route is a browser-native voice HUD inspired by the linked Tkinter startup demo:

- Standby keeps the reactor rings and HUD alive while the voice system is armed.
- Listening and turn-processing drive a more aggressive animation state.
- Spoken reply playback feeds live output energy back into the center reactor, so the browser animation reacts to the streamed TTS audio.

## Run

From repository root:

```bash
pnpm nx run cockpit:start
```

Directly from `apps/cockpit`:

```bash
pnpm run start:dev
```

## Validate

From repository root:

```bash
pnpm nx run cockpit:lint
pnpm nx run cockpit:test
pnpm nx run cockpit:typecheck
pnpm nx run cockpit:build
```

## Weather Widget

The weather widget module owns its loading contract:

- The route loader calls weather-module helpers for the initial widget data on the cockpit server.
- Widget refreshes continue through a TanStack Start server function, so browsers never call weather-service directly.
- Cockpit reads weather-service via `GET /api/v1/weather/current?lat=<latitude>&lon=<longitude>&timezone=<tz>`.
- Configure the weather-service base URL on the cockpit server with `WEATHER_SERVICE_BASE_URL` (runtime) or `VITE_WEATHER_API_BASE_URL` (build-time fallback).

If neither is set, cockpit uses `http://localhost:3010` as the local orchestrator default. Other runtimes should set `WEATHER_SERVICE_BASE_URL` explicitly instead of relying on endpoint probing.

Weather widget diagnostics are written by cockpit as structured `@central/ts-log` records with scope `cockpit.weather.*`, including invalid location payloads, outbound request attempts, and upstream request failures.

## Voice Widget

The voice widget keeps `service-voice` as the backend boundary, but its primary turn path is now streamed:

- Browser speech segments are cut locally with browser VAD.
- Browser VAD model/worklet assets are self-hosted from cockpit under `public/vendor/` instead of loading from a CDN.
- The ONNX runtime module and WASM binary are self-hosted as Vite-managed app assets, so dev/build keep working without CDN requests.
- The browser streams turns directly to `service-voice` via `POST /api/v1/voice/turn/stream`.
- `service-voice` then performs `STT -> streamed LLM -> chunked TTS`.
- Cockpit starts audio playback as soon as the first synthesized chunk arrives.

`POST /api/v1/voice/turn` remains available as a non-streaming fallback.

Configure the voice-service base URL on the cockpit server with `VOICE_SERVICE_BASE_URL` (runtime) or `VITE_VOICE_API_BASE_URL` (browser/build-time fallback).

If neither is set, cockpit uses `http://localhost:3020` as the local orchestrator default.

When cockpit runs in Docker Compose, keep `VOICE_SERVICE_BASE_URL` on the internal service DNS name for server-side calls, but set `VITE_VOICE_API_BASE_URL` to the published host port so browser streaming requests do not try to resolve `service-voice`.

Voice widget diagnostics are written as structured `@central/ts-log` records with scope `cockpit.voice.*`.

For local debugging in Node-backed voice turns, cockpit dumps artifacts into `apps/cockpit/tmp/` as input audio, per-chunk output audio files, and a JSON metadata file.

Self-hosted voice assets are synchronized from the installed `@ricky0123/vad-web` and `onnxruntime-web` packages by:

```bash
pnpm --dir apps/cockpit run sync:voice-vad-assets
```

The workspace `postinstall` runs that sync automatically after `pnpm install` or dependency updates from the repository root.

`build`, `start:dev`, `start:preview`, `test`, and `typecheck` also run the sync automatically before execution, so the matching runtime assets are always refreshed without manual copying.

## Container

```bash
pnpm nx run cockpit:container-build
pnpm nx run cockpit:container-run
```
