use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tokio::sync::mpsc;
use tokio_stream::{wrappers::ReceiverStream, StreamExt};
use tracing::info;

use crate::{
    domain::model::{
        AssistantTurnAudioChunk, AssistantTurnRequest, AssistantTurnResult,
        AssistantTurnStreamEvent, ChatCompletion, ChatTurnRequest, SpeechToText, SynthesisRequest,
        TextToSpeech, TranscriptionRequest,
    },
    error::AppError,
};

const AUDIO_HEADER_BYTE_COUNT: usize = 12;
const STREAM_EVENT_CHANNEL_CAPACITY: usize = 32;
const STREAM_TTS_CHANNEL_CAPACITY: usize = 8;

fn audio_header_ascii(bytes: &[u8]) -> String {
    bytes
        .iter()
        .take(AUDIO_HEADER_BYTE_COUNT)
        .map(|byte| {
            if (32..=126).contains(byte) {
                char::from(*byte)
            } else {
                '.'
            }
        })
        .collect()
}

fn audio_header_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .take(AUDIO_HEADER_BYTE_COUNT)
        .map(|byte| format!("{byte:02x}"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn take_next_tts_chunk(
    buffer: &mut String,
    soft_limit_chars: usize,
    flush: bool,
) -> Option<String> {
    if let Some(boundary_index) = find_sentence_boundary(buffer) {
        let chunk = buffer.drain(..boundary_index).collect::<String>();
        return normalize_tts_chunk(chunk);
    }

    if let Some(boundary_index) = find_soft_boundary(buffer, soft_limit_chars) {
        let chunk = buffer.drain(..boundary_index).collect::<String>();
        return normalize_tts_chunk(chunk);
    }

    if flush {
        return normalize_tts_chunk(std::mem::take(buffer));
    }

    None
}

fn find_sentence_boundary(text: &str) -> Option<usize> {
    let mut characters = text.char_indices().peekable();

    while let Some((index, character)) = characters.next() {
        if !matches!(character, '.' | '!' | '?' | ';' | ':' | '\n') {
            continue;
        }

        let mut boundary_index = index + character.len_utf8();
        while let Some((next_index, next_character)) = characters.peek().copied() {
            if next_character.is_whitespace()
                || matches!(next_character, '"' | '\'' | ')' | ']' | '}' | '»')
            {
                boundary_index = next_index + next_character.len_utf8();
                characters.next();
                continue;
            }

            break;
        }

        return Some(boundary_index);
    }

    None
}

fn find_soft_boundary(text: &str, soft_limit_chars: usize) -> Option<usize> {
    let mut character_count = 0usize;
    let mut last_whitespace_boundary = None;

    for (index, character) in text.char_indices() {
        character_count += 1;

        if character.is_whitespace() {
            last_whitespace_boundary = Some(index + character.len_utf8());
        }

        if character_count >= soft_limit_chars {
            return last_whitespace_boundary;
        }
    }

    None
}

fn normalize_tts_chunk(text: String) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(trimmed.to_string())
}

async fn send_stream_event(
    event_sender: &mpsc::Sender<Result<AssistantTurnStreamEvent, AppError>>,
    event: AssistantTurnStreamEvent,
) -> bool {
    event_sender.send(Ok(event)).await.is_ok()
}

async fn send_stream_error(
    event_sender: &mpsc::Sender<Result<AssistantTurnStreamEvent, AppError>>,
    error: AppError,
) {
    let _ = event_sender.send(Err(error)).await;
}

#[derive(Clone)]
pub struct AssistantTurnService {
    speech_to_text: Arc<dyn SpeechToText>,
    chat_completion: Arc<dyn ChatCompletion>,
    text_to_speech: Arc<dyn TextToSpeech>,
    tts_stream_soft_limit_chars: usize,
    default_language: Arc<String>,
    default_voice_instruction: Arc<String>,
}

impl AssistantTurnService {
    pub fn new(
        speech_to_text: Arc<dyn SpeechToText>,
        chat_completion: Arc<dyn ChatCompletion>,
        text_to_speech: Arc<dyn TextToSpeech>,
        tts_stream_soft_limit_chars: usize,
        default_language: String,
        default_voice_instruction: String,
    ) -> Self {
        Self {
            speech_to_text,
            chat_completion,
            text_to_speech,
            tts_stream_soft_limit_chars,
            default_language: Arc::new(default_language),
            default_voice_instruction: Arc::new(default_voice_instruction),
        }
    }

    fn resolve_turn_settings(&self, request: &AssistantTurnRequest) -> (String, String) {
        let language = request
            .language
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| self.default_language.as_ref().clone());
        let voice_instruction = request
            .voice_instruction
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| self.default_voice_instruction.as_ref().clone());

        (language, voice_instruction)
    }

    fn validate_request(&self, request: &AssistantTurnRequest) -> Result<(), AppError> {
        if request.audio_bytes.is_empty() {
            return Err(AppError::BadRequest(
                "Assistant turn payload did not contain audio bytes.".to_string(),
            ));
        }

        Ok(())
    }

    pub async fn run_turn(
        &self,
        request: AssistantTurnRequest,
    ) -> Result<AssistantTurnResult, AppError> {
        self.validate_request(&request)?;

        let (language, voice_instruction) = self.resolve_turn_settings(&request);
        let input_audio_byte_length = request.audio_bytes.len();
        let input_audio_header_ascii = audio_header_ascii(&request.audio_bytes);
        let input_audio_header_hex = audio_header_hex(&request.audio_bytes);
        let input_audio_mime_type = request.audio_mime_type.clone();

        info!(
            input_audio_byte_length,
            input_audio_header_ascii = %input_audio_header_ascii,
            input_audio_header_hex = %input_audio_header_hex,
            input_audio_mime_type = %input_audio_mime_type,
            language = %language,
            voice_instruction_length = voice_instruction.len(),
            "Starting assistant turn"
        );

        let transcript = self
            .speech_to_text
            .transcribe(TranscriptionRequest {
                audio_bytes: request.audio_bytes,
                audio_mime_type: request.audio_mime_type,
                language: language.clone(),
            })
            .await?;

        info!(
            transcript_length = transcript.len(),
            "Completed speech-to-text"
        );

        let response_text = self
            .chat_completion
            .complete(ChatTurnRequest {
                transcript: transcript.clone(),
                language: language.clone(),
            })
            .await?;

        info!(
            response_length = response_text.len(),
            "Completed chat completion"
        );

        let synthesis = self
            .text_to_speech
            .synthesize(SynthesisRequest {
                text: response_text.clone(),
                language,
                voice_instruction,
            })
            .await?;
        let output_audio_byte_length = synthesis.audio_bytes.len();
        let output_audio_header_ascii = audio_header_ascii(&synthesis.audio_bytes);
        let output_audio_header_hex = audio_header_hex(&synthesis.audio_bytes);
        let output_audio_mime_type = synthesis.audio_mime_type.clone();

        info!(
            output_audio_byte_length,
            output_audio_header_ascii = %output_audio_header_ascii,
            output_audio_header_hex = %output_audio_header_hex,
            output_audio_mime_type = %output_audio_mime_type,
            "Completed text-to-speech"
        );

        Ok(AssistantTurnResult {
            transcript,
            response_text,
            audio_bytes: synthesis.audio_bytes,
            audio_mime_type: synthesis.audio_mime_type,
        })
    }

    pub fn run_turn_stream(
        &self,
        request: AssistantTurnRequest,
    ) -> Result<ReceiverStream<Result<AssistantTurnStreamEvent, AppError>>, AppError> {
        self.validate_request(&request)?;

        let (event_sender, event_receiver) = mpsc::channel(STREAM_EVENT_CHANNEL_CAPACITY);
        let service = self.clone();

        tokio::spawn(async move {
            service.run_turn_stream_task(request, event_sender).await;
        });

        Ok(ReceiverStream::new(event_receiver))
    }

    async fn run_turn_stream_task(
        self,
        request: AssistantTurnRequest,
        event_sender: mpsc::Sender<Result<AssistantTurnStreamEvent, AppError>>,
    ) {
        let (language, voice_instruction) = self.resolve_turn_settings(&request);
        let input_audio_byte_length = request.audio_bytes.len();
        let input_audio_header_ascii = audio_header_ascii(&request.audio_bytes);
        let input_audio_header_hex = audio_header_hex(&request.audio_bytes);
        let input_audio_mime_type = request.audio_mime_type.clone();

        info!(
            input_audio_byte_length,
            input_audio_header_ascii = %input_audio_header_ascii,
            input_audio_header_hex = %input_audio_header_hex,
            input_audio_mime_type = %input_audio_mime_type,
            language = %language,
            voice_instruction_length = voice_instruction.len(),
            "Starting streamed assistant turn"
        );

        let transcript = match self
            .speech_to_text
            .transcribe(TranscriptionRequest {
                audio_bytes: request.audio_bytes,
                audio_mime_type: request.audio_mime_type,
                language: language.clone(),
            })
            .await
        {
            Ok(transcript) => transcript,
            Err(error) => {
                send_stream_error(&event_sender, error).await;
                return;
            }
        };

        info!(
            transcript_length = transcript.len(),
            "Completed speech-to-text"
        );

        if !send_stream_event(
            &event_sender,
            AssistantTurnStreamEvent::Transcript {
                transcript: transcript.clone(),
            },
        )
        .await
        {
            return;
        }

        let mut delta_stream = match self
            .chat_completion
            .stream_complete(ChatTurnRequest {
                transcript: transcript.clone(),
                language: language.clone(),
            })
            .await
        {
            Ok(stream) => stream,
            Err(error) => {
                send_stream_error(&event_sender, error).await;
                return;
            }
        };

        let (tts_sender, mut tts_receiver) =
            mpsc::channel::<(usize, String)>(STREAM_TTS_CHANNEL_CAPACITY);
        let canceled = Arc::new(AtomicBool::new(false));
        let canceled_for_tts = Arc::clone(&canceled);
        let event_sender_for_tts = event_sender.clone();
        let text_to_speech = Arc::clone(&self.text_to_speech);
        let language_for_tts = language.clone();
        let voice_instruction_for_tts = voice_instruction.clone();

        let tts_worker = tokio::spawn(async move {
            while let Some((chunk_index, text)) = tts_receiver.recv().await {
                if canceled_for_tts.load(Ordering::Relaxed) {
                    return Ok::<(), AppError>(());
                }

                let synthesis = text_to_speech
                    .synthesize(SynthesisRequest {
                        text: text.clone(),
                        language: language_for_tts.clone(),
                        voice_instruction: voice_instruction_for_tts.clone(),
                    })
                    .await?;

                if canceled_for_tts.load(Ordering::Relaxed) {
                    return Ok(());
                }

                info!(
                    chunk_index,
                    chunk_text_length = text.len(),
                    output_audio_byte_length = synthesis.audio_bytes.len(),
                    output_audio_mime_type = %synthesis.audio_mime_type,
                    "Completed streamed text-to-speech chunk"
                );

                if !send_stream_event(
                    &event_sender_for_tts,
                    AssistantTurnStreamEvent::AudioChunk(AssistantTurnAudioChunk {
                        chunk_index,
                        text,
                        audio_bytes: synthesis.audio_bytes,
                        audio_mime_type: synthesis.audio_mime_type,
                    }),
                )
                .await
                {
                    canceled_for_tts.store(true, Ordering::Relaxed);
                    return Ok(());
                }
            }

            Ok(())
        });

        let mut response_text = String::new();
        let mut pending_tts_text = String::new();
        let mut audio_chunk_count = 0usize;

        while let Some(delta_result) = delta_stream.next().await {
            let delta = match delta_result {
                Ok(delta) if !delta.is_empty() => delta,
                Ok(_) => continue,
                Err(error) => {
                    canceled.store(true, Ordering::Relaxed);
                    drop(tts_sender);
                    send_stream_error(&event_sender, error).await;
                    return;
                }
            };

            response_text.push_str(&delta);
            pending_tts_text.push_str(&delta);

            if !send_stream_event(
                &event_sender,
                AssistantTurnStreamEvent::ResponseDelta {
                    delta: delta.clone(),
                },
            )
            .await
            {
                canceled.store(true, Ordering::Relaxed);
                drop(tts_sender);
                return;
            }

            while let Some(text_chunk) = take_next_tts_chunk(
                &mut pending_tts_text,
                self.tts_stream_soft_limit_chars,
                false,
            ) {
                if tts_sender
                    .send((audio_chunk_count, text_chunk))
                    .await
                    .is_err()
                {
                    canceled.store(true, Ordering::Relaxed);
                    return;
                }

                audio_chunk_count += 1;
            }
        }

        while let Some(text_chunk) = take_next_tts_chunk(
            &mut pending_tts_text,
            self.tts_stream_soft_limit_chars,
            true,
        ) {
            if tts_sender
                .send((audio_chunk_count, text_chunk))
                .await
                .is_err()
            {
                canceled.store(true, Ordering::Relaxed);
                return;
            }

            audio_chunk_count += 1;
        }

        drop(tts_sender);

        match tts_worker.await {
            Ok(Ok(())) => {}
            Ok(Err(error)) => {
                canceled.store(true, Ordering::Relaxed);
                send_stream_error(&event_sender, error).await;
                return;
            }
            Err(error) => {
                canceled.store(true, Ordering::Relaxed);
                send_stream_error(
                    &event_sender,
                    AppError::Upstream(format!("TTS worker failed: {error}")),
                )
                .await;
                return;
            }
        }

        info!(
            response_length = response_text.len(),
            audio_chunk_count, "Completed streamed chat completion"
        );

        let _ = send_stream_event(
            &event_sender,
            AssistantTurnStreamEvent::Done { response_text },
        )
        .await;
    }
}

