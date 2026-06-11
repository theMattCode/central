import { describe, expect, it } from 'vitest';
import {
  configureVoiceOrt,
  resolveVoiceStaticAssetPath,
  type VoiceOrtModule,
  VOICE_ORT_WASM_BINARY_URL,
  VOICE_ORT_WASM_MODULE_URL,
} from 'src/domain/voice/model/vadAssetPaths.ts';

describe('resolveVoiceStaticAssetPath', () => {
  it('appends a relative asset path to the normalized base path', () => {
    expect(resolveVoiceStaticAssetPath('vendor/vad/', '/')).toBe(
      '/vendor/vad/',
    );
    expect(resolveVoiceStaticAssetPath('vendor/vad/', '/cockpit/')).toBe(
      '/cockpit/vendor/vad/',
    );
  });

  it('normalizes base paths without a trailing slash', () => {
    expect(resolveVoiceStaticAssetPath('vendor/vad/', '/cockpit')).toBe(
      '/cockpit/vendor/vad/',
    );
  });
});

describe('configureVoiceOrt', () => {
  it('points onnxruntime-web at Vite-managed self-hosted assets', () => {
    const ort: VoiceOrtModule = {
      env: {
        logLevel: 'warning',
        wasm: {},
      },
    };

    configureVoiceOrt(ort);

    expect(ort.env.logLevel).toBe('error');
    expect(ort.env.wasm.wasmPaths).toEqual({
      mjs: VOICE_ORT_WASM_MODULE_URL,
      wasm: VOICE_ORT_WASM_BINARY_URL,
    });
  });
});
