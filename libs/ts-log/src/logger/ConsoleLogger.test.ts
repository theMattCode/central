import { describe, expect, it, vi } from 'vitest';
import { ConsoleLogger } from '#/logger/ConsoleLogger';

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

function createWriter() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('Console Logger', () => {
  it('writes structured records with merged context', () => {
    const writer = createWriter();
    const logger = new ConsoleLogger({
      scope: 'weather-widget',
      context: {
        app: 'cockpit',
      },
      writer,
    });

    logger.info('request-weather-data', {
      url: 'http://localhost:3010/api/v1/weather/current',
    });

    expect(stripAnsi(writer.info.mock.calls[0][0])).toContain(
      'INFO  | weather-widget | request-weather-data\n    context: {"app":"cockpit","url":"http://localhost:3010/api/v1/weather/current"}',
    );
  });

  it('creates child loggers with inherited context', () => {
    const writer = createWriter();
    const logger = new ConsoleLogger({
      scope: 'weather-widget',
      context: {
        app: 'cockpit',
      },
      writer,
    }).child({
      widget: 'weather',
    });

    logger.warn('refresh-delayed', {
      retryInMs: 15000,
    });

    expect(stripAnsi(writer.warn.mock.calls[0][0])).toContain(
      'WARN  | weather-widget | refresh-delayed\n    context: {"app":"cockpit","widget":"weather","retryInMs":15000}',
    );
  });

  it('serializes errors into the log record', () => {
    const writer = createWriter();
    const logger = new ConsoleLogger({
      scope: 'TestLogger',
      writer,
    });

    logger.error('backend-request-failed', { baseUrl: 'http://localhost:3010' }, new Error('fetch failed'));

    expect(stripAnsi(writer.error.mock.calls[0][0])).toContain(
      'ERROR | TestLogger | backend-request-failed\n    context: {"baseUrl":"http://localhost:3010"}\n    error: {"error":{"name":"Error","message":"fetch failed"}}',
    );
  });
});
