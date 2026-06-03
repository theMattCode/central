import type { VoiceConversationStatus } from '@/domain/voice/model/model.ts';

export type JarvisMode = 'offline' | 'booting' | 'standby' | 'listening' | 'transcribing' | 'speaking' | 'error';
export type JarvisTone = 'normal' | 'attention' | 'error';

export type JarvisSystemStateInput = {
  conversationError: string | null;
  conversationStatus: VoiceConversationStatus;
  isEnabled: boolean;
  isVadLoading: boolean;
  userSpeaking: boolean;
  vadError: string | null;
};

export type JarvisSystemState = {
  detail: string;
  label: string;
  mode: JarvisMode;
  tone: JarvisTone;
};

function clamp01(value: number): number {
  if (Number.isNaN(value) || value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

export function resolveJarvisSystemState({
  conversationError,
  conversationStatus,
  isEnabled,
  isVadLoading,
  userSpeaking,
  vadError,
}: JarvisSystemStateInput): JarvisSystemState {
  if (!isEnabled) {
    return {
      detail: 'Voice control is offline. Activate the system to arm browser VAD and streamed speech playback.',
      label: 'System offline',
      mode: 'offline',
      tone: 'normal',
    };
  }

  if (vadError || conversationStatus === 'error') {
    return {
      detail: vadError ?? conversationError ?? 'The voice pipeline reported an error. Cycle the system to re-arm it.',
      label: 'Attention required',
      mode: 'error',
      tone: 'error',
    };
  }

  if (conversationStatus === 'playing') {
    return {
      detail: 'Streaming audio playback is active. Reactor motion is currently keyed to outgoing sound energy.',
      label: 'Voice reply online',
      mode: 'speaking',
      tone: 'normal',
    };
  }

  if (conversationStatus === 'processing') {
    return {
      detail: 'Speech turn captured. Transcription, model generation, and chunked synthesis are in flight.',
      label: 'Processing turn',
      mode: 'transcribing',
      tone: 'attention',
    };
  }

  if (isVadLoading) {
    return {
      detail: 'Calibrating microphone and local voice activity detection.',
      label: 'Calibrating sensors',
      mode: 'booting',
      tone: 'attention',
    };
  }

  if (userSpeaking) {
    return {
      detail: 'Capturing a live speech segment from the microphone.',
      label: 'Listening',
      mode: 'listening',
      tone: 'normal',
    };
  }

  return {
    detail: 'Standby loop active. The browser is armed and waiting for the next voice segment.',
    label: 'Standby',
    mode: 'standby',
    tone: 'normal',
  };
}

export function formatJarvisPercent(level: number): string {
  return `${String(Math.round(clamp01(level) * 100)).padStart(3, '0')}%`;
}
