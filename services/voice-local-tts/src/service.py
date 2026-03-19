import base64
import json
import logging
import os
import subprocess
import sys
import tempfile
import threading
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LOGGER = logging.getLogger("voice_local_tts")
JSON_CONTENT_TYPE = "application/json; charset=utf-8"
VOICE_DOWNLOAD_LOCK = threading.Lock()
READY_VOICES: set[str] = set()


@dataclass(frozen=True)
class Config:
    port: int
    executable: str
    model: str
    speaker: str | None
    data_dir: str | None
    download_dir: str | None
    use_cuda: bool


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
        port=parse_int_env("VOICE_LOCAL_TTS_PORT", 8082),
        executable=os.getenv("VOICE_LOCAL_TTS_EXECUTABLE", "piper").strip() or "piper",
        model=os.getenv("VOICE_LOCAL_TTS_MODEL", "de_DE-thorsten-medium").strip()
        or "de_DE-thorsten-medium",
        speaker=os.getenv("VOICE_LOCAL_TTS_SPEAKER", "").strip() or None,
        data_dir=os.getenv("VOICE_LOCAL_TTS_DATA_DIR", "").strip() or None,
        download_dir=os.getenv("VOICE_LOCAL_TTS_DOWNLOAD_DIR", "").strip() or None,
        use_cuda=parse_bool_env("VOICE_LOCAL_TTS_USE_CUDA", False),
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


def build_piper_command(config: Config, output_path: Path) -> list[str]:
    command = [
        config.executable,
        "--model",
        config.model,
        "--output_file",
        str(output_path),
    ]

    if config.speaker is not None:
        command.extend(["--speaker", config.speaker])
    if config.data_dir is not None:
        command.extend(["--data-dir", config.data_dir])
    if config.use_cuda:
        command.append("--cuda")

    return command


def is_local_model_reference(model: str) -> bool:
    return model.endswith(".onnx") or "/" in model or "\\" in model


def build_piper_download_command(config: Config) -> list[str]:
    download_dir = config.download_dir or config.data_dir or "."

    return [
        sys.executable,
        "-m",
        "piper.download_voices",
        "--download-dir",
        download_dir,
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


def synthesize_with_piper(config: Config, text: str, voice_instruction: str) -> bytes:
    if voice_instruction:
        LOGGER.info("Ignoring Piper voiceInstruction hint: %s", voice_instruction)

    output_path = None
    try:
        ensure_piper_voice_available(config)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as output_file:
            output_path = Path(output_file.name)

        command = build_piper_command(config, output_path)
        completed = subprocess.run(
            command,
            input=text,
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode != 0:
            stderr = completed.stderr.strip() or completed.stdout.strip()
            raise RuntimeError(f"Piper synthesis failed with exit code {completed.returncode}: {stderr}")

        return output_path.read_bytes()
    finally:
        if output_path is not None:
            output_path.unlink(missing_ok=True)


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
                "useCuda": self.config.use_cuda,
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
        level=os.getenv("VOICE_LOCAL_TTS_LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    config = load_config()
    Handler.config = config

    server = ThreadingHTTPServer(("0.0.0.0", config.port), Handler)
    LOGGER.info(
        "Starting local TTS service on port=%s model=%s executable=%s",
        config.port,
        config.model,
        config.executable,
    )
    server.serve_forever()


if __name__ == "__main__":
    run()
