import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './index';

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

describe('createLogger', () => {
  it('writes structured records with merged context', () => {
    const writer = createWriter();
    const logger = createLogger({
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
      'INFO  weather-widget request-weather-data {"app":"cockpit","url":"http://localhost:3010/api/v1/weather/current"}',
    );
  });

  it('creates child loggers with inherited context', () => {
    const writer = createWriter();
    const logger = createLogger({
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
      'WARN  weather-widget refresh-delayed {"app":"cockpit","widget":"weather","retryInMs":15000}',
    );
  });

  it('serializes errors into the log record', () => {
    const writer = createWriter();
    const logger = createLogger({
      scope: 'weather-widget',
      writer,
    });

    logger.error('weather-service-request-failed', { baseUrl: 'http://localhost:3010' }, new Error('fetch failed'));

    expect(stripAnsi(writer.error.mock.calls[0][0])).toContain(
      'ERROR weather-widget weather-service-request-failed {"baseUrl":"http://localhost:3010"} {"error":{"name":"Error","message":"fetch failed"}}',
    );
  });
});
