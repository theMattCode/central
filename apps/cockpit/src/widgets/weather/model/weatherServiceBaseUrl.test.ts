import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCAL_WEATHER_SERVICE_BASE_URL,
  resolveWeatherServiceBaseUrl,
} from '@/widgets/weather/model/weatherServiceBaseUrl.ts';

describe('resolveWeatherServiceBaseUrl', () => {
  it('prefers the runtime weather service URL', () => {
    expect(
      resolveWeatherServiceBaseUrl({
        runtimeBaseUrl: 'http://service-weather:8080',
        buildTimeBaseUrl: 'http://localhost:3010',
      }),
    ).toBe('http://service-weather:8080/');
  });

  it('falls back to the build-time weather service URL', () => {
    expect(
      resolveWeatherServiceBaseUrl({
        buildTimeBaseUrl: 'http://localhost:5010',
      }),
    ).toBe('http://localhost:5010/');
  });

  it('uses the local orchestrator default when no URL is configured', () => {
    expect(resolveWeatherServiceBaseUrl({})).toBe(`${DEFAULT_LOCAL_WEATHER_SERVICE_BASE_URL}/`);
  });

  it('preserves base path prefixes', () => {
    expect(
      resolveWeatherServiceBaseUrl({
        runtimeBaseUrl: 'https://central.test/internal/weather',
      }),
    ).toBe('https://central.test/internal/weather/');
  });

  it('rejects invalid base URLs', () => {
    expect(() =>
      resolveWeatherServiceBaseUrl({
        runtimeBaseUrl: '/api/weather',
      }),
    ).toThrow(
      'Invalid weather service base URL "/api/weather". Configure WEATHER_SERVICE_BASE_URL or VITE_WEATHER_API_BASE_URL with an absolute URL.',
    );
  });
});
