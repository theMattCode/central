# Cockpit - Dashboard App

## Getting Started

To run this application:

```bash
pnpm install
pnpm dev
```

To run with Nx:

```bash
pnpm nx start cockpit
```

To build this application for production:

```bash
pnpm build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
pnpm test
```

Or with Nx:

```bash
pnpm nx test cockpit
pnpm nx typecheck cockpit
pnpm nx build cockpit
```

## Weather Widget

`WeatherWidget` uses Open-Meteo's DWD endpoint (`https://api.open-meteo.com/v1/dwd-icon`) and requests:

- `current`: `temperature_2m`, `weather_code`
- `hourly`: `temperature_2m`, `rain`, `snowfall`
- `forecast_days=1` for a full-day hourly view

The widget accepts one `location` prop per instance:

```tsx
import { WeatherWidget } from '@/widgets/weather/WeatherWidget.tsx';
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

To show multiple locations, render one widget per location:

```tsx
import { WeatherWidget } from '@/widgets/weather/WeatherWidget.tsx';
import { LOCATION_MOESSINGEN, LOCATION_OBERNHEIM } from '@/widgets/weather/model/model.ts';

<>
  <WeatherWidget location={LOCATION_MOESSINGEN} />
  <WeatherWidget location={LOCATION_OBERNHEIM} />
</>;
```

Widgets are rendered in a 12-column dashboard grid (`react-grid-layout`) below the breadcrumb in `ContentLayout`, so each widget can be dragged and resized.

Weather state changes in `WeatherWidget` use a shared fade transition wrapper at `src/components/Transition/FadeTransition.tsx`.

## Container

Build the cockpit container image:

```bash
pnpm nx run cockpit:container-build
```

Run the cockpit container image:

```bash
pnpm nx run cockpit:container-run
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application, add a new file in the `./src/routes` directory. TanStack will automatically generate the content of the route file for you. Now that you have another route you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation, you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

## Learn More

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start). You can learn more about TanStack in the [TanStack documentation](https://tanstack.com).
