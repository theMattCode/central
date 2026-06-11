import { describe, expect, it } from 'vitest';
import {
  getByteTimeDomainSignalLevel,
  getFloat32SignalLevel,
} from 'src/domain/voice/model/audioLevel.ts';

describe('audioLevel helpers', () => {
  it('treats silent float samples as zero energy', () => {
    expect(getFloat32SignalLevel(new Float32Array([0, 0, 0, 0]))).toBe(0);
  });

  it('reports higher energy for louder float samples', () => {
    const quietLevel = getFloat32SignalLevel(
      new Float32Array([0.03, -0.03, 0.02, -0.02]),
    );
    const loudLevel = getFloat32SignalLevel(
      new Float32Array([0.35, -0.32, 0.28, -0.3]),
    );

    expect(quietLevel).toBeGreaterThanOrEqual(0);
    expect(loudLevel).toBeGreaterThan(quietLevel);
    expect(loudLevel).toBeLessThanOrEqual(1);
  });

  it('treats centered time-domain bytes as silence', () => {
    expect(
      getByteTimeDomainSignalLevel(new Uint8Array([128, 128, 128, 128])),
    ).toBe(0);
  });

  it('reports higher energy for larger waveform movement in bytes', () => {
    const lowLevel = getByteTimeDomainSignalLevel(
      new Uint8Array([126, 129, 127, 130]),
    );
    const highLevel = getByteTimeDomainSignalLevel(
      new Uint8Array([72, 192, 88, 184]),
    );

    expect(highLevel).toBeGreaterThan(lowLevel);
    expect(highLevel).toBeLessThanOrEqual(1);
  });
});
