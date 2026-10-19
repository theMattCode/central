import { createStart } from '@tanstack/solid-start';
import { sentryFunctionMiddleware, sentryRequestMiddleware } from '@/utils/sentry/middleware.ts';

export const startInstance = createStart(() => ({
  requestMiddleware: [sentryRequestMiddleware],
  functionMiddleware: [sentryFunctionMiddleware],
}));
