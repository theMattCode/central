import {
  browserTracingIntegration,
  startBrowserTracingNavigationSpan,
  startBrowserTracingPageLoadSpan,
} from '@sentry/browser';
import type { Integration } from '@sentry/core';
import type { AnyRouter } from '@tanstack/solid-router';

/**
 * Browser tracing that names page load and navigation spans after the matched TanStack route,
 * mirroring `tanstackRouterBrowserTracingIntegration` from the React SDK.
 */
export function tanstackRouterBrowserTracingIntegration(router: AnyRouter): Integration {
  const integration = browserTracingIntegration({ instrumentNavigation: false, instrumentPageLoad: false });

  const matchRouteId = (pathname: string, search: unknown): string | undefined =>
    router.matchRoutes(pathname, search as Record<string, unknown>, { throwOnError: false }).at(-1)?.routeId;

  const spanAttributes = (op: string, routeId: string | undefined) => ({
    'sentry.op': op,
    'sentry.origin': `auto.${op}.solid.tanstack_router`,
    'sentry.source': routeId ? 'route' : 'url',
  });

  return {
    ...integration,
    afterAllSetup(client) {
      integration.afterAllSetup?.(client);

      const { pathname, search } = window.location;
      const pageLoadRouteId = matchRouteId(pathname, router.options.parseSearch(search));
      startBrowserTracingPageLoadSpan(client, {
        name: pageLoadRouteId ?? pathname,
        attributes: spanAttributes('pageload', pageLoadRouteId),
      });

      router.subscribe('onBeforeNavigate', ({ toLocation, fromLocation }) => {
        if (toLocation.state === fromLocation?.state) return;

        const routeId = matchRouteId(toLocation.pathname, toLocation.search);
        startBrowserTracingNavigationSpan(client, {
          name: routeId ?? toLocation.pathname,
          attributes: spanAttributes('navigation', routeId),
        });
      });
    },
  };
}
