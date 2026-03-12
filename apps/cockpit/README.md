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

`WeatherWidget` reads snapshots from weather-service via:

- `GET /api/v1/weather/current?lat=<latitude>&lon=<longitude>&timezone=<tz>`

Configure the weather-service base URL through `VITE_WEATHER_API_BASE_URL` (defaults to `http://localhost:5010`).

Example:

```tsx
import { WeatherWidget } from '@/widgets/weather/components/WeatherWidget.tsx';
import type { WeatherLocation } from '@/widgets/weather/model/model.ts';

const BERLIN: WeatherLocation = {
  id: 'berlin',
  label: 'Berlin',
  latitude: 52.52,
  longitude: 13.41,
  timezone: 'Europe/Berlin',
};

<WeatherWidget location={BERLIN} />;
```

Widgets are rendered in `ContentLayout` in a responsive wrapping container.

## Container

```bash
pnpm nx run cockpit:container-build
pnpm nx run cockpit:container-run
```
