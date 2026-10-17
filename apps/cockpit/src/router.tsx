import * as Sentry from '@sentry/tanstackstart-react';
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });

  // The server SDK is initialized in instrument.server.mjs. An unset VITE_SENTRY_DSN disables the SDK.
  // VITE_SENTRY_ENVIRONMENT is baked in at build time to match the server's SENTRY_ENVIRONMENT.
  if (!router.isServer) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
      tracesSampleRate: 1.0,
    });
  }

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
