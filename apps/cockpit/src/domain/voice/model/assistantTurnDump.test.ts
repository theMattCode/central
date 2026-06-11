import { describe, expect, it } from 'vitest';
import {
  createAssistantTurnDumpBaseName,
  toAudioFileExtension,
} from 'src/domain/voice/model/assistantTurnDump.ts';

describe('assistant turn dump helpers', () => {
  it('maps known audio mime types to file extensions', () => {
    expect(toAudioFileExtension('audio/wav')).toBe('wav');
    expect(toAudioFileExtension('audio/mpeg')).toBe('mp3');
    expect(toAudioFileExtension('audio/unknown')).toBe('bin');
  });

  it('creates file-system-safe dump base names', () => {
    expect(
      createAssistantTurnDumpBaseName(
        new Date('2026-03-16T14:15:16.789Z'),
        'turn-123',
      ),
    ).toBe('2026-03-16T14-15-16-789Z-turn-123');
  });
});
