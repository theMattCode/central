import * as Sentry from '@sentry/node';

// Loaded with `node --import` before the server starts. An unset SENTRY_DSN disables the SDK.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE || undefined,
  tracesSampleRate: 1.0,
});
