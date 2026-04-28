/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogger } from '@/widgets/voice/log.ts';
import { encodeFloat32ToWavBase64 } from './audio.ts';
import { streamAssistantTurn } from './runAssistantTurn.ts';
import { useVoiceConversation } from './useVoiceConversation.ts';

vi.mock('@/widgets/voice/model/runAssistantTurn.ts', () => ({
  streamAssistantTurn: vi.fn(),
}));

vi.mock('@/widgets/voice/log.ts', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

const TEST_AUDIO_URL = 'blob:http://localhost:5000/test-audio';

const createObjectURLMock = vi.fn(() => TEST_AUDIO_URL);
const revokeObjectURLMock = vi.fn();

const createdAudioElements: FakeAudioElement[] = [];

class FakeAudioElement {
  currentSrc: string;
  duration = 0.4;
  error: Pick<MediaError, 'code'> | null = null;
  networkState = 1;
  oncanplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onloadedmetadata: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  preload = '';
  readyState = 4;

  constructor(src = '') {
    this.currentSrc = src;
    createdAudioElements.push(this);
  }

  canPlayType = vi.fn(() => 'maybe');

  load = vi.fn(() => {
    this.networkState = 0;
    this.readyState = 0;
  });

  pause = vi.fn();

  play = vi.fn(async () => {
    this.onplaying?.();
  });

  removeAttribute = vi.fn((name: string) => {
    if (name === 'src') {
      this.currentSrc = '';
    }
  });
}

describe('useVoiceConversation', () => {
  const streamAssistantTurnMock = vi.mocked(streamAssistantTurn);
  const loggerErrorMock = vi.mocked(getLogger().error);
  const originalCreateObjectURL = globalThis.URL.createObjectURL;
  const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

  beforeEach(() => {
    createdAudioElements.length = 0;
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    loggerErrorMock.mockClear();

    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
      writable: true,
    });

    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
      writable: true,
    });

    vi.stubGlobal('Audio', FakeAudioElement as unknown as typeof Audio);

    streamAssistantTurnMock.mockImplementation(async (options) => {
      const audioBase64 = encodeFloat32ToWavBase64(new Float32Array([0.1, -0.1]));
      const audioChunk = {
        audioBase64,
        audioMimeType: 'audio/wav',
        chunkIndex: 0,
        text: 'Antwort',
      };

      await options.onTranscript?.('Hallo');
      await options.onResponseDelta?.('Antwort');
      await options.onAudioChunk?.(audioChunk);

      return {
        audioChunks: [audioChunk],
        responseText: 'Antwort',
        transcript: 'Hallo',
      };
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();

    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
      writable: true,
    });

    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectURL,
      writable: true,
    });
  });

  it('ignores late media errors after playback has already ended', async () => {
    const { result } = renderHook(() => useVoiceConversation({ language: 'de' }));

    await act(async () => {
      await result.current.processSpeech(new Float32Array([0.25, -0.25]));
    });

    await waitFor(() => {
      expect(result.current.status).toBe('playing');
    });

    const audioElement = createdAudioElements.at(-1);
    expect(audioElement).toBeDefined();

    const lateErrorHandler = audioElement?.onerror;

    await act(async () => {
      audioElement?.onended?.();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
    expect(audioElement?.onerror).toBeNull();
    expect(audioElement?.removeAttribute).toHaveBeenCalledWith('src');
    expect(audioElement?.load).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(TEST_AUDIO_URL);

    audioElement!.error = { code: 4 };

    await act(async () => {
      lateErrorHandler?.();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });
});
