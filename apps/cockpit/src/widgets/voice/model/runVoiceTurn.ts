import { createServerFn } from '@tanstack/react-start';
import { getLogger } from '@/widgets/voice/log.ts';
import type { VoiceTurnAudioChunk, VoiceTurnInput, VoiceTurnResult, VoiceTurnStreamResult } from './model.ts';
import { dumpVoiceTurnArtifacts, dumpVoiceTurnStreamArtifacts } from './voiceDump.ts';
import { resolveVoiceServiceBaseUrl } from './voiceServiceBaseUrl.ts';

type VoiceServiceError = {
  error?: {
    message?: string;
  };
};

type VoiceTurnTranscriptEvent = {
  transcript: string;
};

type VoiceTurnResponseDeltaEvent = {
  delta: string;
};

type VoiceTurnAudioChunkEvent = VoiceTurnAudioChunk;

type VoiceTurnDoneEvent = {
  responseText?: string;
};

type VoiceTurnSseEvent = {
  data: string;
  event: string;
};

type ExtractedSseEvents = {
  buffer: string;
  events: VoiceTurnSseEvent[];
};

export type StreamVoiceTurnOptions = {
  data: VoiceTurnInput;
  onAudioChunk?: (chunk: VoiceTurnAudioChunk) => void | Promise<void>;
  onDone?: (result: VoiceTurnStreamResult) => void | Promise<void>;
  onResponseDelta?: (delta: string) => void | Promise<void>;
  onTranscript?: (transcript: string) => void | Promise<void>;
  signal?: AbortSignal;
};

function createVoiceServiceUrl(baseUrl: string, path: string): URL {
  return new URL(path, baseUrl);
}

async function toErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as VoiceServiceError;
    const message = payload.error?.message;
    if (message) {
      return message;
    }
  } catch {
    // fall through to generic fallback
  }

  return `Voice service request failed with status ${response.status}.`;
}

function findNextSseFrameSeparator(buffer: string): { index: number; length: number } | null {
  const lineFeedIndex = buffer.indexOf('\n\n');
  const carriageReturnIndex = buffer.indexOf('\r\n\r\n');

  if (lineFeedIndex === -1 && carriageReturnIndex === -1) {
    return null;
  }

  if (lineFeedIndex === -1) {
    return { index: carriageReturnIndex, length: 4 };
  }

  if (carriageReturnIndex === -1 || lineFeedIndex < carriageReturnIndex) {
    return { index: lineFeedIndex, length: 2 };
  }

  return { index: carriageReturnIndex, length: 4 };
}

function parseSseEventFrame(frame: string): VoiceTurnSseEvent | null {
  const lines = frame.split(/\r?\n/u);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(':')) {
      continue;
    }

    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    data: dataLines.join('\n'),
    event,
  };
}

export function extractSseEvents(buffer: string): ExtractedSseEvents {
  const events: VoiceTurnSseEvent[] = [];
  let remaining = buffer;

  while (true) {
    const separator = findNextSseFrameSeparator(remaining);
    if (!separator) {
      break;
    }

    const frame = remaining.slice(0, separator.index);
    remaining = remaining.slice(separator.index + separator.length);

    const event = parseSseEventFrame(frame);
    if (event) {
      events.push(event);
    }
  }

  return {
    buffer: remaining,
    events,
  };
}

export function validateVoiceTurnInput(input: unknown): VoiceTurnInput {
  if (!input || typeof input !== 'object') {
    getLogger().error('invalid-turn-payload', { payloadType: typeof input });
    throw new Error('Invalid voice turn payload.');
  }

  const payload = input as Partial<VoiceTurnInput>;

  if (
    typeof payload.audioBase64 !== 'string' ||
    payload.audioBase64.length === 0 ||
    typeof payload.audioMimeType !== 'string' ||
    payload.audioMimeType.length === 0 ||
    (payload.language !== undefined && typeof payload.language !== 'string') ||
    (payload.voiceInstruction !== undefined && typeof payload.voiceInstruction !== 'string')
  ) {
    getLogger().error('invalid-turn-payload', { payloadType: typeof input });
    throw new Error('Invalid voice turn payload.');
  }

  return {
    audioBase64: payload.audioBase64,
    audioMimeType: payload.audioMimeType,
    language: payload.language,
    voiceInstruction: payload.voiceInstruction,
  };
}

async function requestVoiceTurn(input: VoiceTurnInput, signal?: AbortSignal): Promise<VoiceTurnResult> {
  const baseUrl = resolveVoiceServiceBaseUrl();
  const url = createVoiceServiceUrl(baseUrl, 'api/v1/voice/turn');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    getLogger().error('request-voice-turn-failed', { url: url.toString() }, error);
    throw new Error(error instanceof Error && error.message ? error.message : 'Failed to request a voice turn.');
  }

  if (!response.ok) {
    const message = await toErrorMessage(response);
    getLogger().error(
      'request-voice-turn-response-error',
      { status: response.status, statusText: response.statusText, url: url.toString() },
      message,
    );
    throw new Error(message);
  }

  const result = (await response.json()) as VoiceTurnResult;
  try {
    await dumpVoiceTurnArtifacts(input, result);
  } catch (error) {
    getLogger().error('dump-voice-turn-artifacts-failed', { url: url.toString() }, error);
  }

  getLogger().info('requested voice turn', {
    url: url.toString(),
    transcriptLength: result.transcript.length,
    responseLength: result.responseText.length,
  });

  return result;
}

