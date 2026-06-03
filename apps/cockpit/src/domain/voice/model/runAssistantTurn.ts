import { createServerFn } from '@tanstack/react-start';
import { getLogger } from '@/domain/voice/log.ts';
import type {
  AssistantTurnAudioChunk,
  AssistantTurnInput,
  AssistantTurnResult,
  AssistantTurnStreamResult,
} from 'src/domain/voice/model/model.ts';
import {
  dumpAssistantTurnArtifacts,
  dumpAssistantTurnStreamArtifacts,
} from 'src/domain/voice/model/assistantTurnDump.ts';
import { resolveAssistantServiceBaseUrl } from 'src/domain/voice/model/assistantServiceBaseUrl.ts';

type AssistantServiceError = {
  error?: {
    message?: string;
  };
};

type AssistantTurnTranscriptEvent = {
  transcript: string;
};

type AssistantTurnResponseDeltaEvent = {
  delta: string;
};

type AssistantTurnAudioChunkEvent = AssistantTurnAudioChunk;

type AssistantTurnDoneEvent = {
  responseText?: string;
};

type AssistantTurnSseEvent = {
  data: string;
  event: string;
};

type ExtractedSseEvents = {
  buffer: string;
  events: AssistantTurnSseEvent[];
};

export type StreamAssistantTurnOptions = {
  data: AssistantTurnInput;
  onAudioChunk?: (chunk: AssistantTurnAudioChunk) => void | Promise<void>;
  onDone?: (result: AssistantTurnStreamResult) => void | Promise<void>;
  onResponseDelta?: (delta: string) => void | Promise<void>;
  onTranscript?: (transcript: string) => void | Promise<void>;
  signal?: AbortSignal;
};

function createAssistantServiceUrl(baseUrl: string, path: string): URL {
  return new URL(path, baseUrl);
}

async function toErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as AssistantServiceError;
    const message = payload.error?.message;
    if (message) {
      return message;
    }
  } catch {
    // fall through to generic fallback
  }

  return `Assistant service request failed with status ${response.status}.`;
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

function parseSseEventFrame(frame: string): AssistantTurnSseEvent | null {
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
  const events: AssistantTurnSseEvent[] = [];
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

export function validateAssistantTurnInput(input: unknown): AssistantTurnInput {
  if (!input || typeof input !== 'object') {
    getLogger().error('invalid-turn-payload', { payloadType: typeof input });
    throw new Error('Invalid assistant turn payload.');
  }

  const payload = input as Partial<AssistantTurnInput>;

  if (
    typeof payload.audioBase64 !== 'string' ||
    payload.audioBase64.length === 0 ||
    typeof payload.audioMimeType !== 'string' ||
    payload.audioMimeType.length === 0 ||
    (payload.language !== undefined && typeof payload.language !== 'string') ||
    (payload.voiceInstruction !== undefined && typeof payload.voiceInstruction !== 'string')
  ) {
    getLogger().error('invalid-turn-payload', { payloadType: typeof input });
    throw new Error('Invalid assistant turn payload.');
  }

  return {
    audioBase64: payload.audioBase64,
    audioMimeType: payload.audioMimeType,
    language: payload.language,
    voiceInstruction: payload.voiceInstruction,
  };
}

async function requestAssistantTurn(input: AssistantTurnInput, signal?: AbortSignal): Promise<AssistantTurnResult> {
  const baseUrl = resolveAssistantServiceBaseUrl();
  const url = createAssistantServiceUrl(baseUrl, 'api/v1/assistant/turn');

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
    getLogger().error('request-assistant-turn-failed', { url: url.toString() }, error);
    throw new Error(error instanceof Error && error.message ? error.message : 'Failed to request an assistant turn.');
  }

  if (!response.ok) {
    const message = await toErrorMessage(response);
    getLogger().error(
      'request-assistant-turn-response-error',
      { status: response.status, statusText: response.statusText, url: url.toString() },
      message,
    );
    throw new Error(message);
  }

  const result = (await response.json()) as AssistantTurnResult;
  try {
    await dumpAssistantTurnArtifacts(input, result);
  } catch (error) {
    getLogger().error('dump-assistant-turn-artifacts-failed', { url: url.toString() }, error);
  }

  getLogger().info('requested assistant turn', {
    url: url.toString(),
    transcriptLength: result.transcript.length,
    responseLength: result.responseText.length,
  });

  return result;
}

