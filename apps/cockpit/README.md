# Cockpit

TanStack Start frontend application for the Central dashboard.

Current primary routes:

- `/` for the overview dashboard
- `/finance/cash` for income and expense management
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
- Widget refreshes continue through a TanStack Start server function, so browsers never call backend directly.
- Cockpit reads the backend weather API via `GET /api/v1/weather/current?lat=<latitude>&lon=<longitude>&timezone=<tz>`.
- Configure the backend base URL on the cockpit server with `BACKEND_BASE_URL` (runtime) or `VITE_BACKEND_API_BASE_URL` (build-time fallback).

If neither is set, cockpit uses `http://localhost:3010` as the local orchestrator default. Other runtimes should set `BACKEND_BASE_URL` explicitly instead of relying on endpoint probing.

Weather widget diagnostics are written by cockpit as structured `@central/ts-log` records with scope `cockpit.weather.*`, including invalid location payloads, outbound request attempts, and upstream request failures.

## Finance Cash Page

The `/finance/cash` route manages manual income and expense transactions:

- Cockpit calls backend finance APIs through TanStack Start server functions.
- The page supports month filtering, create/edit/delete, category reuse from the loaded month, and monthly income/expense/net summary.
- Amounts are entered and displayed as decimal strings while backend persistence uses integer minor units.

## Voice Widget

The voice widget keeps `service-assistant` as the backend boundary, but its primary turn path is now streamed:

- Browser speech segments are cut locally with browser VAD.
- Browser voice activity detection is temporarily disabled.
- The browser streams turns directly to `service-assistant` via `POST /api/v1/assistant/turn/stream`.
- `service-assistant` then performs `STT -> streamed LLM -> chunked TTS`.
- Cockpit starts audio playback as soon as the first synthesized chunk arrives.

`POST /api/v1/assistant/turn` remains available as a non-streaming fallback.

Configure the assistant-service base URL on the cockpit server with `ASSISTANT_SERVICE_BASE_URL` (runtime) or `VITE_ASSISTANT_API_BASE_URL` (browser/build-time fallback).

If neither is set, cockpit uses `http://localhost:3020` as the local orchestrator default.

When cockpit runs in Docker Compose, keep `ASSISTANT_SERVICE_BASE_URL` on the internal service DNS name for server-side calls, but set `VITE_ASSISTANT_API_BASE_URL` to the published host port so browser streaming requests do not try to resolve `service-assistant`.

Voice widget diagnostics are written as structured `@central/ts-log` records with scope `cockpit.voice.*`.

For local debugging in Node-backed assistant turns, cockpit dumps artifacts into `apps/cockpit/tmp/` as input audio, per-chunk output audio files, and a JSON metadata file.

VAD asset synchronization is disabled while browser VAD is offline.

## Container

```bash
pnpm nx run cockpit:container-build
pnpm nx run cockpit:container-run
```
