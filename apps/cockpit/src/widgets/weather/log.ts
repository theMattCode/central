import { createIsomorphicFn } from '@tanstack/react-start';
import { createLogger } from '@central/ts-log';

const CLIENT_LOGGER = createLogger({ scope: 'cockpit.weather.client' });
const SERVER_LOGGER = createLogger({ scope: 'cockpit.weather.server' });

export const getLogger = createIsomorphicFn()
  .server(() => SERVER_LOGGER)
  .client(() => CLIENT_LOGGER);