async function emitFallbackStreamEvents(
  result: AssistantTurnResult,
  options: Omit<StreamAssistantTurnOptions, 'data' | 'signal'>,
): Promise<AssistantTurnStreamResult> {
  const fallbackResult: AssistantTurnStreamResult = {
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

export async function streamAssistantTurn(options: StreamAssistantTurnOptions): Promise<AssistantTurnStreamResult> {
  const input = validateAssistantTurnInput(options.data);
  const baseUrl = resolveAssistantServiceBaseUrl();
  const url = createAssistantServiceUrl(baseUrl, 'api/v1/assistant/turn/stream');

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
    getLogger().error('stream-assistant-turn-failed', { url: url.toString() }, error);
    throw new Error(error instanceof Error && error.message ? error.message : 'Failed to stream an assistant turn.');
  }

  if (!response.ok) {
    const message = await toErrorMessage(response);
    getLogger().error(
      'stream-assistant-turn-response-error',
      { status: response.status, statusText: response.statusText, url: url.toString() },
      message,
    );
    throw new Error(message);
  }

  if (!response.body) {
    return emitFallbackStreamEvents(await requestAssistantTurn(input, options.signal), options);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const audioChunks: AssistantTurnAudioChunk[] = [];
  let didReceiveDone = false;
  let transcript = '';
  let responseText = '';
  let sseBuffer = '';

  const handleEvent = async (event: AssistantTurnSseEvent): Promise<void> => {
    switch (event.event) {
      case 'transcript': {
        const payload = JSON.parse(event.data) as AssistantTurnTranscriptEvent;
        transcript = payload.transcript;
        await options.onTranscript?.(transcript);
        return;
      }
      case 'response_delta': {
        const payload = JSON.parse(event.data) as AssistantTurnResponseDeltaEvent;
        responseText += payload.delta;
        await options.onResponseDelta?.(payload.delta);
        return;
      }
      case 'audio_chunk': {
        const payload = JSON.parse(event.data) as AssistantTurnAudioChunkEvent;
        audioChunks.push(payload);
        await options.onAudioChunk?.(payload);
        return;
      }
      case 'done': {
        const payload = JSON.parse(event.data) as AssistantTurnDoneEvent;
        if (payload.responseText && payload.responseText.length > responseText.length) {
          responseText = payload.responseText;
        }
        didReceiveDone = true;
        return;
      }
      case 'error': {
        const payload = JSON.parse(event.data) as AssistantServiceError;
        throw new Error(payload.error?.message ?? 'Assistant stream failed.');
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
    throw new Error('Assistant stream ended before completion.');
  }

  const result: AssistantTurnStreamResult = {
    audioChunks,
    responseText,
    transcript,
  };

  try {
    await dumpAssistantTurnStreamArtifacts(input, result);
  } catch (error) {
    getLogger().error('dump-streamed-assistant-turn-artifacts-failed', { url: url.toString() }, error);
  }

  await options.onDone?.(result);

  getLogger().info('streamed assistant turn', {
    audioChunkCount: result.audioChunks.length,
    responseLength: result.responseText.length,
    transcriptLength: result.transcript.length,
    url: url.toString(),
  });

  return result;
}

export const runAssistantTurn = createServerFn({ method: 'POST' })
  .inputValidator(validateAssistantTurnInput)
  .handler(async ({ data }) => requestAssistantTurn(data));
