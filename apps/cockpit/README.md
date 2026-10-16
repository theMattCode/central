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
pnpm nx run app-cockpit:start
```

Directly from `apps/cockpit`:

```bash
pnpm run start:dev
```

The standalone Vite server runs on port `5000` and expects the backend of the dev stack on `http://localhost:3010`.
The full dev stack (`pnpm dev`) serves Cockpit with HMR on port `3000`.

## Validate

From repository root:

```bash
pnpm nx run app-cockpit:format-check
pnpm nx run app-cockpit:typecheck
pnpm nx run app-cockpit:test
pnpm nx run app-cockpit:build
```

## Weather Widget

The weather widget module owns its loading contract:

- The route loader calls weather-module helpers for the initial widget data on the cockpit server.
- Widget refreshes continue through a TanStack Start server function, so browsers never call backend directly.
- Cockpit reads the backend weather API via `GET /api/v1/weather/current?lat=<latitude>&lon=<longitude>&timezone=<tz>`.
- Configure the backend base URL on the cockpit server with `BACKEND_BASE_URL` (runtime) or `VITE_BACKEND_API_BASE_URL` (build-time fallback).

If neither is set, cockpit uses `http://localhost:3010` as the local orchestrator default. Other runtimes should set `BACKEND_BASE_URL` explicitly instead of relying on endpoint probing.

Weather widget diagnostics are written by cockpit as structured logger records (`src/utils/logger`) with scope `cockpit.weather.*`, including invalid location payloads, outbound request attempts, and upstream request failures.

## Finance Transactions Page

The `/finance/transactions` route manages manual income and expense transactions (see
[finance domain](../../docs/domains/finance.md)):

- Cockpit calls backend finance APIs through TanStack Start server functions.
- The page supports date-range filtering, listing and creating transactions, and an income/expense/net summary. Edit
  and delete controls still need route-id wiring in the server function helpers.
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

Voice widget diagnostics are written as structured logger records (`src/utils/logger`) with scope `cockpit.voice.*`.

For local debugging in Node-backed assistant turns, cockpit dumps artifacts into `apps/cockpit/tmp/` as input audio, per-chunk output audio files, and a JSON metadata file.

VAD asset synchronization is disabled while browser VAD is offline.
