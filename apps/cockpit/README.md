# Cockpit

TanStack Start frontend application for the Central dashboard.

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
- `WeatherWidgetContainer` owns loading and refresh state; `WeatherWidget` is presentational.
- Cockpit then reads weather-service via `GET /api/v1/weather/current?lat=<latitude>&lon=<longitude>&timezone=<tz>`.

Configure the weather-service base URL on the cockpit server with `WEATHER_SERVICE_BASE_URL` (runtime) or `VITE_WEATHER_API_BASE_URL` (build-time fallback).

If neither is set, cockpit uses `http://localhost:3010` as the local orchestrator default. Other runtimes should set `WEATHER_SERVICE_BASE_URL` explicitly instead of relying on endpoint probing.

Weather widget diagnostics are written by cockpit as structured `@central/ts-log` records with scope `cockpit.weather.*`, including invalid location payloads, outbound request attempts, and upstream request failures.

Example:

```tsx
import { WeatherWidgetContainer } from '@/widgets/weather/components/WeatherWidgetContainer.tsx';
import type { WeatherLocation } from '@/widgets/weather/model/model.ts';

const BERLIN: WeatherLocation = {
  id: 'berlin',
  label: 'Berlin',
  latitude: 52.52,
  longitude: 13.41,
  timezone: 'Europe/Berlin',
};

<WeatherWidgetContainer location={BERLIN} />;
```

Widgets are rendered in `ContentLayout` in a responsive wrapping container.

## Container

```bash
pnpm nx run cockpit:container-build
pnpm nx run cockpit:container-run
```
