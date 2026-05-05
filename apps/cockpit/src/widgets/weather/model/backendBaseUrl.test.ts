import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCAL_BACKEND_BASE_URL, resolveBackendBaseUrl } from '@/widgets/weather/model/backendBaseUrl.ts';

describe('resolveBackendBaseUrl', () => {
  it('prefers the runtime backend URL', () => {
    expect(
      resolveBackendBaseUrl({
        runtimeBaseUrl: 'http://service-backend:8080',
        buildTimeBaseUrl: 'http://localhost:3010',
      }),
    ).toBe('http://service-backend:8080/');
  });

  it('falls back to the build-time backend URL', () => {
    expect(
      resolveBackendBaseUrl({
        buildTimeBaseUrl: 'http://localhost:5010',
      }),
    ).toBe('http://localhost:5010/');
  });

  it('uses the local orchestrator default when no URL is configured', () => {
    expect(resolveBackendBaseUrl({})).toBe(`${DEFAULT_LOCAL_BACKEND_BASE_URL}/`);
  });

  it('preserves base path prefixes', () => {
    expect(
      resolveBackendBaseUrl({
        runtimeBaseUrl: 'https://central.test/internal/backend',
      }),
    ).toBe('https://central.test/internal/backend/');
  });

  it('rejects invalid base URLs', () => {
    expect(() =>
      resolveBackendBaseUrl({
        runtimeBaseUrl: '/api/weather',
      }),
    ).toThrow(
      'Invalid backend base URL "/api/weather". Configure BACKEND_BASE_URL or VITE_BACKEND_API_BASE_URL with an absolute URL.',
    );
  });
});
