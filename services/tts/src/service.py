import base64
import io
import json
import logging
import os
import subprocess
import sys
import threading
import wave
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

LOGGER = logging.getLogger("tts_service")
JSON_CONTENT_TYPE = "application/json; charset=utf-8"
VOICE_DOWNLOAD_LOCK = threading.Lock()
READY_VOICES: set[str] = set()
VOICE_LOAD_LOCK = threading.Lock()
LOADED_VOICES: dict[tuple[str, bool], "PiperRuntime"] = {}


@dataclass(frozen=True)
class Config:
    port: int
    executable: str
    model: str
    speaker: str | None
    data_dir: str | None
    download_dir: str | None
    sentence_silence: float
    use_cuda: bool
    volume: float
    normalize_audio: bool


@dataclass
class PiperRuntime:
    voice: Any
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


def parse_float_env(name: str, default: float) -> float:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    return float(value)


def load_config() -> Config:
    return Config(
        port=parse_int_env("TTS_PORT", 8082),
        executable=os.getenv("TTS_EXECUTABLE", "piper").strip() or "piper",
        model=os.getenv("TTS_MODEL", "de_DE-thorsten-medium").strip()
        or "de_DE-thorsten-medium",
        speaker=os.getenv("TTS_SPEAKER", "").strip() or None,
        data_dir=os.getenv("TTS_DATA_DIR", "").strip() or None,
        download_dir=os.getenv("TTS_DOWNLOAD_DIR", "").strip() or None,
        sentence_silence=parse_float_env("TTS_SENTENCE_SILENCE", 0.0),
        use_cuda=parse_bool_env("TTS_USE_CUDA", False),
        volume=parse_float_env("TTS_VOLUME", 1.0),
        normalize_audio=parse_bool_env("TTS_NORMALIZE_AUDIO", True),
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


def is_local_model_reference(model: str) -> bool:
    return model.endswith(".onnx") or "/" in model or "\\" in model


def resolve_download_dir(config: Config) -> Path:
    download_dir = config.download_dir or config.data_dir or "."
    return Path(download_dir)


def resolve_model_path(config: Config) -> Path:
    if is_local_model_reference(config.model):
        return Path(config.model)

    return resolve_download_dir(config) / f"{config.model}.onnx"


def build_piper_download_command(config: Config) -> list[str]:
    download_dir = resolve_download_dir(config)

    return [
        sys.executable,
        "-m",
        "piper.download_voices",
        "--download-dir",
        str(download_dir),
        config.model,
    ]


def ensure_piper_voice_available(config: Config) -> None:
    if is_local_model_reference(config.model):
        return

    with VOICE_DOWNLOAD_LOCK:
        if config.model in READY_VOICES:
            return

        if config.data_dir is not None:
            Path(config.data_dir).mkdir(parents=True, exist_ok=True)
        if config.download_dir is not None:
            Path(config.download_dir).mkdir(parents=True, exist_ok=True)

        command = build_piper_download_command(config)
        completed = subprocess.run(
            command,
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode != 0:
            stderr = completed.stderr.strip() or completed.stdout.strip()
            raise RuntimeError(f"Piper voice download failed with exit code {completed.returncode}: {stderr}")

        READY_VOICES.add(config.model)


def parse_speaker_id(speaker: str | None) -> int | None:
    if speaker is None:
        return None

    return int(speaker)


def build_silence_bytes(
    sample_rate: int,
    sample_width: int,
    sample_channels: int,
    sentence_silence: float,
) -> bytes:
    if sentence_silence <= 0:
        return b""

    frame_count = max(0, round(sample_rate * sentence_silence))
    return b"\x00" * frame_count * sample_width * sample_channels


def _load_piper_voice(config: Config, model_path: Path) -> Any:
    from piper import PiperVoice

    LOGGER.info(
        "Loading Piper voice model_path=%s use_cuda=%s",
        model_path,
        config.use_cuda,
    )
    return PiperVoice.load(
        model_path,
        use_cuda=config.use_cuda,
        download_dir=resolve_download_dir(config),
    )


def get_piper_runtime(config: Config) -> PiperRuntime:
    ensure_piper_voice_available(config)
    model_path = resolve_model_path(config).resolve()
    cache_key = (str(model_path), config.use_cuda)

    with VOICE_LOAD_LOCK:
        runtime = LOADED_VOICES.get(cache_key)
        if runtime is None:
            runtime = PiperRuntime(
                voice=_load_piper_voice(config, model_path),
                synthesize_lock=threading.Lock(),
            )
            LOADED_VOICES[cache_key] = runtime

    return runtime


def build_synthesis_config(config: Config) -> Any:
    from piper.config import SynthesisConfig

    return SynthesisConfig(
        speaker_id=parse_speaker_id(config.speaker),
        normalize_audio=config.normalize_audio,
        volume=config.volume,
    )


def write_piper_wav(
    voice: Any,
    text: str,
    syn_config: Any,
    wav_file: wave.Wave_write,
    sentence_silence: float,
) -> None:
    first_chunk = True
    previous_chunk = None

    for audio_chunk in voice.synthesize(text, syn_config=syn_config):
        if first_chunk:
            wav_file.setframerate(audio_chunk.sample_rate)
            wav_file.setsampwidth(audio_chunk.sample_width)
            wav_file.setnchannels(audio_chunk.sample_channels)
            first_chunk = False

        if previous_chunk is not None and sentence_silence > 0:
            wav_file.writeframes(
                build_silence_bytes(
                    previous_chunk.sample_rate,
                    previous_chunk.sample_width,
                    previous_chunk.sample_channels,
                    sentence_silence,
                )
            )

        wav_file.writeframes(audio_chunk.audio_int16_bytes)
        previous_chunk = audio_chunk

    if first_chunk:
        wav_file.setframerate(voice.config.sample_rate)
        wav_file.setsampwidth(2)
        wav_file.setnchannels(1)


def synthesize_with_piper(config: Config, text: str, voice_instruction: str) -> bytes:
    if voice_instruction:
        LOGGER.info("Ignoring Piper voiceInstruction hint: %s", voice_instruction)

    runtime = get_piper_runtime(config)
    syn_config = build_synthesis_config(config)

    with runtime.synthesize_lock:
        wav_bytes = io.BytesIO()
        with wave.open(wav_bytes, "wb") as wav_file:
            write_piper_wav(
                runtime.voice,
                text,
                syn_config,
                wav_file,
                config.sentence_silence,
            )

        return wav_bytes.getvalue()


def json_bytes(payload: dict) -> bytes:
    return json.dumps(payload).encode("utf-8")


def should_log_request(method: str, path: str) -> bool:
    return not (method == "GET" and path == "/healthz")


class Handler(BaseHTTPRequestHandler):
    config: Config

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
                "speaker": self.config.speaker,
                "sentenceSilence": self.config.sentence_silence,
                "useCuda": self.config.use_cuda,
                "volume": self.config.volume,
                "normalizeAudio": self.config.normalize_audio,
            },
        )

    def do_POST(self) -> None:
        if self.path != "/synthesize":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            text, _language, voice_instruction = parse_synthesis_request(body)
            audio_bytes = synthesize_with_piper(self.config, text, voice_instruction)
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

    server = ThreadingHTTPServer(("0.0.0.0", config.port), Handler)
    LOGGER.info(
        "Starting TTS service on port=%s model=%s executable=%s",
        config.port,
        config.model,
        config.executable,
    )
    server.serve_forever()


if __name__ == "__main__":
    run()
