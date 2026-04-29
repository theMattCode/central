import base64
import importlib.util
import io
import json
import logging
import os
import threading
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

LOGGER = logging.getLogger("tts_service")
JSON_CONTENT_TYPE = "application/json; charset=utf-8"
SERVICE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REFERENCE_AUDIO = "res/morgan-freeman.mp3"
DEFAULT_REFERENCE_TEXT_FILE = "res/morgan-freeman.txt"
DEFAULT_REFERENCE_TEXT = (
    SERVICE_ROOT / DEFAULT_REFERENCE_TEXT_FILE
).read_text(encoding="utf-8").strip()

SUPPORTED_QWEN_LANGUAGES = {
    "Auto",
    "Chinese",
    "English",
    "Japanese",
    "Korean",
    "German",
    "French",
    "Russian",
    "Portuguese",
    "Spanish",
    "Italian",
}

QWEN_LANGUAGE_ALIASES = {
    "auto": "Auto",
    "zh": "Chinese",
    "zh-cn": "Chinese",
    "cn": "Chinese",
    "chinese": "Chinese",
    "en": "English",
    "en-us": "English",
    "en-gb": "English",
    "english": "English",
    "ja": "Japanese",
    "jp": "Japanese",
    "japanese": "Japanese",
    "ko": "Korean",
    "kr": "Korean",
    "korean": "Korean",
    "de": "German",
    "de-de": "German",
    "german": "German",
    "deutsch": "German",
    "fr": "French",
    "fr-fr": "French",
    "french": "French",
    "ru": "Russian",
    "ru-ru": "Russian",
    "russian": "Russian",
    "pt": "Portuguese",
    "pt-br": "Portuguese",
    "pt-pt": "Portuguese",
    "portuguese": "Portuguese",
    "es": "Spanish",
    "es-es": "Spanish",
    "spanish": "Spanish",
    "it": "Italian",
    "it-it": "Italian",
    "italian": "Italian",
}


@dataclass(frozen=True)
class Config:
    port: int
    model: str
    reference_audio: str
    reference_text: str | None
    x_vector_only_mode: bool
    device_map: str
    dtype: str
    attn_implementation: str | None


@dataclass
class QwenRuntime:
    model: Any
    voice_clone_prompt: Any
    synthesize_lock: threading.Lock


def parse_int_env(name: str, default: int) -> int:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    return int(value)


def parse_bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name, "").strip().lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "on"}


def optional_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, "").strip()
    if value:
        return value
    return default


def resolve_resource_path(path: str) -> Path:
    candidate = Path(path)
    if candidate.is_absolute() or candidate.exists():
        return candidate
    return SERVICE_ROOT / candidate


def read_reference_text_file(path: str) -> str:
    return resolve_resource_path(path).read_text(encoding="utf-8").strip()


