import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCAL_VOICE_SERVICE_BASE_URL, resolveVoiceServiceBaseUrl } from './voiceServiceBaseUrl.ts';

describe('resolveVoiceServiceBaseUrl', () => {
  it('uses the runtime URL before the build-time fallback', () => {
    expect(
      resolveVoiceServiceBaseUrl({
        runtimeBaseUrl: 'http://service-voice:8080',
        buildTimeBaseUrl: 'http://localhost:9999',
      }),
    ).toBe('http://service-voice:8080/');
  });

  it('falls back to the local orchestrator port', () => {
    expect(resolveVoiceServiceBaseUrl({})).toBe(`${DEFAULT_LOCAL_VOICE_SERVICE_BASE_URL}/`);
  });

  it('throws for invalid URLs', () => {
    expect(() => resolveVoiceServiceBaseUrl({ runtimeBaseUrl: 'not-a-url' })).toThrow(/Invalid voice service base URL/);
  });
});
