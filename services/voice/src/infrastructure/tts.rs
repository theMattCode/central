use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::{
    domain::model::{SynthesisRequest, SynthesisResult, TextToSpeech},
    error::AppError,
};

#[derive(Clone)]
pub struct MockTextToSpeech;

fn create_silence_wav(sample_rate: u32, duration_ms: u32) -> Vec<u8> {
    let bytes_per_sample = 2u32;
    let sample_count = sample_rate * duration_ms / 1000;
    let data_size = sample_count * bytes_per_sample;
    let mut buffer = Vec::with_capacity((44 + data_size) as usize);

    buffer.extend_from_slice(b"RIFF");
    buffer.extend_from_slice(&(36 + data_size).to_le_bytes());
    buffer.extend_from_slice(b"WAVE");
    buffer.extend_from_slice(b"fmt ");
    buffer.extend_from_slice(&16u32.to_le_bytes());
    buffer.extend_from_slice(&1u16.to_le_bytes());
    buffer.extend_from_slice(&1u16.to_le_bytes());
    buffer.extend_from_slice(&sample_rate.to_le_bytes());
    buffer.extend_from_slice(&(sample_rate * bytes_per_sample).to_le_bytes());
    buffer.extend_from_slice(&(bytes_per_sample as u16).to_le_bytes());
    buffer.extend_from_slice(&16u16.to_le_bytes());
    buffer.extend_from_slice(b"data");
    buffer.extend_from_slice(&data_size.to_le_bytes());
    buffer.resize((44 + data_size) as usize, 0);

    buffer
}

#[async_trait]
impl TextToSpeech for MockTextToSpeech {
    async fn synthesize(&self, _request: SynthesisRequest) -> Result<SynthesisResult, AppError> {
        Ok(SynthesisResult {
            audio_bytes: create_silence_wav(16_000, 350),
            audio_mime_type: "audio/wav".to_string(),
        })
    }
}

#[derive(Clone)]
pub struct JsonTextToSpeechClient {
    client: Client,
    url: String,
}

impl JsonTextToSpeechClient {
    pub fn new(client: Client, url: String) -> Self {
        Self { client, url }
    }
}

#[derive(Clone)]
pub struct OpenAiTextToSpeechClient {
    client: Client,
    base_url: String,
    api_key: String,
    model: String,
    voice: String,
}

impl OpenAiTextToSpeechClient {
    pub fn new(
        client: Client,
        base_url: String,
        api_key: String,
        model: String,
        voice: String,
    ) -> Self {
        Self {
            client,
            base_url,
            api_key,
            model,
            voice,
        }
    }

    fn endpoint(&self) -> String {
        format!("{}/audio/speech", self.base_url.trim_end_matches('/'))
    }
}

#[derive(Debug, Serialize)]
struct TextToSpeechRequestDto<'a> {
    text: &'a str,
    language: &'a str,
    #[serde(rename = "voiceInstruction")]
    voice_instruction: &'a str,
}

#[derive(Debug, Deserialize)]
struct TextToSpeechResponseDto {
    #[serde(rename = "audioBase64")]
    audio_base64: String,
    #[serde(rename = "audioMimeType")]
    audio_mime_type: String,
}

#[derive(Debug, Serialize)]
struct OpenAiTextToSpeechRequestDto<'a> {
    model: &'a str,
    input: &'a str,
    voice: &'a str,
    instructions: &'a str,
    response_format: &'a str,
}

#[async_trait]
impl TextToSpeech for JsonTextToSpeechClient {
    async fn synthesize(&self, request: SynthesisRequest) -> Result<SynthesisResult, AppError> {
        let payload = TextToSpeechRequestDto {
            text: &request.text,
            language: &request.language,
            voice_instruction: &request.voice_instruction,
        };

        let response = self
            .client
            .post(&self.url)
            .json(&payload)
            .send()
            .await
            .map_err(|error| AppError::Upstream(format!("TTS request failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Upstream(format!(
                "TTS upstream returned {status}: {body}"
            )));
        }

        let payload = response
            .json::<TextToSpeechResponseDto>()
            .await
            .map_err(|error| {
                AppError::Upstream(format!("Failed to decode TTS response: {error}"))
            })?;

        let audio_bytes = STANDARD.decode(payload.audio_base64).map_err(|error| {
            AppError::Upstream(format!("Invalid base64 audio from TTS: {error}"))
        })?;

        Ok(SynthesisResult {
            audio_bytes,
            audio_mime_type: payload.audio_mime_type,
        })
    }
}

#[async_trait]
impl TextToSpeech for OpenAiTextToSpeechClient {
    async fn synthesize(&self, request: SynthesisRequest) -> Result<SynthesisResult, AppError> {
        let payload = OpenAiTextToSpeechRequestDto {
            model: &self.model,
            input: &request.text,
            voice: &self.voice,
            instructions: &request.voice_instruction,
            response_format: "wav",
        };

        let response = self
            .client
            .post(self.endpoint())
            .bearer_auth(&self.api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|error| AppError::Upstream(format!("OpenAI TTS request failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Upstream(format!(
                "OpenAI TTS upstream returned {status}: {body}"
            )));
        }

        let audio_bytes = response.bytes().await.map_err(|error| {
            AppError::Upstream(format!("Failed to read OpenAI TTS audio: {error}"))
        })?;

        Ok(SynthesisResult {
            audio_bytes: audio_bytes.to_vec(),
            audio_mime_type: "audio/wav".to_string(),
        })
    }
}
