# Cockpit

TanStack Start frontend application for the Central dashboard.

Current primary routes:

- `/` for the overview dashboard
- `/finance/accounts` for financial account management
- `/finance/transactions` for income and expense management
- `/jarvis` for the dedicated Jarvis workspace

## Jarvis Route

The `/jarvis` route is a browser-native voice HUD inspired by the linked Tkinter startup demo:

- Standby keeps the reactor rings and HUD alive while the voice system is armed.
- Listening and turn-processing drive a more aggressive animation state.
- Spoken reply playback feeds live output energy back into the center reactor, so the browser animation reacts to the streamed TTS audio.
- Browser VAD is currently disabled in code, so the route does not capture microphone segments or start assistant turns by itself.

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

- Widget loads and refreshes call a TanStack Start server function, so browsers never call backend directly.
- Cockpit reads the backend weather API via `GET /api/v1/weather/current?lat=<latitude>&lon=<longitude>&timezone=<tz>`.
- Configure the backend base URL on the cockpit server with `BACKEND_BASE_URL` (runtime) or `VITE_BACKEND_API_BASE_URL` (build-time fallback).

If neither is set, cockpit uses `http://localhost:3010` as the local orchestrator default. Other runtimes should set `BACKEND_BASE_URL` explicitly instead of relying on endpoint probing.

Weather widget diagnostics are written by cockpit as structured `@central/ts-log` records with scope `cockpit.weather.*`, including invalid location payloads, outbound request attempts, and upstream request failures.

## Finance Transactions Page

The `/finance/transactions` route manages manual income and expense transactions:

- Cockpit calls backend finance APIs through TanStack Start server functions.
- The page supports date-range filtering, transaction creation, category reuse from the loaded range, and income/expense/net summary.
- Edit and delete controls call transaction-specific backend routes through server functions.
- Amounts are entered and displayed as decimal strings while backend persistence uses integer minor units.

## Finance Accounts Page

The `/finance/accounts` route manages financial accounts:

- Cockpit calls account APIs through TanStack Start server functions.
- Users create cash, bank, credit, and loan accounts with an immutable type and primary currency; later edits change the account name.
- Archived accounts stay visible in their own section, while active account lists exclude them for future entry workflows.

## Voice Widget

The voice widget keeps `service-assistant` as the backend boundary, but its primary turn path is now streamed:

- Browser VAD and capture are currently disabled, so no microphone segments are sent.
- The implemented turn client streams assistant turns through `POST /api/v1/assistant/turn/stream` when invoked.
- `service-assistant` performs `STT -> streamed LLM -> chunked TTS`.
- Cockpit can start audio playback as soon as the first synthesized chunk arrives.

`POST /api/v1/assistant/turn` remains available as a non-streaming fallback.

Configure the assistant-service base URL on the cockpit server with `ASSISTANT_SERVICE_BASE_URL` (runtime) or `VITE_ASSISTANT_API_BASE_URL` (browser/build-time fallback).

If neither is set, cockpit uses `http://localhost:3020`, matching the standalone assistant container run target.

When cockpit runs in Docker Compose with assistant services enabled, keep `ASSISTANT_SERVICE_BASE_URL` on the internal service DNS name for server-side calls, but set `VITE_ASSISTANT_API_BASE_URL` to the published host port so browser streaming requests do not try to resolve `service-assistant`. Assistant services are currently not active in the default orchestrator stack while their compose blocks remain commented out.

Voice widget diagnostics are written as structured `@central/ts-log` records with scope `cockpit.voice.*`.

For local debugging in Node-backed assistant turns, cockpit dumps artifacts into `apps/cockpit/tmp/` as input audio, per-chunk output audio files, and a JSON metadata file.

VAD asset synchronization is disabled while browser VAD is offline.

## Container

```bash
pnpm nx run cockpit:container-build
pnpm nx run cockpit:container-run
```
