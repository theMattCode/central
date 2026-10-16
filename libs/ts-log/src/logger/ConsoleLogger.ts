import type {
  LogContext,
  Logger,
  LoggerOptions,
  LogLevel,
  LogRecord,
  LogValue,
  LogWriter,
  SerializedError,
  SerializedLogContext,
} from '#/logger/api';

export class ConsoleLogger implements Logger {
  private readonly scope: string;
  private readonly writer: LogWriter;
  private readonly baseContext?: LogContext;

  constructor({ scope, context, writer = DEFAULT_WRITER }: LoggerOptions) {
    this.scope = scope;
    this.baseContext = context;
    this.writer = writer;
  }

  child(context: LogContext): Logger {
    return new ConsoleLogger({
      scope: this.scope,
      writer: this.writer,
      context: {
        ...(this.baseContext ?? {}),
        ...context,
      },
    });
  }

  debug(event: string, context?: LogContext): void {
    this.write('debug', event, context);
  }

  info(event: string, context?: LogContext): void {
    this.write('info', event, context);
  }

  warn(event: string, context?: LogContext): void {
    this.write('warn', event, context);
  }

  error(event: string, context?: LogContext, error?: unknown): void {
    this.write('error', event, context, error);
  }

  private write(level: LogLevel, event: string, context?: LogContext, error?: unknown): void {
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      scope: this.scope,
      event,
      context: this.mergeContext(context),
      error: toSerializedError(error),
    };

    this.writer[level](formatLogLine(record));
  }

  private mergeContext(context?: LogContext): SerializedLogContext | undefined {
    if (!this.baseContext && !context) {
      return undefined;
    }

    const mergedContext = {
      ...(this.baseContext ?? {}),
      ...(context ?? {}),
    };

    return Object.fromEntries(Object.entries(mergedContext).map(([key, value]) => [key, toLogValue(value)]));
  }
}

const ANSI_RESET = '\u001B[0m';
const ANSI_DIM = '\u001B[90m';
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\u001B[36m',
  info: '\u001B[32m',
  warn: '\u001B[33m',
  error: '\u001B[31m',
};
const SCOPE_COLORS = [
  '\u001B[34m',
  '\u001B[35m',
  '\u001B[36m',
  '\u001B[32m',
  '\u001B[33m',
  '\u001B[91m',
  '\u001B[92m',
  '\u001B[93m',
  '\u001B[94m',
  '\u001B[95m',
  '\u001B[96m',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function supportsAnsiColors(): boolean {
  const runtime = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
      stdout?: {
        isTTY?: boolean;
      };
    };
  };

  const processRef = runtime.process;
  const forceColor = processRef?.env?.FORCE_COLOR;

  if (forceColor === '0') {
    return false;
  }

  if (forceColor && forceColor !== '0') {
    return true;
  }

  if (processRef?.env?.NO_COLOR) {
    return false;
  }

  return Boolean(processRef?.stdout?.isTTY);
}

function colorize(text: string, color: string): string {
  if (!supportsAnsiColors()) {
    return text;
  }

  return `${color}${text}${ANSI_RESET}`;
}

function toScopeColor(scope: string): string {
  let hash = 0;

  for (let index = 0; index < scope.length; index += 1) {
    hash = (hash * 31 + scope.charCodeAt(index)) >>> 0;
  }

  return SCOPE_COLORS[hash % SCOPE_COLORS.length];
}

function toLevelLabel(level: LogLevel): string {
  return level.toUpperCase().padEnd(5, ' ');
}

function toContextFragment(context: SerializedLogContext | undefined): string {
  return `${context ? JSON.stringify(context) : ''}`;
}

function toErrorFragment(error: SerializedError | undefined): string {
  if (!error) {
    return '';
  }

  const { stack: _stack, ...errorWithoutStack } = error;

  return `${JSON.stringify({ error: errorWithoutStack })}`;
}

function formatLogLine(record: LogRecord): string {
  const timestamp = colorize(record.timestamp, ANSI_DIM);
  const level = colorize(toLevelLabel(record.level), LEVEL_COLORS[record.level]);
  const scope = colorize(record.scope, toScopeColor(record.scope));

  return `${timestamp} ${level} | ${scope} | ${record.event}\n    context: ${toContextFragment(record.context)}${record.error ? `\n    error: ${toErrorFragment(record.error)}` : ''}`;
}

function toLogValue(value: unknown): LogValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toLogValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toLogValue(item)]));
  }

  return String(value);
}

function toSerializedError(error: unknown): SerializedError | undefined {
  if (!(error instanceof Error)) {
    return error === undefined
      ? undefined
      : {
          name: 'NonError',
          message: typeof error === 'string' ? error : JSON.stringify(toLogValue(error)),
        };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause === undefined ? undefined : toLogValue(error.cause),
  };
}

const DEFAULT_WRITER: LogWriter = console;
