use async_stream::try_stream;
use async_trait::async_trait;
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio_stream::StreamExt;

use crate::{
    domain::model::{ChatCompletion, ChatCompletionDeltaStream, ChatTurnRequest},
    error::AppError,
};

const MOCK_STREAM_DELTA_CHAR_COUNT: usize = 24;

#[derive(Clone)]
pub struct MockChatCompletion;

fn split_text_into_delta_chunks(text: &str, max_char_count: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current_chunk = String::new();

    for fragment in text.split_inclusive([' ', '\n']) {
        if !current_chunk.is_empty()
            && current_chunk.chars().count() + fragment.chars().count() > max_char_count
        {
            chunks.push(std::mem::take(&mut current_chunk));
        }

        current_chunk.push_str(fragment);
    }

    if !current_chunk.is_empty() {
        chunks.push(current_chunk);
    }

    if chunks.is_empty() {
        chunks.push(text.to_string());
    }

    chunks
}

#[async_trait]
impl ChatCompletion for MockChatCompletion {
    async fn complete(&self, request: ChatTurnRequest) -> Result<String, AppError> {
        Ok(format!(
            "Mock-Antwort ({language}): Ich habe verstanden: {transcript}",
            language = request.language,
            transcript = request.transcript
        ))
    }

    async fn stream_complete(
        &self,
        request: ChatTurnRequest,
    ) -> Result<ChatCompletionDeltaStream, AppError> {
        let response_text = self.complete(request).await?;

        Ok(Box::pin(try_stream! {
            for chunk in split_text_into_delta_chunks(&response_text, MOCK_STREAM_DELTA_CHAR_COUNT) {
                yield chunk;
            }
        }))
    }
}

#[derive(Clone)]
pub struct OpenAiCompatibleChatClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    model: String,
    system_prompt: String,
}

impl OpenAiCompatibleChatClient {
    pub fn new(
        client: Client,
        base_url: String,
        api_key: Option<String>,
        model: String,
        system_prompt: String,
    ) -> Self {
        Self {
            client,
            base_url,
            api_key,
            model,
            system_prompt,
        }
    }

