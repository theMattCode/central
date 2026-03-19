import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOGGER = logging.getLogger("voice_local_llm")
JSON_CONTENT_TYPE = "application/json; charset=utf-8"
MODEL_PULL_LOCK = threading.Lock()
READY_MODELS: set[str] = set()


@dataclass(frozen=True)
class Config:
    port: int
    ollama_url: str
    request_timeout_seconds: int
    default_model: str | None


def parse_int_env(name: str, default: int) -> int:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    return int(value)


def load_config() -> Config:
    return Config(
        port=parse_int_env("VOICE_LOCAL_LLM_PORT", 8083),
        ollama_url=os.getenv("VOICE_LOCAL_LLM_OLLAMA_URL", "http://service-voice-local-llm-runtime:11434")
        .strip()
        .rstrip("/"),
        request_timeout_seconds=parse_int_env("VOICE_LOCAL_LLM_REQUEST_TIMEOUT_SECONDS", 120),
        default_model=os.getenv("VOICE_LOCAL_LLM_DEFAULT_MODEL", "").strip() or None,
    )


def should_log_request(method: str, path: str) -> bool:
    return not (method == "GET" and path == "/healthz")


def extract_message_text(content: object) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            text = item.get("text")
            if isinstance(text, str):
                text_parts.append(text)

        return "".join(text_parts)

    return ""


def parse_chat_completion_request(
    body: bytes, default_model: str | None
) -> tuple[str, list[dict[str, str]], float, bool]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON request body: {error}") from error

    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")

    model = payload.get("model")
    if model is None or (isinstance(model, str) and not model.strip()):
        model = default_model
    if not isinstance(model, str) or not model.strip():
        raise ValueError("model must be a non-empty string.")

    raw_messages = payload.get("messages")
    if not isinstance(raw_messages, list) or not raw_messages:
        raise ValueError("messages must be a non-empty array.")

    messages: list[dict[str, str]] = []
    for raw_message in raw_messages:
        if not isinstance(raw_message, dict):
            raise ValueError("messages entries must be objects.")

        role = raw_message.get("role")
        content = extract_message_text(raw_message.get("content"))

        if role not in {"system", "user", "assistant"}:
            raise ValueError("message role must be one of: system, user, assistant.")
        if not content.strip():
            raise ValueError("message content must contain text.")

        messages.append({"role": role, "content": content.strip()})

    temperature = payload.get("temperature", 1.0)
    if not isinstance(temperature, (int, float)):
        raise ValueError("temperature must be a number.")

    stream = payload.get("stream", False)
    if not isinstance(stream, bool):
        raise ValueError("stream must be a boolean.")

    return model.strip(), messages, float(temperature), stream


def build_ollama_chat_request(
    model: str, messages: list[dict[str, str]], temperature: float, stream: bool
) -> dict[str, object]:
    return {
        "model": model,
        "messages": messages,
        "stream": stream,
        "options": {"temperature": temperature},
    }


def build_openai_chat_response(model: str, content: str) -> dict[str, object]:
    return {
        "id": f"chatcmpl-local-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                },
                "finish_reason": "stop",
            }
        ],
    }


def build_openai_chat_stream_chunk(
    model: str, content: str, finish_reason: str | None = None
) -> dict[str, object]:
    delta: dict[str, object] = {}
    if content:
        delta["content"] = content

    return {
        "id": f"chatcmpl-local-{int(time.time())}",
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "delta": delta,
                "finish_reason": finish_reason,
            }
        ],
    }


def json_bytes(payload: dict[str, object]) -> bytes:
    return json.dumps(payload).encode("utf-8")


def post_json(url: str, payload: dict[str, object], timeout_seconds: int) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        data=json_bytes(payload),
        headers={"Content-Type": JSON_CONTENT_TYPE},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Upstream returned {error.code}: {body}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Upstream request failed: {error.reason}") from error


