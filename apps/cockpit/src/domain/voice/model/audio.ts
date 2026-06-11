const DEFAULT_SAMPLE_RATE = 16_000;
const WAV_AUDIO_MIME_TYPE = 'audio/wav';
const BASE64_CHUNK_SIZE = 0x8000;
const AUDIO_HEADER_BYTE_COUNT = 12;

export type AudioDiagnostics = {
  byteLength: number;
  mimeType: string;
  headerAscii: string;
  headerHex: string;
};

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function float32ToInt16Sample(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
}

export function encodeFloat32ToWavBytes(samples: Float32Array, sampleRate: number = DEFAULT_SAMPLE_RATE): Uint8Array {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(offset, float32ToInt16Sample(samples[index]), true);
    offset += bytesPerSample;
  }

  return new Uint8Array(buffer);
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeFloat32ToWavBase64(samples: Float32Array, sampleRate: number = DEFAULT_SAMPLE_RATE): string {
  return bytesToBase64(encodeFloat32ToWavBytes(samples, sampleRate));
}

function toAudioHeaderAscii(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, AUDIO_HEADER_BYTE_COUNT))
    .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'))
    .join('');
}

function toAudioHeaderHex(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, AUDIO_HEADER_BYTE_COUNT))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
}

export function describeAudioBytes(bytes: Uint8Array, mimeType: string): AudioDiagnostics {
  return {
    byteLength: bytes.byteLength,
    mimeType,
    headerAscii: toAudioHeaderAscii(bytes),
    headerHex: toAudioHeaderHex(bytes),
  };
}

export function createAudioObjectUrlFromBytes(audioBytes: Uint8Array, mimeType: string = WAV_AUDIO_MIME_TYPE): string {
  const audioBuffer = new ArrayBuffer(audioBytes.byteLength);
  new Uint8Array(audioBuffer).set(audioBytes);
  const blob = new Blob([audioBuffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function createAudioObjectUrl(audioBase64: string, mimeType: string = WAV_AUDIO_MIME_TYPE): string {
  return createAudioObjectUrlFromBytes(base64ToBytes(audioBase64), mimeType);
}

export { DEFAULT_SAMPLE_RATE, WAV_AUDIO_MIME_TYPE };
