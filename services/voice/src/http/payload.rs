use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};

use crate::{
    domain::model::{VoiceTurnAudioChunk, VoiceTurnRequest, VoiceTurnResult},
    error::AppError,
};

#[derive(Debug, Deserialize)]
pub struct VoiceTurnRequestDto {
    #[serde(rename = "audioBase64")]
    pub audio_base64: String,
    #[serde(rename = "audioMimeType")]
    pub audio_mime_type: String,
    pub language: Option<String>,
    #[serde(rename = "voiceInstruction")]
    pub voice_instruction: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VoiceTurnResponseDto {
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
pub struct VoiceTurnTranscriptEventDto {
    pub transcript: String,
}

#[derive(Debug, Serialize)]
pub struct VoiceTurnResponseDeltaEventDto {
    pub delta: String,
}

#[derive(Debug, Serialize)]
pub struct VoiceTurnAudioChunkEventDto {
    #[serde(rename = "chunkIndex")]
    pub chunk_index: usize,
    pub text: String,
    #[serde(rename = "audioBase64")]
    pub audio_base64: String,
    #[serde(rename = "audioMimeType")]
    pub audio_mime_type: String,
}

#[derive(Debug, Serialize)]
pub struct VoiceTurnDoneEventDto {
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

impl TryFrom<VoiceTurnRequestDto> for VoiceTurnRequest {
    type Error = AppError;

    fn try_from(value: VoiceTurnRequestDto) -> Result<Self, Self::Error> {
        if value.audio_base64.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Voice turn request requires a non-empty audioBase64 field.".to_string(),
            ));
        }

        if value.audio_mime_type.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Voice turn request requires a non-empty audioMimeType field.".to_string(),
            ));
        }

        let audio_bytes = STANDARD.decode(value.audio_base64).map_err(|error| {
            AppError::BadRequest(format!("Invalid audioBase64 payload: {error}"))
        })?;

        Ok(VoiceTurnRequest {
            audio_bytes,
            audio_mime_type: value.audio_mime_type,
            language: value.language,
            voice_instruction: value.voice_instruction,
        })
    }
}

impl From<VoiceTurnResult> for VoiceTurnResponseDto {
    fn from(value: VoiceTurnResult) -> Self {
        Self {
            transcript: value.transcript,
            response_text: value.response_text,
            audio_base64: STANDARD.encode(value.audio_bytes),
            audio_mime_type: value.audio_mime_type,
        }
    }
}

impl From<VoiceTurnAudioChunk> for VoiceTurnAudioChunkEventDto {
    fn from(value: VoiceTurnAudioChunk) -> Self {
        Self {
            chunk_index: value.chunk_index,
            text: value.text,
            audio_base64: STANDARD.encode(value.audio_bytes),
            audio_mime_type: value.audio_mime_type,
        }
    }
}
