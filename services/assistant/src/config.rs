use std::{env, time::Duration};

const DEFAULT_ASSISTANT_NAME: &str = "Jarvis";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BackendMode {
    Mock,
    LlmProxy,
    OpenAi,
    Proxy,
}

impl BackendMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Mock => "mock",
            Self::LlmProxy => "llm-proxy",
            Self::OpenAi => "openai",
            Self::Proxy => "proxy",
        }
    }

    fn uses_mock_llm(&self) -> bool {
        matches!(self, Self::Mock)
    }

    fn uses_openai_stt(&self) -> bool {
        matches!(self, Self::OpenAi)
    }

    fn uses_openai_tts(&self) -> bool {
        matches!(self, Self::OpenAi)
    }

    fn uses_json_stt(&self) -> bool {
        matches!(self, Self::Proxy)
    }

    fn uses_json_tts(&self) -> bool {
        matches!(self, Self::Proxy)
    }

    fn requires_llm_api_key(&self) -> bool {
        matches!(self, Self::OpenAi)
    }
}

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub backend_mode: BackendMode,
    pub request_timeout: Duration,
    pub tts_stream_soft_limit_chars: usize,
    pub cors_allow_origin: String,
    pub default_language: String,
    pub default_voice_instruction: String,
    pub llm_base_url: Option<String>,
    pub llm_api_key: Option<String>,
    pub llm_model: Option<String>,
    pub llm_system_prompt: String,
    pub stt_url: Option<String>,
    pub stt_model: Option<String>,
    pub tts_url: Option<String>,
    pub tts_model: Option<String>,
    pub tts_voice: String,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let backend_mode = parse_backend_mode(env::var("ASSISTANT_BACKEND_MODE").ok())?;
        let assistant_name = env::var("ASSISTANT_NAME")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_ASSISTANT_NAME.to_string());

        let config = Self {
            port: parse_u16("ASSISTANT_PORT", 5020)?,
            backend_mode,
            request_timeout: Duration::from_secs(parse_u64(
                "ASSISTANT_REQUEST_TIMEOUT_SECONDS",
                30,
            )?),
            tts_stream_soft_limit_chars: parse_usize("TTS_STREAM_SOFT_LIMIT_CHARS", 220)?,
            cors_allow_origin: env::var("ASSISTANT_CORS_ALLOW_ORIGIN")
                .unwrap_or_else(|_| "*".to_string()),
            default_language: env::var("ASSISTANT_DEFAULT_LANGUAGE")
                .unwrap_or_else(|_| "de".to_string()),
            default_voice_instruction: env::var("ASSISTANT_DEFAULT_VOICE_INSTRUCTION")
                .unwrap_or_else(|_| {
                    "Ruhige, warme deutsche Stimme. Sprich klar, freundlich und eher knapp."
                        .to_string()
                }),
            llm_base_url: env::var("LLM_BASE_URL")
                .ok()
                .filter(|value| !value.is_empty()),
            llm_api_key: env::var("LLM_API_KEY")
                .ok()
                .filter(|value| !value.is_empty()),
            llm_model: env::var("LLM_MODEL").ok().filter(|value| !value.is_empty()),
            llm_system_prompt: env::var("LLM_SYSTEM_PROMPT")
                .ok()
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| build_default_llm_system_prompt(&assistant_name)),
            stt_url: env::var("STT_URL").ok().filter(|value| !value.is_empty()),
            stt_model: env::var("STT_MODEL").ok().filter(|value| !value.is_empty()),
            tts_url: env::var("TTS_URL").ok().filter(|value| !value.is_empty()),
            tts_model: env::var("TTS_MODEL").ok().filter(|value| !value.is_empty()),
            tts_voice: env::var("TTS_VOICE")
                .ok()
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "alloy".to_string()),
        };

        config.validate()?;
        Ok(config)
    }

    fn validate(&self) -> Result<(), String> {
        if self.tts_stream_soft_limit_chars == 0 {
            return Err("TTS_STREAM_SOFT_LIMIT_CHARS must be greater than 0".to_string());
        }

        if self.backend_mode.uses_json_stt() && self.stt_url.is_none() {
            return Err(format!(
                "STT_URL is required when ASSISTANT_BACKEND_MODE={}",
                self.backend_mode.as_str()
            ));
        }

        if self.backend_mode.uses_json_tts() && self.tts_url.is_none() {
            return Err(format!(
                "TTS_URL is required when ASSISTANT_BACKEND_MODE={}",
                self.backend_mode.as_str()
            ));
        }

        if !self.backend_mode.uses_mock_llm() {
            if self.llm_base_url.is_none() {
                return Err(format!(
                    "LLM_BASE_URL is required when ASSISTANT_BACKEND_MODE={}",
                    self.backend_mode.as_str()
                ));
            }

            if self.llm_model.is_none() {
                return Err(format!(
                    "LLM_MODEL is required when ASSISTANT_BACKEND_MODE={}",
                    self.backend_mode.as_str()
                ));
            }
        }

        if self.backend_mode.requires_llm_api_key() && self.llm_api_key.is_none() {
            return Err(format!(
                "LLM_API_KEY is required when ASSISTANT_BACKEND_MODE={}",
                self.backend_mode.as_str()
            ));
        }

        if self.backend_mode.uses_openai_stt() && self.stt_model.is_none() {
            return Err(format!(
                "STT_MODEL is required when ASSISTANT_BACKEND_MODE={}",
                self.backend_mode.as_str()
            ));
        }

        if self.backend_mode.uses_openai_tts() && self.tts_model.is_none() {
            return Err(format!(
                "TTS_MODEL is required when ASSISTANT_BACKEND_MODE={}",
                self.backend_mode.as_str()
            ));
        }

        Ok(())
    }
}

