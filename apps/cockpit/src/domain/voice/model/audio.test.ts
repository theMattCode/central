import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  describeAudioBytes,
  encodeFloat32ToWavBase64,
  encodeFloat32ToWavBytes,
} from 'src/domain/voice/model/audio.ts';

describe('audio helpers', () => {
  it('writes a RIFF/WAVE header', () => {
    const bytes = encodeFloat32ToWavBytes(new Float32Array([0, 0.25, -0.25]));
    const header = String.fromCharCode(...bytes.subarray(0, 12));

    expect(header.startsWith('RIFF')).toBe(true);
    expect(header.endsWith('WAVE')).toBe(true);
  });

  it('round-trips bytes through base64', () => {
    const base64 = encodeFloat32ToWavBase64(new Float32Array([0.1, -0.1]));
    const bytes = base64ToBytes(base64);

    expect(bytes.length).toBeGreaterThan(44);
  });

  it('describes audio headers for diagnostics', () => {
    const bytes = encodeFloat32ToWavBytes(new Float32Array([0.1, -0.1]));
    const diagnostics = describeAudioBytes(bytes, 'audio/wav');

    expect(diagnostics.byteLength).toBe(bytes.length);
    expect(diagnostics.mimeType).toBe('audio/wav');
    expect(diagnostics.headerAscii.startsWith('RIFF')).toBe(true);
    expect(diagnostics.headerAscii.endsWith('WAVE')).toBe(true);
  });
});
