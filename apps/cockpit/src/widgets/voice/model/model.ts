export interface AssistantTurnInput {
  audioBase64: string;
  audioMimeType: string;
  language?: string;
  voiceInstruction?: string;
}

export interface AssistantTurnResult {
  transcript: string;
  responseText: string;
  audioBase64: string;
  audioMimeType: string;
}

export interface AssistantTurnAudioChunk {
  chunkIndex: number;
  text: string;
  audioBase64: string;
  audioMimeType: string;
}

export interface AssistantTurnStreamResult {
  transcript: string;
  responseText: string;
  audioChunks: AssistantTurnAudioChunk[];
}

export type VoiceConversationStatus = 'idle' | 'processing' | 'playing' | 'error';
