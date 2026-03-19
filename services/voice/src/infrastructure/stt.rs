use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::{multipart, Client};
use serde::{Deserialize, Serialize};

use crate::{
    domain::model::{SpeechToText, TranscriptionRequest},
    error::AppError,
};

#[derive(Clone)]
pub struct MockSpeechToText;

#[async_trait]
impl SpeechToText for MockSpeechToText {
    async fn transcribe(&self, _request: TranscriptionRequest) -> Result<String, AppError> {
        Ok("Das ist ein Mock-Transkript aus service-voice.".to_string())
    }
}

#[derive(Clone)]
pub struct JsonSpeechToTextClient {
    client: Client,
    url: String,
}

impl JsonSpeechToTextClient {
    pub fn new(client: Client, url: String) -> Self {
        Self { client, url }
    }
}

#[derive(Clone)]
pub struct OpenAiSpeechToTextClient {
    client: Client,
    base_url: String,
    api_key: String,
    model: String,
}

impl OpenAiSpeechToTextClient {
    pub fn new(client: Client, base_url: String, api_key: String, model: String) -> Self {
        Self {
            client,
            base_url,
            api_key,
            model,
        }
    }

    fn endpoint(&self) -> String {
        format!(
            "{}/audio/transcriptions",
            self.base_url.trim_end_matches('/')
        )
    }
}

fn file_name_for_audio_mime_type(audio_mime_type: &str) -> &'static str {
    match audio_mime_type {
        "audio/wav" | "audio/x-wav" => "audio.wav",
        "audio/mpeg" => "audio.mp3",
        "audio/mp4" => "audio.m4a",
        "audio/webm" => "audio.webm",
        "audio/ogg" => "audio.ogg",
        _ => "audio.bin",
    }
}

#[derive(Debug, Serialize)]
struct SpeechToTextRequestDto<'a> {
    #[serde(rename = "audioBase64")]
    audio_base64: String,
    #[serde(rename = "audioMimeType")]
    audio_mime_type: &'a str,
    language: &'a str,
}

#[derive(Debug, Deserialize)]
struct SpeechToTextResponseDto {
    text: String,
}

#[async_trait]
impl SpeechToText for JsonSpeechToTextClient {
    async fn transcribe(&self, request: TranscriptionRequest) -> Result<String, AppError> {
        let payload = SpeechToTextRequestDto {
            audio_base64: STANDARD.encode(request.audio_bytes),
            audio_mime_type: &request.audio_mime_type,
            language: &request.language,
        };

        let response = self
            .client
            .post(&self.url)
            .json(&payload)
            .send()
            .await
            .map_err(|error| AppError::Upstream(format!("STT request failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Upstream(format!(
                "STT upstream returned {status}: {body}"
            )));
        }

        let payload = response
            .json::<SpeechToTextResponseDto>()
            .await
            .map_err(|error| {
                AppError::Upstream(format!("Failed to decode STT response: {error}"))
            })?;

        Ok(payload.text)
    }
}

#[async_trait]
impl SpeechToText for OpenAiSpeechToTextClient {
    async fn transcribe(&self, request: TranscriptionRequest) -> Result<String, AppError> {
        let file_part = multipart::Part::bytes(request.audio_bytes)
            .file_name(file_name_for_audio_mime_type(&request.audio_mime_type).to_string())
            .mime_str(&request.audio_mime_type)
            .map_err(|error| {
                AppError::BadRequest(format!(
                    "Unsupported audio MIME type '{}': {error}",
                    request.audio_mime_type
                ))
            })?;
        let form = multipart::Form::new()
            .text("model", self.model.clone())
            .text("language", request.language)
            .part("file", file_part);

        let response = self
            .client
            .post(self.endpoint())
            .bearer_auth(&self.api_key)
            .multipart(form)
            .send()
            .await
            .map_err(|error| AppError::Upstream(format!("OpenAI STT request failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Upstream(format!(
                "OpenAI STT upstream returned {status}: {body}"
            )));
        }

        let payload = response
            .json::<SpeechToTextResponseDto>()
            .await
            .map_err(|error| {
                AppError::Upstream(format!("Failed to decode OpenAI STT response: {error}"))
            })?;

        Ok(payload.text)
    }
}