fn build_default_llm_system_prompt(assistant_name: &str) -> String {
    format!(
        "Du bist {assistant_name}, ein deutscher Sprachassistent in Central. Antworte hilfreich, ruhig und eher knapp."
    )
}

fn parse_backend_mode(value: Option<String>) -> Result<BackendMode, String> {
    match value.as_deref().unwrap_or("mock") {
        "mock" => Ok(BackendMode::Mock),
        "llm-proxy" => Ok(BackendMode::LlmProxy),
        "openai" => Ok(BackendMode::OpenAi),
        "proxy" => Ok(BackendMode::Proxy),
        other => Err(format!(
            "Unsupported ASSISTANT_BACKEND_MODE '{other}'. Expected 'mock', 'llm-proxy', 'openai', or 'proxy'."
        )),
    }
}

fn parse_u16(key: &str, default: u16) -> Result<u16, String> {
    env::var(key)
        .ok()
        .filter(|value| !value.is_empty())
        .map(|value| {
            value
                .parse::<u16>()
                .map_err(|error| format!("Failed to parse {key} as u16: {error}"))
        })
        .unwrap_or(Ok(default))
}

fn parse_u64(key: &str, default: u64) -> Result<u64, String> {
    env::var(key)
        .ok()
        .filter(|value| !value.is_empty())
        .map(|value| {
            value
                .parse::<u64>()
                .map_err(|error| format!("Failed to parse {key} as u64: {error}"))
        })
        .unwrap_or(Ok(default))
}

fn parse_usize(key: &str, default: usize) -> Result<usize, String> {
    env::var(key)
        .ok()
        .filter(|value| !value.is_empty())
        .map(|value| {
            value
                .parse::<usize>()
                .map_err(|error| format!("Failed to parse {key} as usize: {error}"))
        })
        .unwrap_or(Ok(default))
}

#[cfg(test)]
mod tests {
    use super::{
        build_default_llm_system_prompt, parse_backend_mode, BackendMode, Config,
        DEFAULT_ASSISTANT_NAME,
    };

