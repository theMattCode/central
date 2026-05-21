import { describe, expect, it } from 'vitest';
import { formatJarvisPercent, resolveJarvisSystemState } from './model.ts';

describe('resolveJarvisSystemState', () => {
  it('returns offline while disabled', () => {
    expect(
      resolveJarvisSystemState({
        conversationError: null,
        conversationStatus: 'idle',
        isEnabled: false,
        isVadLoading: false,
        userSpeaking: false,
        vadError: null,
      }),
    ).toMatchObject({
      label: 'System offline',
      mode: 'offline',
      tone: 'normal',
    });
  });

  it('prioritizes playback over microphone activity', () => {
    expect(
      resolveJarvisSystemState({
        conversationError: null,
        conversationStatus: 'playing',
        isEnabled: true,
        isVadLoading: false,
        userSpeaking: true,
        vadError: null,
      }),
    ).toMatchObject({
      label: 'Voice reply online',
      mode: 'speaking',
      tone: 'normal',
    });
  });

  it('returns processing while the turn is being streamed', () => {
    expect(
      resolveJarvisSystemState({
        conversationError: null,
        conversationStatus: 'processing',
        isEnabled: true,
        isVadLoading: false,
        userSpeaking: false,
        vadError: null,
      }),
    ).toMatchObject({
      label: 'Processing turn',
      mode: 'transcribing',
      tone: 'attention',
    });
  });

  it('surfaces VAD failures as error state', () => {
    expect(
      resolveJarvisSystemState({
        conversationError: null,
        conversationStatus: 'idle',
        isEnabled: true,
        isVadLoading: false,
        userSpeaking: false,
        vadError: 'Permission denied',
      }),
    ).toMatchObject({
      label: 'Attention required',
      mode: 'error',
      tone: 'error',
    });
  });
});

describe('formatJarvisPercent', () => {
  it('renders zero-padded percentages', () => {
    expect(formatJarvisPercent(0)).toBe('000%');
    expect(formatJarvisPercent(0.328)).toBe('033%');
    expect(formatJarvisPercent(1.5)).toBe('100%');
  });
});