#[cfg(test)]
mod tests {
    use super::take_next_tts_chunk;

    const TEST_TTS_STREAM_SOFT_LIMIT_CHARS: usize = 120;

    #[test]
    fn take_next_tts_chunk_prefers_sentence_boundaries() {
        let mut buffer = "Erster Satz. Zweiter Satz".to_string();

        let first_chunk = take_next_tts_chunk(&mut buffer, TEST_TTS_STREAM_SOFT_LIMIT_CHARS, false);

        assert_eq!(first_chunk.as_deref(), Some("Erster Satz."));
        assert_eq!(buffer, "Zweiter Satz");
    }

    #[test]
    fn take_next_tts_chunk_falls_back_to_soft_boundaries() {
        let mut buffer = format!("{}Danach", "wort ".repeat(TEST_TTS_STREAM_SOFT_LIMIT_CHARS));

        let first_chunk = take_next_tts_chunk(&mut buffer, TEST_TTS_STREAM_SOFT_LIMIT_CHARS, false);

        assert!(first_chunk.is_some());
        assert!(buffer.contains("Danach"));
    }

    #[test]
    fn take_next_tts_chunk_flushes_remaining_text() {
        let mut buffer = "Rest ohne Satzzeichen".to_string();

        assert_eq!(
            take_next_tts_chunk(&mut buffer, TEST_TTS_STREAM_SOFT_LIMIT_CHARS, false),
            None
        );
        assert_eq!(
            take_next_tts_chunk(&mut buffer, TEST_TTS_STREAM_SOFT_LIMIT_CHARS, true).as_deref(),
            Some("Rest ohne Satzzeichen")
        );
        assert!(buffer.is_empty());
    }
}
