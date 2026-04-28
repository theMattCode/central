use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};

use crate::{
    domain::model::{AssistantTurnAudioChunk, AssistantTurnRequest, AssistantTurnResult},
    error::AppError,
};

#[derive(Debug, Deserialize)]
pub struct AssistantTurnRequestDto {
    #[serde(rename = "audioBase64")]
    pub audio_base64: String,
    #[serde(rename = "audioMimeType")]
    pub audio_mime_type: String,
    pub language: Option<String>,
    #[serde(rename = "voiceInstruction")]
    pub voice_instruction: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AssistantTurnResponseDto {
    pub transcript: String,
    #[serde(rename = "responseText")]
    pub response_text: String,
    #[serde(rename = "audioBase64")]
    pub audio_base64: String,
    #[serde(rename = "audioMimeType")]
    pub audio_mime_type: String,
}

#[derive(Debug, Serialize)]
pub struct HealthzResponseDto {
    pub status: &'static str,
    #[serde(rename = "backendMode")]
    pub backend_mode: &'static str,
}

#[derive(Debug, Serialize)]
pub struct AssistantTurnTranscriptEventDto {
    pub transcript: String,
}

#[derive(Debug, Serialize)]
pub struct AssistantTurnResponseDeltaEventDto {
    pub delta: String,
}

#[derive(Debug, Serialize)]
pub struct AssistantTurnAudioChunkEventDto {
    #[serde(rename = "chunkIndex")]
    pub chunk_index: usize,
    pub text: String,
    #[serde(rename = "audioBase64")]
    pub audio_base64: String,
    #[serde(rename = "audioMimeType")]
    pub audio_mime_type: String,
}

#[derive(Debug, Serialize)]
pub struct AssistantTurnDoneEventDto {
    #[serde(rename = "responseText")]
    pub response_text: String,
}

#[derive(Debug, Serialize)]
pub struct StreamErrorEnvelopeDto {
    pub error: StreamErrorPayloadDto,
}

#[derive(Debug, Serialize)]
pub struct StreamErrorPayloadDto {
    pub message: String,
}

impl TryFrom<AssistantTurnRequestDto> for AssistantTurnRequest {
    type Error = AppError;

    fn try_from(value: AssistantTurnRequestDto) -> Result<Self, Self::Error> {
        if value.audio_base64.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Assistant turn request requires a non-empty audioBase64 field.".to_string(),
            ));
        }

        if value.audio_mime_type.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Assistant turn request requires a non-empty audioMimeType field.".to_string(),
            ));
        }

        let audio_bytes = STANDARD.decode(value.audio_base64).map_err(|error| {
            AppError::BadRequest(format!("Invalid audioBase64 payload: {error}"))
        })?;

        Ok(AssistantTurnRequest {
            audio_bytes,
            audio_mime_type: value.audio_mime_type,
            language: value.language,
            voice_instruction: value.voice_instruction,
        })
    }
}

impl From<AssistantTurnResult> for AssistantTurnResponseDto {
    fn from(value: AssistantTurnResult) -> Self {
        Self {
            transcript: value.transcript,
            response_text: value.response_text,
            audio_base64: STANDARD.encode(value.audio_bytes),
            audio_mime_type: value.audio_mime_type,
        }
    }
}

impl From<AssistantTurnAudioChunk> for AssistantTurnAudioChunkEventDto {
    fn from(value: AssistantTurnAudioChunk) -> Self {
        Self {
            chunk_index: value.chunk_index,
            text: value.text,
            audio_base64: STANDARD.encode(value.audio_bytes),
            audio_mime_type: value.audio_mime_type,
        }
    }
}
