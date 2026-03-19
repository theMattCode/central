use std::pin::Pin;

use async_trait::async_trait;
use futures_core::Stream;

use crate::error::AppError;

pub type ChatCompletionDeltaStream = Pin<Box<dyn Stream<Item = Result<String, AppError>> + Send>>;

#[derive(Clone, Debug)]
pub struct VoiceTurnRequest {
    pub audio_bytes: Vec<u8>,
    pub audio_mime_type: String,
    pub language: Option<String>,
    pub voice_instruction: Option<String>,
}

#[derive(Clone, Debug)]
pub struct VoiceTurnResult {
    pub transcript: String,
    pub response_text: String,
    pub audio_bytes: Vec<u8>,
    pub audio_mime_type: String,
}

#[derive(Clone, Debug)]
pub struct VoiceTurnAudioChunk {
    pub chunk_index: usize,
    pub text: String,
    pub audio_bytes: Vec<u8>,
    pub audio_mime_type: String,
}

#[derive(Clone, Debug)]
pub enum VoiceTurnStreamEvent {
    Transcript { transcript: String },
    ResponseDelta { delta: String },
    AudioChunk(VoiceTurnAudioChunk),
    Done { response_text: String },
}

#[derive(Clone, Debug)]
pub struct TranscriptionRequest {
    pub audio_bytes: Vec<u8>,
    pub audio_mime_type: String,
    pub language: String,
}

#[derive(Clone, Debug)]
pub struct ChatTurnRequest {
    pub transcript: String,
    pub language: String,
}

#[derive(Clone, Debug)]
pub struct SynthesisRequest {
    pub text: String,
    pub language: String,
    pub voice_instruction: String,
}

#[derive(Clone, Debug)]
pub struct SynthesisResult {
    pub audio_bytes: Vec<u8>,
    pub audio_mime_type: String,
}

#[async_trait]
pub trait SpeechToText: Send + Sync {
    async fn transcribe(&self, request: TranscriptionRequest) -> Result<String, AppError>;
}

#[async_trait]
pub trait ChatCompletion: Send + Sync {
    async fn complete(&self, request: ChatTurnRequest) -> Result<String, AppError>;
    async fn stream_complete(
        &self,
        request: ChatTurnRequest,
    ) -> Result<ChatCompletionDeltaStream, AppError>;
}

#[async_trait]
pub trait TextToSpeech: Send + Sync {
    async fn synthesize(&self, request: SynthesisRequest) -> Result<SynthesisResult, AppError>;
}
