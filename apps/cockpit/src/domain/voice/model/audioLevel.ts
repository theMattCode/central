function clamp01(value: number): number {
  if (Number.isNaN(value) || value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function toRootMeanSquare(
  samples: ArrayLike<number>,
  centerSample: (sample: number) => number,
): number {
  if (samples.length === 0) {
    return 0;
  }

  let sumSquares = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const centeredSample = centerSample(Number(samples[index] ?? 0));
    sumSquares += centeredSample * centeredSample;
  }

  return Math.sqrt(sumSquares / samples.length);
}

function normalizeLevel(rootMeanSquare: number): number {
  return clamp01((rootMeanSquare - 0.018) * 4.6);
}

export function getFloat32SignalLevel(samples: ArrayLike<number>): number {
  return normalizeLevel(toRootMeanSquare(samples, (sample) => sample));
}

export function getByteTimeDomainSignalLevel(
  samples: ArrayLike<number>,
): number {
  return normalizeLevel(
    toRootMeanSquare(samples, (sample) => (sample - 128) / 128),
  );
}
