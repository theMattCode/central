import { useCallback, useEffect, useRef, useState } from 'react';
import { getLogger } from '@/widgets/voice/log.ts';
import {
  base64ToBytes,
  createAudioObjectUrlFromBytes,
  describeAudioBytes,
  encodeFloat32ToWavBase64,
  WAV_AUDIO_MIME_TYPE,
  type AudioDiagnostics,
} from './audio.ts';
import type { VoiceConversationStatus, VoiceTurnAudioChunk, VoiceTurnInput } from './model.ts';
import { streamVoiceTurn } from './runVoiceTurn.ts';

type UseVoiceConversationOptions = {
  language?: string;
  voiceInstruction?: string;
};

type UseVoiceConversationResult = {
  status: VoiceConversationStatus;
  transcript: string | null;
  responseText: string | null;
  errorMessage: string | null;
  processSpeech: (audio: Float32Array) => Promise<void>;
  stopPlayback: () => void;
};

type QueuedAudioChunk = {
  audioDiagnostics: AudioDiagnostics;
  audioMimeType: string;
  audioUrl: string;
  chunkIndex: number;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected voice request error.';
}

function toMediaErrorCodeName(code: number | null | undefined): string {
  switch (code) {
    case 1:
      return 'MEDIA_ERR_ABORTED';
    case 2:
      return 'MEDIA_ERR_NETWORK';
    case 3:
      return 'MEDIA_ERR_DECODE';
    case 4:
      return 'MEDIA_ERR_SRC_NOT_SUPPORTED';
    default:
      return 'UNKNOWN_MEDIA_ERROR';
  }
}

function getAudioElementDiagnostics(audioElement: HTMLAudioElement, mimeType: string) {
  return {
    canPlayType: audioElement.canPlayType(mimeType) || 'empty',
    currentSrc: audioElement.currentSrc,
    networkState: audioElement.networkState,
    readyState: audioElement.readyState,
  };
}

function releaseAudioElement(audioElement: HTMLAudioElement): void {
  audioElement.onloadedmetadata = null;
  audioElement.oncanplay = null;
  audioElement.onplaying = null;
  audioElement.onended = null;
  audioElement.onerror = null;
  audioElement.pause();
  audioElement.removeAttribute('src');
  audioElement.load();
}

