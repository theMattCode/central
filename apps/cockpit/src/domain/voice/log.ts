import { createIsomorphicFn } from '@tanstack/react-start';
import { ConsoleLogger } from '@central/ts-log';

const CLIENT_LOGGER = new ConsoleLogger({ scope: 'cockpit.voice.client' });
const SERVER_LOGGER = new ConsoleLogger({ scope: 'cockpit.voice.server' });

export const getLogger = createIsomorphicFn()
  .server(() => SERVER_LOGGER)
  .client(() => CLIENT_LOGGER);
