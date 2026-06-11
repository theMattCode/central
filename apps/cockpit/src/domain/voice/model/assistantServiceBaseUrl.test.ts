import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCAL_ASSISTANT_SERVICE_BASE_URL,
  resolveAssistantServiceBaseUrl,
} from 'src/domain/voice/model/assistantServiceBaseUrl.ts';

describe('resolveAssistantServiceBaseUrl', () => {
  it('uses the runtime URL before the build-time fallback', () => {
    expect(
      resolveAssistantServiceBaseUrl({
        runtimeBaseUrl: 'http://service-assistant:8080',
        buildTimeBaseUrl: 'http://localhost:9999',
      }),
    ).toBe('http://service-assistant:8080/');
  });

  it('falls back to the local orchestrator port', () => {
    expect(resolveAssistantServiceBaseUrl({})).toBe(
      `${DEFAULT_LOCAL_ASSISTANT_SERVICE_BASE_URL}/`,
    );
  });

  it('throws for invalid URLs', () => {
    expect(() =>
      resolveAssistantServiceBaseUrl({ runtimeBaseUrl: 'not-a-url' }),
    ).toThrow(/Invalid assistant service base URL/);
  });
});
