import { createIsomorphicFn } from '@tanstack/react-start';
import { ConsoleLogger, type Logger } from '@central/ts-log';

export function createLogger(domain: string): () => Logger {
  const clientLogger = new ConsoleLogger({ scope: `cockpit.${domain}.client` });
  const serverLogger = new ConsoleLogger({ scope: `cockpit.${domain}.server` });

  return createIsomorphicFn()
    .server(() => serverLogger)
    .client(() => clientLogger);
}
