import * as Sentry from '@sentry/browser';
import { createRouter } from '@tanstack/solid-router';
import { routeTree } from './routeTree.gen';
import { tanstackRouterBrowserTracingIntegration } from '@/utils/sentry/routerTracing.ts';

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
      integrations: [tanstackRouterBrowserTracingIntegration(router)],
      tracesSampleRate: 1.0,
    });
  }

  return router;
}

declare module '@tanstack/solid-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
