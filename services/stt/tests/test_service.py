import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from service import (
    decode_audio_base64,
    file_suffix_for_audio_mime_type,
    parse_transcription_request,
    should_log_request,
)


class ParseTranscriptionRequestTest(unittest.TestCase):
    def test_parses_valid_request(self) -> None:
        audio_bytes, audio_mime_type, language = parse_transcription_request(
            b'{"audioBase64":"AA==","audioMimeType":"audio/wav","language":"de"}'
        )

        self.assertEqual(audio_bytes, b"\x00")
        self.assertEqual(audio_mime_type, "audio/wav")
        self.assertEqual(language, "de")

    def test_rejects_invalid_base64(self) -> None:
        with self.assertRaisesRegex(ValueError, "Invalid audioBase64 payload"):
            decode_audio_base64("%%%")

    def test_rejects_non_object_payload(self) -> None:
        with self.assertRaisesRegex(ValueError, "JSON object"):
            parse_transcription_request(b"[]")

    def test_maps_audio_suffix(self) -> None:
        self.assertEqual(file_suffix_for_audio_mime_type("audio/webm"), ".webm")
        self.assertEqual(file_suffix_for_audio_mime_type("application/octet-stream"), ".bin")

    def test_suppresses_healthcheck_request_logging(self) -> None:
        self.assertFalse(should_log_request("GET", "/healthz"))
        self.assertTrue(should_log_request("POST", "/transcribe"))


if __name__ == "__main__":
    unittest.main()
