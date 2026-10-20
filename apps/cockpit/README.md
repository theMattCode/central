# Cockpit

SolidJS 2 frontend application for the Central dashboard, with TanStack Solid Start 2 providing file-based routing,
SSR, and server functions. Both framework integrations are pinned to release-candidate versions intentionally while
their SolidJS 2 support stabilizes.

Cockpit code follows SolidJS 2 semantics: JSX props stay reactive, stores use draft-first updates, async data flows
through derived stores and `Loading`/`Errored` boundaries, mutations use actions with optimistic state, effects
separate tracked computation from imperative work, and component lifecycle cleanup uses `onSettled`.

Current primary routes:

- `/` for the overview dashboard
- `/finance/transactions` for income and expense management
- `/finance/accounts` for financial account management
- `/jarvis` for the dedicated Jarvis workspace

## Jarvis Route

The `/jarvis` route is a browser-native voice HUD inspired by the linked Tkinter startup demo:

- Standby keeps the reactor rings and HUD alive while the voice system is armed.
- Listening and turn-processing drive a more aggressive animation state.
- Spoken reply playback feeds live output energy back into the center reactor, so the browser animation reacts to the streamed TTS audio.

## Styling

The cockpit uses a moulded glass look defined in `src/styles.css`:

- `--glass-*` tokens hold the translucent fills, rim lights and shadows for light and dark mode.
- `glass-panel` (sections, drawers) and `glass-control` (buttons, form fields) live in the `components` layer, so
  utilities on the same element (border width/colour, tints) still override them.
- `glass-tray` is the recessed, unblurred content area that the panels float on.
- `glass-item` (navigation items) stays transparent and turns into a `glass-control` on hover or when its link is
  the current page (`aria-current="page"`).

The Jarvis HUD has no frame of its own: its grid fades out into the page, and its panels and controls use the same
glass components and theme colours as the rest of the cockpit.

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

Errors and traces go to the Sentry project `central-cockpit`. Sentry has no SDK for TanStack Solid Start, so cockpit
wires the framework-agnostic SDKs itself: `@sentry/browser` is initialized in `src/router.tsx` (`VITE_SENTRY_DSN` and
`VITE_SENTRY_ENVIRONMENT`, build time) with route-named page load and navigation spans
(`src/utils/sentry/routerTracing.ts`), `@sentry/node` in `instrument.server.mjs` (`SENTRY_DSN`, runtime, loaded with
`node --import`), server request and server function errors are reported by the global middleware in `src/start.ts`,
and `@sentry/vite-plugin` uploads source maps. See [error monitoring](../../docs/service-catalog.md#error-monitoring).

Weather widget diagnostics are written by cockpit as structured logger records (`src/utils/logger`) with scope `cockpit.weather.*`, including invalid location payloads, outbound request attempts, and upstream request failures.

## Finance Pages

Both finance routes call backend finance APIs through TanStack Start server functions (see
[finance domain](../../docs/domains/finance.md)).

The `/finance/accounts` route manages financial accounts:

- Create and edit accounts inline; archived accounts move to a collapsed "Archived" section and can be restored.
- Active accounts are reordered by drag and drop through a handle (pointer, touch, and keyboard via
  [`@dnd-kit/dom`](https://dndkit.com/), wired up directly because `@dnd-kit/solid` does not support SolidJS 2 yet).
  The new order shows immediately and rolls back if saving fails.

The `/finance/transactions` route manages manual income and expense transactions:

- The page supports date-range filtering, creating, editing, and deleting transactions, and an income/expense/net
  summary.
- Every transaction is booked on a financial account. The account picker offers active `EUR` accounts and keeps an
  already assigned archived account when editing.
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