    fn base_config(backend_mode: BackendMode) -> Config {
        Config {
            port: 5020,
            backend_mode,
            request_timeout: std::time::Duration::from_secs(30),
            tts_stream_soft_limit_chars: 220,
            cors_allow_origin: "*".to_string(),
            default_language: "de".to_string(),
            default_voice_instruction:
                "Ruhige, warme deutsche Stimme. Sprich klar, freundlich und eher knapp.".to_string(),
            llm_base_url: Some("https://api.openai.com/v1".to_string()),
            llm_api_key: Some("test-key".to_string()),
            llm_model: Some("gpt-4o-mini".to_string()),
            llm_system_prompt: "System".to_string(),
            stt_url: Some("http://stt.example.test".to_string()),
            stt_model: Some("gpt-4o-mini-transcribe".to_string()),
            tts_url: Some("http://tts.example.test".to_string()),
            tts_model: Some("gpt-4o-mini-tts".to_string()),
            tts_voice: "alloy".to_string(),
        }
    }

    #[test]
    fn parse_backend_mode_accepts_llm_proxy() {
        assert_eq!(
            parse_backend_mode(Some("llm-proxy".to_string())),
            Ok(BackendMode::LlmProxy)
        );
    }

    #[test]
    fn parse_backend_mode_accepts_openai() {
        assert_eq!(
            parse_backend_mode(Some("openai".to_string())),
            Ok(BackendMode::OpenAi)
        );
    }

    #[test]
    fn llm_proxy_requires_only_llm_settings() {
        let mut config = base_config(BackendMode::LlmProxy);
        config.stt_url = None;
        config.tts_url = None;

        assert!(config.validate().is_ok());
    }

    #[test]
    fn llm_proxy_requires_llm_base_url() {
        let mut config = base_config(BackendMode::LlmProxy);
        config.llm_base_url = None;

        assert_eq!(
            config.validate(),
            Err("LLM_BASE_URL is required when ASSISTANT_BACKEND_MODE=llm-proxy".to_string())
        );
    }

    #[test]
    fn proxy_still_requires_stt_and_tts() {
        let mut config = base_config(BackendMode::Proxy);
        config.stt_url = None;

        assert_eq!(
            config.validate(),
            Err("STT_URL is required when ASSISTANT_BACKEND_MODE=proxy".to_string())
        );

        config.stt_url = Some("http://stt.example.test".to_string());
        config.tts_url = None;

        assert_eq!(
            config.validate(),
            Err("TTS_URL is required when ASSISTANT_BACKEND_MODE=proxy".to_string())
        );
    }

    #[test]
    fn openai_requires_api_key() {
        let mut config = base_config(BackendMode::OpenAi);
        config.llm_api_key = None;

        assert_eq!(
            config.validate(),
            Err("LLM_API_KEY is required when ASSISTANT_BACKEND_MODE=openai".to_string())
        );
    }

    #[test]
    fn openai_requires_stt_and_tts_models() {
        let mut config = base_config(BackendMode::OpenAi);
        config.stt_model = None;

        assert_eq!(
            config.validate(),
            Err("STT_MODEL is required when ASSISTANT_BACKEND_MODE=openai".to_string())
        );

        config.stt_model = Some("gpt-4o-mini-transcribe".to_string());
        config.tts_model = None;

        assert_eq!(
            config.validate(),
            Err("TTS_MODEL is required when ASSISTANT_BACKEND_MODE=openai".to_string())
        );
    }

    #[test]
    fn default_llm_system_prompt_uses_jarvis_by_default() {
        assert_eq!(
            build_default_llm_system_prompt(DEFAULT_ASSISTANT_NAME),
            "Du bist Jarvis, ein deutscher Sprachassistent in Central. Antworte hilfreich, ruhig und eher knapp."
        );
    }

    #[test]
    fn default_llm_system_prompt_supports_custom_assistant_names() {
        assert_eq!(
            build_default_llm_system_prompt("Al"),
            "Du bist Al, ein deutscher Sprachassistent in Central. Antworte hilfreich, ruhig und eher knapp."
        );
    }

    #[test]
    fn rejects_zero_tts_stream_soft_limit_chars() {
        let mut config = base_config(BackendMode::Proxy);
        config.tts_stream_soft_limit_chars = 0;

        assert_eq!(
            config.validate(),
            Err("TTS_STREAM_SOFT_LIMIT_CHARS must be greater than 0".to_string())
        );
    }
}
