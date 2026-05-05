export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | readonly LogValue[]
  | { readonly [key: string]: LogValue };

export type LogContext = Readonly<Record<string, unknown>>;

export type SerializedLogContext = Readonly<Record<string, LogValue>>;

export type SerializedError = Readonly<{
  name: string;
  message: string;
  stack?: string;
  cause?: LogValue;
}>;

export type LogRecord = Readonly<{
  timestamp: string;
  level: LogLevel;
  scope: string;
  event: string;
  context?: SerializedLogContext;
  error?: SerializedError;
}>;

export type LogWriter = Pick<Console, LogLevel>;

export interface Logger {
  child(context: LogContext): Logger;
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext, error?: unknown): void;
}

export type LoggerOptions = Readonly<{
  scope: string;
  context?: LogContext;
  writer?: LogWriter;
}>;
