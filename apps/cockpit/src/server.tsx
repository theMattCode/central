/// <reference types="@solidjs/vite-plugin/virtual-solid-manifest" />

import { createStartHandler } from '@tanstack/solid-start/server';
import { renderRouterToStream, RouterServer } from '@tanstack/solid-router/ssr/server';
import manifest from 'virtual:solid-manifest';

const fetch = createStartHandler(({ request, router, responseHeaders }) =>
  renderRouterToStream({
    request,
    router,
    responseHeaders,
    children: () => <RouterServer router={router} />,
    manifest,
  }),
);

export default { fetch };
