import base64
import json
import logging
import os
import tempfile
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock

LOGGER = logging.getLogger("voice_local_stt")
JSON_CONTENT_TYPE = "application/json; charset=utf-8"


@dataclass(frozen=True)
class Config:
    port: int
    model: str
    device: str
    compute_type: str
    beam_size: int
    vad_filter: bool


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


def load_config() -> Config:
    return Config(
        port=parse_int_env("VOICE_LOCAL_STT_PORT", 8081),
        model=os.getenv("VOICE_LOCAL_STT_MODEL", "small").strip() or "small",
        device=os.getenv("VOICE_LOCAL_STT_DEVICE", "cpu").strip() or "cpu",
        compute_type=os.getenv("VOICE_LOCAL_STT_COMPUTE_TYPE", "int8").strip() or "int8",
        beam_size=parse_int_env("VOICE_LOCAL_STT_BEAM_SIZE", 5),
        vad_filter=parse_bool_env("VOICE_LOCAL_STT_VAD_FILTER", True),
    )


def file_suffix_for_audio_mime_type(audio_mime_type: str) -> str:
    return {
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a",
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
    }.get(audio_mime_type, ".bin")


def decode_audio_base64(audio_base64: str) -> bytes:
    try:
        return base64.b64decode(audio_base64, validate=True)
    except Exception as error:
        raise ValueError(f"Invalid audioBase64 payload: {error}") from error


def parse_transcription_request(body: bytes) -> tuple[bytes, str, str]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON request body: {error}") from error

    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")

    audio_base64 = payload.get("audioBase64")
    audio_mime_type = payload.get("audioMimeType")
    language = payload.get("language")

    if not isinstance(audio_base64, str) or not audio_base64:
        raise ValueError("audioBase64 must be a non-empty string.")
    if not isinstance(audio_mime_type, str) or not audio_mime_type:
        raise ValueError("audioMimeType must be a non-empty string.")
    if not isinstance(language, str) or not language:
        raise ValueError("language must be a non-empty string.")

    return decode_audio_base64(audio_base64), audio_mime_type, language


class FasterWhisperTranscriber:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._model = None
        self._lock = Lock()

    def _get_model(self):
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from faster_whisper import WhisperModel

                    LOGGER.info(
                        "Loading faster-whisper model '%s' on device=%s compute_type=%s",
                        self._config.model,
                        self._config.device,
                        self._config.compute_type,
                    )
                    self._model = WhisperModel(
                        self._config.model,
                        device=self._config.device,
                        compute_type=self._config.compute_type,
                    )
        return self._model

    def transcribe(self, audio_bytes: bytes, audio_mime_type: str, language: str) -> str:
        suffix = file_suffix_for_audio_mime_type(audio_mime_type)
        temp_path = None

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as audio_file:
                audio_file.write(audio_bytes)
                temp_path = Path(audio_file.name)

            model = self._get_model()
            segments, _ = model.transcribe(
                str(temp_path),
                beam_size=self._config.beam_size,
                language=language,
                vad_filter=self._config.vad_filter,
                condition_on_previous_text=False,
            )
            text = " ".join(segment.text.strip() for segment in segments if segment.text).strip()
            if not text:
                raise RuntimeError("faster-whisper returned an empty transcript.")
            return text
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)


def json_bytes(payload: dict) -> bytes:
    return json.dumps(payload).encode("utf-8")


def should_log_request(method: str, path: str) -> bool:
    return not (method == "GET" and path == "/healthz")


class Handler(BaseHTTPRequestHandler):
    config: Config
    transcriber: FasterWhisperTranscriber

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
                "device": self.config.device,
                "computeType": self.config.compute_type,
            },
        )

    def do_POST(self) -> None:
        if self.path != "/transcribe":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            audio_bytes, audio_mime_type, language = parse_transcription_request(body)
            transcript = self.transcriber.transcribe(audio_bytes, audio_mime_type, language)
        except ValueError as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": {"message": str(error)}})
            return
        except Exception as error:
            LOGGER.exception("STT request failed")
            self._send_json(HTTPStatus.BAD_GATEWAY, {"error": {"message": str(error)}})
            return

        self._send_json(HTTPStatus.OK, {"text": transcript})

    def _send_json(self, status: HTTPStatus, payload: dict) -> None:
        response_bytes = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", JSON_CONTENT_TYPE)
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)


def run() -> None:
    logging.basicConfig(
        level=os.getenv("VOICE_LOCAL_STT_LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    config = load_config()
    Handler.config = config
    Handler.transcriber = FasterWhisperTranscriber(config)

    server = ThreadingHTTPServer(("0.0.0.0", config.port), Handler)
    LOGGER.info(
        "Starting local STT service on port=%s model=%s device=%s compute_type=%s",
        config.port,
        config.model,
        config.device,
        config.compute_type,
    )
    server.serve_forever()


if __name__ == "__main__":
    run()
