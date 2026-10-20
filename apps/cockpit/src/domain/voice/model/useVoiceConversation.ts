import { createSignal, onSettled } from 'solid-js';
import { getLogger } from '@/domain/voice/log.ts';
import {
  base64ToBytes,
  createAudioObjectUrlFromBytes,
  describeAudioBytes,
  encodeFloat32ToWavBase64,
  WAV_AUDIO_MIME_TYPE,
  type AudioDiagnostics,
} from 'src/domain/voice/model/audio.ts';
import { getByteTimeDomainSignalLevel } from 'src/domain/voice/model/audioLevel.ts';
import type {
  VoiceConversationStatus,
  AssistantTurnAudioChunk,
  AssistantTurnInput,
} from 'src/domain/voice/model/model.ts';
import { streamAssistantTurn } from 'src/domain/voice/model/runAssistantTurn.ts';

type UseVoiceConversationOptions = {
  language?: string;
  voiceInstruction?: string;
};

type UseVoiceConversationResult = {
  playbackLevel: number;
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

  return 'Unexpected assistant request error.';
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
  const [playbackLevel, setPlaybackLevel] = createSignal(0);
  const [status, setStatus] = createSignal<VoiceConversationStatus>('idle');
  const [transcript, setTranscript] = createSignal<string | null>(null);
  const [responseText, setResponseText] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  let abortControllerRef: AbortController | null = null;
  let audioElementRef: HTMLAudioElement | null = null;
  let audioQueueRef: QueuedAudioChunk[] = [];
  let audioUrlRef: string | null = null;
  let audioAnalyserRef: AnalyserNode | null = null;
  let audioContextRef: AudioContext | null = null;
  let audioSourceNodeRef: MediaElementAudioSourceNode | null = null;
  let isStreamCompleteRef = false;
  let playbackFrameRef: number | null = null;

  const stopPlaybackMonitoring = () => {
    if (playbackFrameRef !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(playbackFrameRef);
      playbackFrameRef = null;
    }

    audioAnalyserRef?.disconnect();
    audioAnalyserRef = null;

    audioSourceNodeRef?.disconnect();
    audioSourceNodeRef = null;

    setPlaybackLevel(0);
  };

  const attachPlaybackMonitoring = (audioElement: HTMLAudioElement) => {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
      setPlaybackLevel(0);
      return;
    }

    stopPlaybackMonitoring();

    try {
      const audioContext = audioContextRef ?? new window.AudioContext();
      audioContextRef = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;

      const sourceNode = audioContext.createMediaElementSource(audioElement);
      sourceNode.connect(analyser);
      analyser.connect(audioContext.destination);

      audioAnalyserRef = analyser;
      audioSourceNodeRef = sourceNode;

      void audioContext.resume().catch(() => undefined);

      const buffer = new Uint8Array(analyser.fftSize);

      const measure = () => {
        if (audioAnalyserRef !== analyser) {
          return;
        }

        analyser.getByteTimeDomainData(buffer);
        const nextPlaybackLevel = getByteTimeDomainSignalLevel(buffer);
        setPlaybackLevel((currentValue) =>
          Math.abs(currentValue - nextPlaybackLevel) < 0.015 ? currentValue : nextPlaybackLevel,
        );
        playbackFrameRef = window.requestAnimationFrame(measure);
      };

      playbackFrameRef = window.requestAnimationFrame(measure);
    } catch (error) {
      getLogger().info('voice-playback-monitor-unavailable', {
        reason: toErrorMessage(error),
      });
      setPlaybackLevel(0);
    }
  };

  const clearCurrentAudio = () => {
    stopPlaybackMonitoring();

    const audioElement = audioElementRef;
    audioElementRef = null;
    if (audioElement) {
      releaseAudioElement(audioElement);
    }

    const audioUrl = audioUrlRef;
    audioUrlRef = null;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const clearQueuedAudioChunks = () => {
    for (const queuedChunk of audioQueueRef) {
      URL.revokeObjectURL(queuedChunk.audioUrl);
    }

    audioQueueRef = [];
  };

  const stopPlayback = () => {
    abortControllerRef?.abort();
    abortControllerRef = null;
    isStreamCompleteRef = false;

    clearCurrentAudio();
    clearQueuedAudioChunks();
  };

  const playNextChunk = () => {
    if (audioElementRef) {
      return;
    }

    const nextChunk = audioQueueRef.shift();
    if (!nextChunk) {
      if (isStreamCompleteRef) {
        setStatus('idle');
      }
      return;
    }

    const audioElement = new Audio(nextChunk.audioUrl);
    audioElement.preload = 'auto';
    audioElementRef = audioElement;
    audioUrlRef = nextChunk.audioUrl;
    attachPlaybackMonitoring(audioElement);

    audioElement.onloadedmetadata = () => {
      if (audioElementRef !== audioElement) {
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
      if (audioElementRef !== audioElement) {
        return;
      }

      getLogger().info('voice-playback-can-play', {
        chunkIndex: nextChunk.chunkIndex,
        ...nextChunk.audioDiagnostics,
        ...getAudioElementDiagnostics(audioElement, nextChunk.audioMimeType),
      });
    };

    audioElement.onplaying = () => {
      if (audioElementRef !== audioElement) {
        return;
      }

      getLogger().info('voice-playback-playing', {
        chunkIndex: nextChunk.chunkIndex,
        ...nextChunk.audioDiagnostics,
        ...getAudioElementDiagnostics(audioElement, nextChunk.audioMimeType),
      });
    };

    audioElement.onended = () => {
      if (audioElementRef !== audioElement) {
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
      if (audioElementRef !== audioElement) {
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
      if (audioElementRef !== audioElement) {
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
  };

  onSettled(() => {
    return () => {
      stopPlayback();

      const audioContext = audioContextRef;
      audioContextRef = null;
      void audioContext?.close().catch(() => undefined);
    };
  });

  const processSpeech = async (audio: Float32Array) => {
    stopPlayback();
    setStatus('processing');
    setTranscript(null);
    setResponseText(null);
    setErrorMessage(null);
    isStreamCompleteRef = false;

    const abortController = new AbortController();
    abortControllerRef = abortController;

    const shouldIgnoreEvent = () => abortController.signal.aborted || abortControllerRef !== abortController;

    const queueAudioChunk = (chunk: AssistantTurnAudioChunk) => {
      if (shouldIgnoreEvent()) {
        return;
      }

      const responseAudioBytes = base64ToBytes(chunk.audioBase64);
      const audioDiagnostics = describeAudioBytes(responseAudioBytes, chunk.audioMimeType);
      getLogger().info('assistant-turn-audio-chunk-received', {
        chunkIndex: chunk.chunkIndex,
        chunkTextLength: chunk.text.length,
        ...audioDiagnostics,
      });

      const audioUrl = createAudioObjectUrlFromBytes(responseAudioBytes, chunk.audioMimeType);
      audioQueueRef.push({
        audioDiagnostics,
        audioMimeType: chunk.audioMimeType,
        audioUrl,
        chunkIndex: chunk.chunkIndex,
      });
      playNextChunk();
    };

    const payload: AssistantTurnInput = {
      audioBase64: encodeFloat32ToWavBase64(audio),
      audioMimeType: WAV_AUDIO_MIME_TYPE,
      language: options.language ?? 'de',
      voiceInstruction: options.voiceInstruction,
    };

    getLogger().info('assistant-turn-request-started', {
      encodedAudioLength: payload.audioBase64.length,
      language: payload.language,
      sampleCount: audio.length,
      voiceInstructionLength: payload.voiceInstruction?.length ?? 0,
    });

    try {
      const result = await streamAssistantTurn({
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
          getLogger().info('assistant-turn-transcript-received', {
            transcriptLength: value.length,
          });
        },
        signal: abortController.signal,
      });

      if (shouldIgnoreEvent()) {
        return;
      }

      isStreamCompleteRef = true;
      setTranscript(result.transcript);
      setResponseText(result.responseText);

      getLogger().info('assistant-turn-stream-completed', {
        audioChunkCount: result.audioChunks.length,
        responseLength: result.responseText.length,
        transcriptLength: result.transcript.length,
      });

      if (!audioElementRef && audioQueueRef.length === 0) {
        setStatus('idle');
      } else {
        playNextChunk();
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        getLogger().info('assistant-turn-request-aborted');
        setStatus('idle');
        return;
      }

      getLogger().error('assistant-turn-failed', undefined, error);
      setStatus('error');
      setErrorMessage(toErrorMessage(error));
    }
  };

  return {
    get playbackLevel() {
      return playbackLevel();
    },
    get status() {
      return status();
    },
    get transcript() {
      return transcript();
    },
    get responseText() {
      return responseText();
    },
    get errorMessage() {
      return errorMessage();
    },
    processSpeech,
    stopPlayback,
  };
}