    fn endpoint(&self) -> String {
        build_chat_completions_endpoint(&self.base_url)
    }
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequestDto {
    model: String,
    messages: Vec<ChatMessageDto>,
    temperature: f32,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct ChatMessageDto {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponseDto {
    choices: Vec<ChatChoiceDto>,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceDto {
    message: ChatAssistantMessageDto,
}

#[derive(Debug, Deserialize)]
struct ChatAssistantMessageDto {
    content: Value,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionStreamResponseDto {
    choices: Vec<ChatCompletionStreamChoiceDto>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionStreamChoiceDto {
    delta: ChatCompletionStreamDeltaDto,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionStreamDeltaDto {
    content: Option<Value>,
}

fn extract_message_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Array(items) => Some(
            items
                .iter()
                .filter_map(|item| item.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join(""),
        )
        .filter(|value| !value.is_empty()),
        _ => None,
    }
}

fn next_sse_frame(buffer: &mut Vec<u8>) -> Option<Vec<u8>> {
    let mut index = 0usize;

    while index + 1 < buffer.len() {
        if buffer[index] == b'\n' && buffer[index + 1] == b'\n' {
            let frame = buffer.drain(..index).collect::<Vec<_>>();
            buffer.drain(..2);
            return Some(frame);
        }

        if index + 3 < buffer.len()
            && buffer[index] == b'\r'
            && buffer[index + 1] == b'\n'
            && buffer[index + 2] == b'\r'
            && buffer[index + 3] == b'\n'
        {
            let frame = buffer.drain(..index).collect::<Vec<_>>();
            buffer.drain(..4);
            return Some(frame);
        }

        index += 1;
    }

    None
}

fn parse_sse_data(frame: &[u8]) -> Result<Option<String>, AppError> {
    let text = std::str::from_utf8(frame).map_err(|error| {
        AppError::Upstream(format!("LLM stream contained invalid UTF-8: {error}"))
    })?;
    let data_lines = text
        .lines()
        .filter_map(|line| {
            let normalized_line = line.trim_end_matches('\r');
            normalized_line
                .strip_prefix("data:")
                .map(|value| value.trim_start().to_string())
        })
        .collect::<Vec<_>>();

    if data_lines.is_empty() {
        return Ok(None);
    }

    Ok(Some(data_lines.join("\n")))
}

fn build_chat_completions_endpoint(base_url: &str) -> String {
    let trimmed_base_url = base_url.trim_end_matches('/');

    if trimmed_base_url.ends_with("/chat/completions") {
        trimmed_base_url.to_string()
    } else {
        format!("{trimmed_base_url}/chat/completions")
    }
}

impl OpenAiCompatibleChatClient {
    fn build_request_payload(
        &self,
        request: ChatTurnRequest,
        stream: bool,
    ) -> ChatCompletionRequestDto {
        let user_prompt = format!("Sprache: {}\n\n{}", request.language, request.transcript);

        ChatCompletionRequestDto {
            model: self.model.clone(),
            messages: vec![
                ChatMessageDto {
                    role: "system".to_string(),
                    content: self.system_prompt.clone(),
                },
                ChatMessageDto {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
            temperature: 1.0,
            stream,
        }
    }
}

#[async_trait]
impl ChatCompletion for OpenAiCompatibleChatClient {
    async fn complete(&self, request: ChatTurnRequest) -> Result<String, AppError> {
        let payload = self.build_request_payload(request, false);

        let mut request_builder = self.client.post(self.endpoint()).json(&payload);
        if let Some(api_key) = &self.api_key {
            request_builder =
                request_builder.header(header::AUTHORIZATION, format!("Bearer {api_key}"));
        }

        let response = request_builder
            .send()
            .await
            .map_err(|error| AppError::Upstream(format!("LLM request failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Upstream(format!(
                "LLM upstream returned {status}: {body}"
            )));
        }

        let payload = response
            .json::<ChatCompletionResponseDto>()
            .await
            .map_err(|error| {
                AppError::Upstream(format!("Failed to decode LLM response: {error}"))
            })?;

        let content = payload
            .choices
            .first()
            .and_then(|choice| extract_message_text(&choice.message.content))
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| {
                AppError::Upstream("LLM response did not contain text content.".to_string())
            })?;

        Ok(content)
    }

    async fn stream_complete(
        &self,
        request: ChatTurnRequest,
    ) -> Result<ChatCompletionDeltaStream, AppError> {
        let payload = self.build_request_payload(request, true);
        let mut request_builder = self.client.post(self.endpoint()).json(&payload);

        if let Some(api_key) = &self.api_key {
            request_builder =
                request_builder.header(header::AUTHORIZATION, format!("Bearer {api_key}"));
        }

        let response = request_builder
            .send()
            .await
            .map_err(|error| AppError::Upstream(format!("LLM stream request failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Upstream(format!(
                "LLM upstream returned {status}: {body}"
            )));
        }

        Ok(Box::pin(try_stream! {
            let mut upstream_stream = response.bytes_stream();
            let mut buffer = Vec::new();

            while let Some(chunk_result) = upstream_stream.next().await {
                let chunk = chunk_result.map_err(|error| {
                    AppError::Upstream(format!("Failed to read LLM stream chunk: {error}"))
                })?;
                buffer.extend_from_slice(&chunk);

                while let Some(frame) = next_sse_frame(&mut buffer) {
                    let Some(data) = parse_sse_data(&frame)? else {
                        continue;
                    };

                    if data == "[DONE]" {
                        return;
                    }

                    let payload = serde_json::from_str::<ChatCompletionStreamResponseDto>(&data)
                        .map_err(|error| {
                            AppError::Upstream(format!(
                                "Failed to decode LLM stream chunk: {error}"
                            ))
                        })?;

                    let Some(delta_text) = payload
                        .choices
                        .first()
                        .and_then(|choice| choice.delta.content.as_ref())
                        .and_then(extract_message_text)
                    else {
                        continue;
                    };

                    if !delta_text.is_empty() {
                        yield delta_text;
                    }
                }
            }

            if !buffer.is_empty() {
                let Some(data) = parse_sse_data(&buffer)? else {
                    return;
                };

                if data != "[DONE]" {
                    let payload = serde_json::from_str::<ChatCompletionStreamResponseDto>(&data)
                        .map_err(|error| {
                            AppError::Upstream(format!(
                                "Failed to decode final LLM stream chunk: {error}"
                            ))
                        })?;

                    if let Some(delta_text) = payload
                        .choices
                        .first()
                        .and_then(|choice| choice.delta.content.as_ref())
                        .and_then(extract_message_text)
                    {
                        if !delta_text.is_empty() {
                            yield delta_text;
                        }
                    }
                }
            }
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::build_chat_completions_endpoint;

    #[test]
    fn appends_chat_completions_for_wrapper_base_url() {
        assert_eq!(
            build_chat_completions_endpoint("http://service-voice-local-llm:8083"),
            "http://service-voice-local-llm:8083/chat/completions"
        );
    }

    #[test]
    fn appends_chat_completions_for_openai_compatible_v1_base_url() {
        assert_eq!(
            build_chat_completions_endpoint("http://service-voice-local-llm-runtime:11434/v1"),
            "http://service-voice-local-llm-runtime:11434/v1/chat/completions"
        );
    }

    #[test]
    fn preserves_explicit_chat_completions_endpoint() {
        assert_eq!(
            build_chat_completions_endpoint(
                "http://service-voice-local-llm-runtime:11434/v1/chat/completions/"
            ),
            "http://service-voice-local-llm-runtime:11434/v1/chat/completions"
        );
    }
}
