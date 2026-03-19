import { createIsomorphicFn } from '@tanstack/react-start';
import { createLogger } from '@central/ts-log';

const CLIENT_LOGGER = createLogger({ scope: 'cockpit.voice.client' });
const SERVER_LOGGER = createLogger({ scope: 'cockpit.voice.server' });

export const getLogger = createIsomorphicFn()
  .server(() => SERVER_LOGGER)
  .client(() => CLIENT_LOGGER);
