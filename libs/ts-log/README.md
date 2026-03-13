# ts-log

Shared TypeScript logging library for the workspace.

It currently provides a small structured logger API over `console`:

- scoped loggers
- child context
- structured error serialization
- consistent log record shape across browser and server TypeScript packages
- terminal-friendly single-line output with colored level and scope when ANSI colors are available

Current guidance:

- import `createLogger` from `@central/ts-log`
- create a package or module scoped logger
- log structured context objects instead of preformatted strings

Example:

```ts
import { createLogger } from '@central/ts-log';

const logger = createLogger({
  scope: 'cockpit.weather.fetch',
});

logger.info('request-current-weather', {
  baseUrl: 'http://localhost:3010',
});
```

If server-side logging requirements grow, this library is the seam where a backend like Pino can replace the current `console` implementation without changing callers.
