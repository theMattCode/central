import * as Sentry from '@sentry/tanstackstart-react';

// Loaded with `node --import` before the server starts. An unset SENTRY_DSN disables the SDK.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
