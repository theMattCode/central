export interface VoiceTurnInput {
  audioBase64: string;
  audioMimeType: string;
  language?: string;
  voiceInstruction?: string;
}

export interface VoiceTurnResult {
  transcript: string;
  responseText: string;
  audioBase64: string;
  audioMimeType: string;
}

export interface VoiceTurnAudioChunk {
  chunkIndex: number;
  text: string;
  audioBase64: string;
  audioMimeType: string;
}

export interface VoiceTurnStreamResult {
  transcript: string;
  responseText: string;
  audioChunks: VoiceTurnAudioChunk[];
}

export type VoiceConversationStatus = 'idle' | 'processing' | 'playing' | 'error';
