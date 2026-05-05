import { createIsomorphicFn } from '@tanstack/react-start';

import { ConsoleLogger } from '@central/ts-log/src/logger/ConsoleLogger.ts';

const CLIENT_LOGGER = new ConsoleLogger({ scope: 'cockpit.weather.client' });
const SERVER_LOGGER = new ConsoleLogger({ scope: 'cockpit.weather.server' });

export const getLogger = createIsomorphicFn()
  .server(() => SERVER_LOGGER)
  .client(() => CLIENT_LOGGER);