export function useVoiceConversation(options: UseVoiceConversationOptions = {}): UseVoiceConversationResult {
  const [status, setStatus] = useState<VoiceConversationStatus>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<QueuedAudioChunk[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const isStreamCompleteRef = useRef(false);

  const clearCurrentAudio = useCallback(() => {
    const audioElement = audioElementRef.current;
    audioElementRef.current = null;
    if (audioElement) {
      releaseAudioElement(audioElement);
    }

    const audioUrl = audioUrlRef.current;
    audioUrlRef.current = null;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, []);

  const clearQueuedAudioChunks = useCallback(() => {
    for (const queuedChunk of audioQueueRef.current) {
      URL.revokeObjectURL(queuedChunk.audioUrl);
    }

    audioQueueRef.current = [];
  }, []);

  const stopPlayback = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isStreamCompleteRef.current = false;

    clearCurrentAudio();
    clearQueuedAudioChunks();
  }, [clearCurrentAudio, clearQueuedAudioChunks]);

  const playNextChunk = useCallback(() => {
    if (audioElementRef.current) {
      return;
    }

    const nextChunk = audioQueueRef.current.shift();
    if (!nextChunk) {
      if (isStreamCompleteRef.current) {
        setStatus('idle');
      }
      return;
    }

    const audioElement = new Audio(nextChunk.audioUrl);
    audioElement.preload = 'auto';
    audioElementRef.current = audioElement;
    audioUrlRef.current = nextChunk.audioUrl;

    audioElement.onloadedmetadata = () => {
      if (audioElementRef.current !== audioElement) {
        return;
      }

      getLogger().info('voice-playback-loaded-metadata', {
        chunkIndex: nextChunk.chunkIndex,
        durationSeconds: Number.isFinite(audioElement.duration) ? audioElement.duration : null,
        ...nextChunk.audioDiagnostics,
        ...getAudioElementDiagnostics(audioElement, nextChunk.audioMimeType),
      });
    };

    audioElement.oncanplay = () => {
      if (audioElementRef.current !== audioElement) {
        return;
      }

      getLogger().info('voice-playback-can-play', {
        chunkIndex: nextChunk.chunkIndex,
        ...nextChunk.audioDiagnostics,
        ...getAudioElementDiagnostics(audioElement, nextChunk.audioMimeType),
      });
    };

    audioElement.onplaying = () => {
      if (audioElementRef.current !== audioElement) {
        return;
      }

      getLogger().info('voice-playback-playing', {
        chunkIndex: nextChunk.chunkIndex,
        ...nextChunk.audioDiagnostics,
        ...getAudioElementDiagnostics(audioElement, nextChunk.audioMimeType),
      });
    };

    audioElement.onended = () => {
      if (audioElementRef.current !== audioElement) {
        return;
      }

      getLogger().info('voice-playback-ended', {
        chunkIndex: nextChunk.chunkIndex,
        ...nextChunk.audioDiagnostics,
      });

      clearCurrentAudio();
      playNextChunk();
    };

    audioElement.onerror = () => {
      if (audioElementRef.current !== audioElement) {
        return;
      }

      const mediaErrorCode = audioElement.error?.code ?? null;
      const mediaErrorCodeName = toMediaErrorCodeName(mediaErrorCode);
      getLogger().error(
        'voice-playback-media-error',
        {
          chunkIndex: nextChunk.chunkIndex,
          mediaErrorCode,
          mediaErrorCodeName,
          ...nextChunk.audioDiagnostics,
          ...getAudioElementDiagnostics(audioElement, nextChunk.audioMimeType),
        },
        mediaErrorCodeName,
      );
      setStatus('error');
      setErrorMessage(`Voice playback failed (${mediaErrorCodeName}). Check cockpit.voice logs.`);
      stopPlayback();
    };

    setStatus('playing');
    getLogger().info('voice-playback-start-requested', {
      chunkIndex: nextChunk.chunkIndex,
      ...nextChunk.audioDiagnostics,
      ...getAudioElementDiagnostics(audioElement, nextChunk.audioMimeType),
    });

    void audioElement.play().catch((error) => {
      if (audioElementRef.current !== audioElement) {
        return;
      }

      getLogger().error(
        'voice-playback-start-failed',
        {
          chunkIndex: nextChunk.chunkIndex,
          ...nextChunk.audioDiagnostics,
          ...getAudioElementDiagnostics(audioElement, nextChunk.audioMimeType),
        },
        error,
      );
      setStatus('error');
      setErrorMessage(toErrorMessage(error));
      stopPlayback();
    });
  }, [clearCurrentAudio, stopPlayback]);

  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  const processSpeech = useCallback(
    async (audio: Float32Array) => {
      stopPlayback();
      setStatus('processing');
      setTranscript(null);
      setResponseText(null);
      setErrorMessage(null);
      isStreamCompleteRef.current = false;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const shouldIgnoreEvent = () => abortController.signal.aborted || abortControllerRef.current !== abortController;

      const queueAudioChunk = (chunk: VoiceTurnAudioChunk) => {
        if (shouldIgnoreEvent()) {
          return;
        }

        const responseAudioBytes = base64ToBytes(chunk.audioBase64);
        const audioDiagnostics = describeAudioBytes(responseAudioBytes, chunk.audioMimeType);
        getLogger().info('voice-turn-audio-chunk-received', {
          chunkIndex: chunk.chunkIndex,
          chunkTextLength: chunk.text.length,
          ...audioDiagnostics,
        });

        const audioUrl = createAudioObjectUrlFromBytes(responseAudioBytes, chunk.audioMimeType);
        audioQueueRef.current.push({
          audioDiagnostics,
          audioMimeType: chunk.audioMimeType,
          audioUrl,
          chunkIndex: chunk.chunkIndex,
        });
        playNextChunk();
      };

      const payload: VoiceTurnInput = {
        audioBase64: encodeFloat32ToWavBase64(audio),
        audioMimeType: WAV_AUDIO_MIME_TYPE,
        language: options.language ?? 'de',
        voiceInstruction: options.voiceInstruction,
      };

      getLogger().info('voice-turn-request-started', {
        encodedAudioLength: payload.audioBase64.length,
        language: payload.language,
        sampleCount: audio.length,
        voiceInstructionLength: payload.voiceInstruction?.length ?? 0,
      });

      try {
        const result = await streamVoiceTurn({
          data: payload,
          onAudioChunk: async (chunk) => queueAudioChunk(chunk),
          onResponseDelta: async (delta) => {
            if (shouldIgnoreEvent()) {
              return;
            }

            setResponseText((currentValue) => `${currentValue ?? ''}${delta}`);
          },
          onTranscript: async (value) => {
            if (shouldIgnoreEvent()) {
              return;
            }

            setTranscript(value);
            getLogger().info('voice-turn-transcript-received', {
              transcriptLength: value.length,
            });
          },
          signal: abortController.signal,
        });

        if (shouldIgnoreEvent()) {
          return;
        }

        isStreamCompleteRef.current = true;
        setTranscript(result.transcript);
        setResponseText(result.responseText);

        getLogger().info('voice-turn-stream-completed', {
          audioChunkCount: result.audioChunks.length,
          responseLength: result.responseText.length,
          transcriptLength: result.transcript.length,
        });

        if (!audioElementRef.current && audioQueueRef.current.length === 0) {
          setStatus('idle');
        } else {
          playNextChunk();
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          getLogger().info('voice-turn-request-aborted');
          setStatus('idle');
          return;
        }

        getLogger().error('voice-turn-failed', undefined, error);
        setStatus('error');
        setErrorMessage(toErrorMessage(error));
      }
    },
    [options.language, options.voiceInstruction, playNextChunk, stopPlayback],
  );

  return {
    status,
    transcript,
    responseText,
    errorMessage,
    processSpeech,
    stopPlayback,
  };
}
