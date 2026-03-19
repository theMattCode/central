import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from service import (
    Config,
    build_piper_command,
    build_piper_download_command,
    is_local_model_reference,
    parse_synthesis_request,
    should_log_request,
)


class ParseSynthesisRequestTest(unittest.TestCase):
    def test_parses_valid_request(self) -> None:
        text, language, voice_instruction = parse_synthesis_request(
            b'{"text":"Hallo Welt","language":"de","voiceInstruction":"Warm"}'
        )

        self.assertEqual(text, "Hallo Welt")
        self.assertEqual(language, "de")
        self.assertEqual(voice_instruction, "Warm")

    def test_rejects_missing_text(self) -> None:
        with self.assertRaisesRegex(ValueError, "text must be a non-empty string"):
            parse_synthesis_request(b'{"text":"","language":"de","voiceInstruction":""}')

    def test_builds_piper_command(self) -> None:
        config = Config(
            port=8082,
            executable="piper",
            model="de_DE-thorsten-medium",
            speaker="2",
            data_dir="/models",
            download_dir="/downloads",
            use_cuda=True,
        )

        command = build_piper_command(config, pathlib.Path("/tmp/output.wav"))

        self.assertEqual(
            command,
            [
                "piper",
                "--model",
                "de_DE-thorsten-medium",
                "--output_file",
                "/tmp/output.wav",
                "--speaker",
                "2",
                "--data-dir",
                "/models",
                "--cuda",
            ],
        )

    def test_builds_piper_download_command(self) -> None:
        config = Config(
            port=8082,
            executable="piper",
            model="de_DE-thorsten-medium",
            speaker=None,
            data_dir="/models",
            download_dir="/downloads",
            use_cuda=False,
        )

        command = build_piper_download_command(config)

        self.assertEqual(
            command,
            [
                sys.executable,
                "-m",
                "piper.download_voices",
                "--download-dir",
                "/downloads",
                "de_DE-thorsten-medium",
            ],
        )

    def test_detects_local_model_reference(self) -> None:
        self.assertTrue(is_local_model_reference("/models/de_DE-thorsten-medium.onnx"))
        self.assertFalse(is_local_model_reference("de_DE-thorsten-medium"))

    def test_suppresses_healthcheck_request_logging(self) -> None:
        self.assertFalse(should_log_request("GET", "/healthz"))
        self.assertTrue(should_log_request("POST", "/synthesize"))


if __name__ == "__main__":
    unittest.main()
