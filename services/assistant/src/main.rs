mod config;
mod context;
mod domain;
mod error;
mod http;
mod infrastructure;

use std::{net::SocketAddr, sync::Arc};

use config::{BackendMode, Config};
use context::Context;
use domain::{
    model::{ChatCompletion, SpeechToText, TextToSpeech},
    service::AssistantTurnService,
};
use infrastructure::{
    llm::{MockChatCompletion, OpenAiCompatibleChatClient},
    stt::{JsonSpeechToTextClient, MockSpeechToText, OpenAiSpeechToTextClient},
    tts::{JsonTextToSpeechClient, MockTextToSpeech, OpenAiTextToSpeechClient},
};
use reqwest::Client;
use tracing::{error, info};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "assistant_service=info,axum=info,tower_http=info".into()),
        )
        .init();

    let config = match Config::from_env() {
        Ok(config) => Arc::new(config),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    };

    info!(
        backend_mode = ?config.backend_mode,
        port = config.port,
        request_timeout_seconds = config.request_timeout.as_secs(),
        tts_stream_soft_limit_chars = config.tts_stream_soft_limit_chars,
        stt_url_configured = config.stt_url.is_some(),
        tts_url_configured = config.tts_url.is_some(),
        llm_base_url_configured = config.llm_base_url.is_some(),
        llm_model_configured = config.llm_model.is_some(),
        "Loaded assistant service configuration"
    );

    let http_client = Client::builder()
        .timeout(config.request_timeout)
        .build()
        .unwrap_or_else(|error| {
            error!("Failed to build HTTP client: {error}");
            std::process::exit(1);
        });

    let speech_to_text: Arc<dyn SpeechToText> = match &config.backend_mode {
        BackendMode::Mock | BackendMode::LlmProxy => Arc::new(MockSpeechToText),
        BackendMode::OpenAi => Arc::new(OpenAiSpeechToTextClient::new(
            http_client.clone(),
            config
                .llm_base_url
                .clone()
                .expect("validated config missing LLM base URL"),
            config
                .llm_api_key
                .clone()
                .expect("validated config missing LLM API key"),
            config
                .stt_model
                .clone()
                .expect("validated config missing STT model"),
        )),
        BackendMode::Proxy => Arc::new(JsonSpeechToTextClient::new(
            http_client.clone(),
            config
                .stt_url
                .clone()
                .expect("validated config missing STT URL"),
        )),
    };

    let chat_completion: Arc<dyn ChatCompletion> = match &config.backend_mode {
        BackendMode::Mock => Arc::new(MockChatCompletion),
        BackendMode::LlmProxy | BackendMode::OpenAi | BackendMode::Proxy => {
            Arc::new(OpenAiCompatibleChatClient::new(
                http_client.clone(),
                config
                    .llm_base_url
                    .clone()
                    .expect("validated config missing LLM base URL"),
                config.llm_api_key.clone(),
                config
                    .llm_model
                    .clone()
                    .expect("validated config missing LLM model"),
                config.llm_system_prompt.clone(),
            ))
        }
    };

    let text_to_speech: Arc<dyn TextToSpeech> = match &config.backend_mode {
        BackendMode::Mock | BackendMode::LlmProxy => Arc::new(MockTextToSpeech),
        BackendMode::OpenAi => Arc::new(OpenAiTextToSpeechClient::new(
            http_client,
            config
                .llm_base_url
                .clone()
                .expect("validated config missing LLM base URL"),
            config
                .llm_api_key
                .clone()
                .expect("validated config missing LLM API key"),
            config
                .tts_model
                .clone()
                .expect("validated config missing TTS model"),
            config.tts_voice.clone(),
        )),
        BackendMode::Proxy => Arc::new(JsonTextToSpeechClient::new(
            http_client,
            config
                .tts_url
                .clone()
                .expect("validated config missing TTS URL"),
        )),
    };

    let assistant_turn_service = AssistantTurnService::new(
        speech_to_text,
        chat_completion,
        text_to_speech,
        config.tts_stream_soft_limit_chars,
        config.default_language.clone(),
        config.default_voice_instruction.clone(),
    );

    if let Err(error) = run_http_server(config, assistant_turn_service).await {
        error!("{error}");
        std::process::exit(1);
    }
}

async fn run_http_server(
    config: Arc<Config>,
    assistant_turn_service: AssistantTurnService,
) -> Result<(), String> {
    let context = Context {
        config: Arc::clone(&config),
        assistant_turn_service,
    };

    let app = http::build_router(context);
    let address = SocketAddr::from(([0, 0, 0, 0], config.port));

    info!("Starting assistant HTTP service on {address}");

    let listener = tokio::net::TcpListener::bind(address)
        .await
        .map_err(|error| format!("Failed to bind assistant service socket: {error}"))?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|error| format!("Assistant service HTTP server error: {error}"))?;

    Ok(())
}

async fn shutdown_signal() {
    if let Err(error) = tokio::signal::ctrl_c().await {
        error!("Failed to listen for shutdown signal: {error}");
    }

    info!("Shutdown signal received");
}
