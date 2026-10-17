import { createIsomorphicFn } from '@tanstack/react-start';
import { ConsoleLogger } from '@/utils/logger/ConsoleLogger';
import type { Logger } from '@/utils/logger/api';

export function createLogger(domain: string): () => Logger {
  const clientLogger = new ConsoleLogger({ scope: `cockpit.${domain}.client` });
  const serverLogger = new ConsoleLogger({ scope: `cockpit.${domain}.server` });

  return createIsomorphicFn()
    .server(() => serverLogger)
    .client(() => clientLogger);
}
