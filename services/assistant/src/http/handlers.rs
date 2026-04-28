use std::{convert::Infallible, time::Duration};

use axum::{
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use tokio_stream::StreamExt;
use tracing::info;

use crate::{
    context::Context,
    domain::model::AssistantTurnStreamEvent,
    error::AppError,
    http::payload::{
        AssistantTurnAudioChunkEventDto, AssistantTurnDoneEventDto, AssistantTurnRequestDto,
        AssistantTurnResponseDeltaEventDto, AssistantTurnResponseDto,
        AssistantTurnTranscriptEventDto, HealthzResponseDto, StreamErrorEnvelopeDto,
        StreamErrorPayloadDto,
    },
};

pub async fn healthz(State(context): State<Context>) -> Json<HealthzResponseDto> {
    let backend_mode = context.config.backend_mode.as_str();

    Json(HealthzResponseDto {
        status: "ok",
        backend_mode,
    })
}

pub async fn run_turn(
    State(context): State<Context>,
    Json(payload): Json<AssistantTurnRequestDto>,
) -> Result<Json<AssistantTurnResponseDto>, AppError> {
    let request = payload.try_into()?;
    let result = context.assistant_turn_service.run_turn(request).await?;

    info!(
        audio_byte_length = result.audio_bytes.len(),
        audio_mime_type = %result.audio_mime_type,
        transcript_length = result.transcript.len(),
        response_length = result.response_text.len(),
        "Completed assistant turn"
    );

    Ok(Json(result.into()))
}

fn to_error_event(error: AppError) -> Event {
    let payload = StreamErrorEnvelopeDto {
        error: StreamErrorPayloadDto {
            message: error.to_string(),
        },
    };

    match serde_json::to_string(&payload) {
        Ok(data) => Event::default().event("error").data(data),
        Err(serialization_error) => Event::default().event("error").data(format!(
            "{{\"error\":{{\"message\":\"Failed to serialize stream error: {serialization_error}\"}}}}"
        )),
    }
}

fn serialize_stream_event<T: serde::Serialize>(event_name: &str, payload: &T) -> Event {
    match serde_json::to_string(payload) {
        Ok(data) => Event::default().event(event_name).data(data),
        Err(error) => to_error_event(AppError::Upstream(format!(
            "Failed to serialize '{event_name}' stream event: {error}"
        ))),
    }
}

fn to_stream_event(event: AssistantTurnStreamEvent) -> Event {
    match event {
        AssistantTurnStreamEvent::Transcript { transcript } => serialize_stream_event(
            "transcript",
            &AssistantTurnTranscriptEventDto { transcript },
        ),
        AssistantTurnStreamEvent::ResponseDelta { delta } => serialize_stream_event(
            "response_delta",
            &AssistantTurnResponseDeltaEventDto { delta },
        ),
        AssistantTurnStreamEvent::AudioChunk(audio_chunk) => serialize_stream_event(
            "audio_chunk",
            &AssistantTurnAudioChunkEventDto::from(audio_chunk),
        ),
        AssistantTurnStreamEvent::Done { response_text } => {
            serialize_stream_event("done", &AssistantTurnDoneEventDto { response_text })
        }
    }
}

pub async fn run_turn_stream(
    State(context): State<Context>,
    Json(payload): Json<AssistantTurnRequestDto>,
) -> Result<Sse<impl futures_core::Stream<Item = Result<Event, Infallible>>>, AppError> {
    let request = payload.try_into()?;
    let events = context.assistant_turn_service.run_turn_stream(request)?;
    let updates = events.map(|result| {
        Ok(match result {
            Ok(event) => to_stream_event(event),
            Err(error) => to_error_event(error),
        })
    });

    Ok(Sse::new(updates).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    ))
}