def load_config() -> Config:
    reference_audio = (
        optional_env("TTS_REFERENCE_AUDIO", DEFAULT_REFERENCE_AUDIO)
        or DEFAULT_REFERENCE_AUDIO
    )
    reference_text_file = optional_env(
        "TTS_REFERENCE_TEXT_FILE",
        DEFAULT_REFERENCE_TEXT_FILE,
    )
    reference_text_default = (
        read_reference_text_file(reference_text_file)
        if Path(reference_audio).name == Path(DEFAULT_REFERENCE_AUDIO).name
        and reference_text_file is not None
        else None
    )
    reference_text = optional_env("TTS_REFERENCE_TEXT", reference_text_default)
    return Config(
        port=parse_int_env("TTS_PORT", 8082),
        model=optional_env("TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
        or "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        reference_audio=reference_audio,
        reference_text=reference_text,
        x_vector_only_mode=parse_bool_env(
            "TTS_X_VECTOR_ONLY_MODE",
            reference_text is None,
        ),
        device_map=optional_env("TTS_DEVICE_MAP", "cuda:0") or "cuda:0",
        dtype=optional_env("TTS_DTYPE", "bfloat16") or "bfloat16",
        attn_implementation=optional_env(
            "TTS_ATTENTION_IMPLEMENTATION",
            "flash_attention_2",
        ),
    )


def parse_synthesis_request(body: bytes) -> tuple[str, str, str]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON request body: {error}") from error

    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")

    text = payload.get("text")
    language = payload.get("language")
    voice_instruction = payload.get("voiceInstruction")

    if not isinstance(text, str) or not text.strip():
        raise ValueError("text must be a non-empty string.")
    if not isinstance(language, str) or not language:
        raise ValueError("language must be a non-empty string.")
    if voice_instruction is None:
        voice_instruction = ""
    if not isinstance(voice_instruction, str):
        raise ValueError("voiceInstruction must be a string.")

    return text.strip(), language, voice_instruction


def normalize_qwen_language(language: str) -> str:
    normalized = language.strip()
    key = normalized.casefold().replace("_", "-")
    if key in QWEN_LANGUAGE_ALIASES:
        return QWEN_LANGUAGE_ALIASES[key]

    for supported_language in SUPPORTED_QWEN_LANGUAGES:
        if key == supported_language.casefold():
            return supported_language

    return normalized


def resolve_torch_dtype(dtype: str) -> Any | None:
    normalized = dtype.strip().casefold()
    if normalized in {"", "auto", "default", "none"}:
        return None

    import torch

    aliases = {
        "bf16": torch.bfloat16,
        "bfloat16": torch.bfloat16,
        "fp16": torch.float16,
        "float16": torch.float16,
        "half": torch.float16,
        "fp32": torch.float32,
        "float32": torch.float32,
    }
    if normalized in aliases:
        return aliases[normalized]

    try:
        return getattr(torch, normalized)
    except AttributeError as error:
        raise ValueError(f"Unsupported TTS_DTYPE value: {dtype}") from error


def is_flash_attention_available() -> bool:
    try:
        return importlib.util.find_spec("flash_attn") is not None
    except (ImportError, ValueError):
        return False


def resolve_attn_implementation(attn_implementation: str | None) -> str | None:
    if not attn_implementation:
        return None

    resolved = attn_implementation.strip()
    if resolved.casefold() in {"", "auto", "default", "none"}:
        return None

    if resolved.casefold() != "flash_attention_2":
        return resolved

    if is_flash_attention_available():
        return resolved

    raise RuntimeError(
        "TTS_ATTENTION_IMPLEMENTATION=flash_attention_2 was requested, but "
        "flash_attn is not installed. The TTS image must include a FlashAttention "
        "2 wheel that matches the installed Python, PyTorch, and CUDA versions."
    )


def build_qwen_model_kwargs(config: Config) -> dict[str, Any]:
    kwargs: dict[str, Any] = {"device_map": config.device_map}
    dtype = resolve_torch_dtype(config.dtype)
    if dtype is not None:
        kwargs["dtype"] = dtype
    attn_implementation = resolve_attn_implementation(config.attn_implementation)
    if attn_implementation is not None:
        kwargs["attn_implementation"] = attn_implementation
    return kwargs


def _load_qwen_model(config: Config) -> Any:
    from qwen_tts import Qwen3TTSModel

    model_kwargs = build_qwen_model_kwargs(config)
    LOGGER.info(
        "Loading Qwen3-TTS model=%s device_map=%s dtype=%s attention=%s",
        config.model,
        config.device_map,
        config.dtype,
        model_kwargs.get("attn_implementation", "default"),
    )
    return Qwen3TTSModel.from_pretrained(
        config.model,
        **model_kwargs,
    )


def create_qwen_runtime(config: Config) -> QwenRuntime:
    reference_audio_path = Path(config.reference_audio)
    if not reference_audio_path.is_file():
        raise FileNotFoundError(
            f"TTS reference audio not found: {reference_audio_path}"
        )
    if not config.reference_text and not config.x_vector_only_mode:
        raise ValueError(
            "TTS_REFERENCE_TEXT is required when TTS_X_VECTOR_ONLY_MODE is false."
        )

    model = _load_qwen_model(config)

    prompt_kwargs: dict[str, Any] = {
        "ref_audio": str(reference_audio_path),
        "x_vector_only_mode": config.x_vector_only_mode,
    }
    if config.reference_text and not config.x_vector_only_mode:
        prompt_kwargs["ref_text"] = config.reference_text

    LOGGER.info(
        "Creating reusable Qwen voice clone prompt from reference_audio=%s "
        "x_vector_only_mode=%s reference_text_configured=%s",
        reference_audio_path,
        config.x_vector_only_mode,
        config.reference_text is not None,
    )
    voice_clone_prompt = model.create_voice_clone_prompt(**prompt_kwargs)

    return QwenRuntime(
        model=model,
        voice_clone_prompt=voice_clone_prompt,
        synthesize_lock=threading.Lock(),
    )


def audio_array_for_soundfile(audio: Any) -> Any:
    if hasattr(audio, "detach"):
        return audio.detach().cpu().numpy()
    if hasattr(audio, "cpu") and hasattr(audio.cpu(), "numpy"):
        return audio.cpu().numpy()
    return audio


def encode_wav(audio: Any, sample_rate: int) -> bytes:
    import soundfile as sf

    wav_bytes = io.BytesIO()
    sf.write(
        wav_bytes,
        audio_array_for_soundfile(audio),
        sample_rate,
        format="WAV",
    )
    return wav_bytes.getvalue()


def synthesize_with_qwen(
    runtime: QwenRuntime,
    text: str,
    language: str,
    voice_instruction: str,
) -> bytes:
    if voice_instruction:
        LOGGER.info(
            "Ignoring voiceInstruction for Qwen voice clone request: %s",
            voice_instruction,
        )

    qwen_language = normalize_qwen_language(language)

    with runtime.synthesize_lock:
        wavs, sample_rate = runtime.model.generate_voice_clone(
            text=text,
            language=qwen_language,
            voice_clone_prompt=runtime.voice_clone_prompt,
        )

    if not wavs:
        raise RuntimeError("Qwen3-TTS returned no audio.")

    return encode_wav(wavs[0], sample_rate)


def json_bytes(payload: dict) -> bytes:
    return json.dumps(payload).encode("utf-8")


def should_log_request(method: str, path: str) -> bool:
    return not (method == "GET" and path == "/healthz")


class Handler(BaseHTTPRequestHandler):
    config: Config
    runtime: QwenRuntime

    def log_message(self, format: str, *args) -> None:
        if not should_log_request(getattr(self, "command", ""), self.path):
            return
        LOGGER.info("%s - %s", self.address_string(), format % args)

    def do_GET(self) -> None:
        if self.path != "/healthz":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        self._send_json(
            HTTPStatus.OK,
            {
                "status": "ok",
                "model": self.config.model,
                "referenceAudio": self.config.reference_audio,
                "referenceTextConfigured": self.config.reference_text is not None,
                "xVectorOnlyMode": self.config.x_vector_only_mode,
                "deviceMap": self.config.device_map,
                "dtype": self.config.dtype,
                "attentionImplementation": self.config.attn_implementation,
            },
        )

    def do_POST(self) -> None:
        if self.path != "/synthesize":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            text, language, voice_instruction = parse_synthesis_request(body)
            audio_bytes = synthesize_with_qwen(
                self.runtime,
                text,
                language,
                voice_instruction,
            )
        except ValueError as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": {"message": str(error)}})
            return
        except Exception as error:
            LOGGER.exception("TTS request failed")
            self._send_json(HTTPStatus.BAD_GATEWAY, {"error": {"message": str(error)}})
            return

        self._send_json(
            HTTPStatus.OK,
            {
                "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
                "audioMimeType": "audio/wav",
            },
        )

    def _send_json(self, status: HTTPStatus, payload: dict) -> None:
        response_bytes = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", JSON_CONTENT_TYPE)
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)


def run() -> None:
    logging.basicConfig(
        level=os.getenv("TTS_LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    config = load_config()
    Handler.config = config
    Handler.runtime = create_qwen_runtime(config)

    server = ThreadingHTTPServer(("0.0.0.0", config.port), Handler)
    LOGGER.info(
        "Starting Qwen3-TTS service on port=%s model=%s reference_audio=%s",
        config.port,
        config.model,
        config.reference_audio,
    )
    server.serve_forever()


if __name__ == "__main__":
    run()
