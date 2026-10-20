import { captureException } from '@sentry/core';
import { createMiddleware } from '@tanstack/solid-start';

async function reportErrors<T>(type: string, run: () => T | Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    captureException(error, { mechanism: { type, handled: false } });
    throw error;
  }
}

/** Reports errors thrown while handling a server request. */
export const sentryRequestMiddleware = createMiddleware({ type: 'request' }).server(({ next }) =>
  reportErrors('auto.middleware.tanstackstart.request', next),
);

/** Reports errors thrown by server functions. */
export const sentryFunctionMiddleware = createMiddleware({ type: 'function' }).server(({ next }) =>
  reportErrors('auto.middleware.tanstackstart.server_function', next),
);
