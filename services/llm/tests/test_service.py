import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from service import (
    build_ollama_chat_request,
    build_openai_chat_response,
    build_openai_chat_stream_chunk,
    parse_chat_completion_request,
    sse_data_bytes,
    should_log_request,
)


class ParseChatCompletionRequestTest(unittest.TestCase):
    def test_parses_valid_request(self) -> None:
        model, messages, temperature, stream = parse_chat_completion_request(
            (
                b'{"model":"qwen2.5:3b","messages":['
                b'{"role":"system","content":"Sprich knapp."},'
                b'{"role":"user","content":"Hallo"}],"temperature":0.3}'
            ),
            default_model=None,
        )

        self.assertEqual(model, "qwen2.5:3b")
        self.assertEqual(
            messages,
            [
                {"role": "system", "content": "Sprich knapp."},
                {"role": "user", "content": "Hallo"},
            ],
        )
        self.assertEqual(temperature, 0.3)
        self.assertFalse(stream)

    def test_uses_default_model_when_request_omits_it(self) -> None:
        model, messages, temperature, stream = parse_chat_completion_request(
            b'{"messages":[{"role":"user","content":"Hallo"}]}',
            default_model="qwen2.5:3b",
        )

        self.assertEqual(model, "qwen2.5:3b")
        self.assertEqual(messages, [{"role": "user", "content": "Hallo"}])
        self.assertEqual(temperature, 1.0)
        self.assertFalse(stream)

    def test_accepts_openai_style_content_parts(self) -> None:
        model, messages, _temperature, stream = parse_chat_completion_request(
            (
                b'{"model":"qwen2.5:3b","stream":true,"messages":['
                b'{"role":"user","content":[{"type":"text","text":"Hallo "},{"type":"text","text":"Welt"}]}]}'
            ),
            default_model=None,
        )

        self.assertEqual(model, "qwen2.5:3b")
        self.assertEqual(messages, [{"role": "user", "content": "Hallo Welt"}])
        self.assertTrue(stream)

    def test_rejects_missing_messages(self) -> None:
        with self.assertRaisesRegex(ValueError, "messages must be a non-empty array"):
            parse_chat_completion_request(b'{"model":"qwen2.5:3b"}', default_model=None)

    def test_builds_ollama_chat_request(self) -> None:
        payload = build_ollama_chat_request(
            "qwen2.5:3b",
            [{"role": "user", "content": "Hallo"}],
            0.7,
            True,
        )

        self.assertEqual(
            payload,
            {
                "model": "qwen2.5:3b",
                "messages": [{"role": "user", "content": "Hallo"}],
                "stream": True,
                "options": {"temperature": 0.7},
            },
        )

    def test_builds_openai_chat_response(self) -> None:
        payload = build_openai_chat_response("qwen2.5:3b", "Hallo zurueck")

        self.assertEqual(payload["object"], "chat.completion")
        self.assertEqual(payload["model"], "qwen2.5:3b")
        self.assertEqual(payload["choices"][0]["message"]["content"], "Hallo zurueck")

    def test_builds_openai_chat_stream_chunk(self) -> None:
        payload = build_openai_chat_stream_chunk("qwen2.5:3b", "Hallo", "stop")

        self.assertEqual(payload["object"], "chat.completion.chunk")
        self.assertEqual(payload["choices"][0]["delta"]["content"], "Hallo")
        self.assertEqual(payload["choices"][0]["finish_reason"], "stop")

    def test_serializes_sse_payload(self) -> None:
        payload = sse_data_bytes({"hello": "world"}).decode("utf-8")

        self.assertEqual(payload, 'data: {"hello": "world"}\n\n')

    def test_suppresses_healthcheck_request_logging(self) -> None:
        self.assertFalse(should_log_request("GET", "/healthz"))
        self.assertTrue(should_log_request("POST", "/chat/completions"))


if __name__ == "__main__":
    unittest.main()