def iter_json_lines(
    url: str, payload: dict[str, object], timeout_seconds: int
):  # pragma: no cover - exercised through the streaming endpoint
    request = urllib.request.Request(
        url,
        data=json_bytes(payload),
        headers={"Content-Type": JSON_CONTENT_TYPE},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8").strip()
                if not line:
                    continue
                yield json.loads(line)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Upstream returned {error.code}: {body}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Upstream request failed: {error.reason}") from error


def ensure_model_available(config: Config, model: str) -> None:
    with MODEL_PULL_LOCK:
        if model in READY_MODELS:
            return

        LOGGER.info("Pulling local Ollama model '%s' if needed", model)
        post_json(
            f"{config.ollama_url}/api/pull",
            {"model": model, "stream": False},
            config.request_timeout_seconds,
        )
        READY_MODELS.add(model)


def run_chat_completion(
    config: Config, model: str, messages: list[dict[str, str]], temperature: float
) -> str:
    ensure_model_available(config, model)

    payload = post_json(
        f"{config.ollama_url}/api/chat",
        build_ollama_chat_request(model, messages, temperature, False),
        config.request_timeout_seconds,
    )

    message = payload.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("Ollama response did not contain a message object.")

    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Ollama response did not contain assistant text.")

    return content.strip()


def run_chat_completion_stream(
    config: Config, model: str, messages: list[dict[str, str]], temperature: float
):
    ensure_model_available(config, model)

    for payload in iter_json_lines(
        f"{config.ollama_url}/api/chat",
        build_ollama_chat_request(model, messages, temperature, True),
        config.request_timeout_seconds,
    ):
        message = payload.get("message")
        if not isinstance(message, dict):
            continue

        content = message.get("content")
        if isinstance(content, str) and content:
            yield content


def sse_data_bytes(payload: str | dict[str, object]) -> bytes:
    data = payload if isinstance(payload, str) else json.dumps(payload)
    return f"data: {data}\n\n".encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    config: Config
    protocol_version = "HTTP/1.1"

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
                "ollamaUrl": self.config.ollama_url,
                "defaultModel": self.config.default_model,
            },
        )

    def do_POST(self) -> None:
        if self.path != "/chat/completions":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            model, messages, temperature, stream = parse_chat_completion_request(
                body, self.config.default_model
            )
        except ValueError as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": {"message": str(error)}})
            return

        if stream:
            try:
                delta_stream = run_chat_completion_stream(
                    self.config, model, messages, temperature
                )
                first_delta = next(delta_stream, None)
            except Exception as error:
                LOGGER.exception("Streaming LLM request failed")
                self._send_json(HTTPStatus.BAD_GATEWAY, {"error": {"message": str(error)}})
                return

            try:
                self._send_event_stream_headers()

                if first_delta is not None:
                    self._write_sse_payload(
                        build_openai_chat_stream_chunk(model, first_delta)
                    )

                for delta in delta_stream:
                    self._write_sse_payload(build_openai_chat_stream_chunk(model, delta))

                self._write_sse_payload(
                    build_openai_chat_stream_chunk(model, "", "stop")
                )
                self._write_sse_payload("[DONE]")
            except (BrokenPipeError, ConnectionResetError):
                return
            except Exception:
                LOGGER.exception("Streaming LLM response failed")
            return

        try:
            content = run_chat_completion(self.config, model, messages, temperature)
        except Exception as error:
            LOGGER.exception("LLM request failed")
            self._send_json(HTTPStatus.BAD_GATEWAY, {"error": {"message": str(error)}})
            return

        self._send_json(HTTPStatus.OK, build_openai_chat_response(model, content))

    def _send_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        response_bytes = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", JSON_CONTENT_TYPE)
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def _send_event_stream_headers(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

    def _write_sse_payload(self, payload: str | dict[str, object]) -> None:
        self.wfile.write(sse_data_bytes(payload))
        self.wfile.flush()


def run() -> None:
    logging.basicConfig(
        level=os.getenv("VOICE_LOCAL_LLM_LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    config = load_config()
    Handler.config = config

    server = ThreadingHTTPServer(("0.0.0.0", config.port), Handler)
    LOGGER.info(
        "Starting local LLM service on port=%s ollama_url=%s default_model=%s",
        config.port,
        config.ollama_url,
        config.default_model,
    )
    server.serve_forever()


if __name__ == "__main__":
    run()