async function emitFallbackStreamEvents(
  result: VoiceTurnResult,
  options: Omit<StreamVoiceTurnOptions, 'data' | 'signal'>,
): Promise<VoiceTurnStreamResult> {
  const fallbackResult: VoiceTurnStreamResult = {
    audioChunks: [
      {
        audioBase64: result.audioBase64,
        audioMimeType: result.audioMimeType,
        chunkIndex: 0,
        text: result.responseText,
      },
    ],
    responseText: result.responseText,
    transcript: result.transcript,
  };

  await options.onTranscript?.(fallbackResult.transcript);
  await options.onResponseDelta?.(fallbackResult.responseText);
  await options.onAudioChunk?.(fallbackResult.audioChunks[0]);
  await options.onDone?.(fallbackResult);

  return fallbackResult;
}

export async function streamVoiceTurn(options: StreamVoiceTurnOptions): Promise<VoiceTurnStreamResult> {
  const input = validateVoiceTurnInput(options.data);
  const baseUrl = resolveVoiceServiceBaseUrl();
  const url = createVoiceServiceUrl(baseUrl, 'api/v1/voice/turn/stream');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: options.signal,
    });
  } catch (error) {
    getLogger().error('stream-voice-turn-failed', { url: url.toString() }, error);
    throw new Error(error instanceof Error && error.message ? error.message : 'Failed to stream a voice turn.');
  }

  if (!response.ok) {
    const message = await toErrorMessage(response);
    getLogger().error(
      'stream-voice-turn-response-error',
      { status: response.status, statusText: response.statusText, url: url.toString() },
      message,
    );
    throw new Error(message);
  }

  if (!response.body) {
    return emitFallbackStreamEvents(await requestVoiceTurn(input, options.signal), options);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const audioChunks: VoiceTurnAudioChunk[] = [];
  let didReceiveDone = false;
  let transcript = '';
  let responseText = '';
  let sseBuffer = '';

  const handleEvent = async (event: VoiceTurnSseEvent): Promise<void> => {
    switch (event.event) {
      case 'transcript': {
        const payload = JSON.parse(event.data) as VoiceTurnTranscriptEvent;
        transcript = payload.transcript;
        await options.onTranscript?.(transcript);
        return;
      }
      case 'response_delta': {
        const payload = JSON.parse(event.data) as VoiceTurnResponseDeltaEvent;
        responseText += payload.delta;
        await options.onResponseDelta?.(payload.delta);
        return;
      }
      case 'audio_chunk': {
        const payload = JSON.parse(event.data) as VoiceTurnAudioChunkEvent;
        audioChunks.push(payload);
        await options.onAudioChunk?.(payload);
        return;
      }
      case 'done': {
        const payload = JSON.parse(event.data) as VoiceTurnDoneEvent;
        if (payload.responseText && payload.responseText.length > responseText.length) {
          responseText = payload.responseText;
        }
        didReceiveDone = true;
        return;
      }
      case 'error': {
        const payload = JSON.parse(event.data) as VoiceServiceError;
        throw new Error(payload.error?.message ?? 'Voice stream failed.');
      }
      default:
        return;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    sseBuffer += decoder.decode(value, { stream: true });
    const extracted = extractSseEvents(sseBuffer);
    sseBuffer = extracted.buffer;

    for (const event of extracted.events) {
      await handleEvent(event);
    }
  }

  sseBuffer += decoder.decode();
  const extracted = extractSseEvents(sseBuffer);
  sseBuffer = extracted.buffer;

  for (const event of extracted.events) {
    await handleEvent(event);
  }

  if (sseBuffer.trim().length > 0) {
    const trailingEvent = parseSseEventFrame(sseBuffer);
    if (trailingEvent) {
      await handleEvent(trailingEvent);
    }
  }

  if (!didReceiveDone) {
    throw new Error('Voice stream ended before completion.');
  }

  const result: VoiceTurnStreamResult = {
    audioChunks,
    responseText,
    transcript,
  };

  try {
    await dumpVoiceTurnStreamArtifacts(input, result);
  } catch (error) {
    getLogger().error('dump-streamed-voice-turn-artifacts-failed', { url: url.toString() }, error);
  }

  await options.onDone?.(result);

  getLogger().info('streamed voice turn', {
    audioChunkCount: result.audioChunks.length,
    responseLength: result.responseText.length,
    transcriptLength: result.transcript.length,
    url: url.toString(),
  });

  return result;
}

export const runVoiceTurn = createServerFn({ method: 'POST' })
  .inputValidator(validateVoiceTurnInput)
  .handler(async ({ data }) => requestVoiceTurn(data));
