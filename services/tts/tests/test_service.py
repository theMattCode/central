import io
import pathlib
import sys
import unittest
import wave
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

import service
from service import (
    Config,
    build_piper_download_command,
    build_silence_bytes,
    get_piper_runtime,
    is_local_model_reference,
    parse_synthesis_request,
    resolve_model_path,
    should_log_request,
    write_piper_wav,
)


class ParseSynthesisRequestTest(unittest.TestCase):
    def setUp(self) -> None:
        service.LOADED_VOICES.clear()
        service.READY_VOICES.clear()

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

    def test_builds_piper_download_command(self) -> None:
        config = Config(
            port=8082,
            executable="piper",
            model="de_DE-thorsten-medium",
            speaker=None,
            data_dir="/models",
            download_dir="/downloads",
            sentence_silence=0.0,
            use_cuda=False,
            volume=1.0,
            normalize_audio=True,
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

    def test_resolves_downloaded_model_path(self) -> None:
        config = Config(
            port=8082,
            executable="piper",
            model="de_DE-thorsten-medium",
            speaker=None,
            data_dir="/models",
            download_dir="/downloads",
            sentence_silence=0.0,
            use_cuda=False,
            volume=1.0,
            normalize_audio=True,
        )

        self.assertEqual(
            resolve_model_path(config),
            pathlib.Path("/downloads/de_DE-thorsten-medium.onnx"),
        )

    def test_detects_local_model_reference(self) -> None:
        self.assertTrue(is_local_model_reference("/models/de_DE-thorsten-medium.onnx"))
        self.assertFalse(is_local_model_reference("de_DE-thorsten-medium"))

    def test_builds_silence_bytes(self) -> None:
        self.assertEqual(build_silence_bytes(4, 2, 1, 0.5), b"\x00\x00\x00\x00")

    def test_suppresses_healthcheck_request_logging(self) -> None:
        self.assertFalse(should_log_request("GET", "/healthz"))
        self.assertTrue(should_log_request("POST", "/synthesize"))

    def test_reuses_cached_piper_voice(self) -> None:
        config = Config(
            port=8082,
            executable="piper",
            model="de_DE-thorsten-medium",
            speaker=None,
            data_dir="/models",
            download_dir="/downloads",
            sentence_silence=0.0,
            use_cuda=True,
            volume=1.0,
            normalize_audio=True,
        )
        fake_voice = object()

        with (
            mock.patch.object(service, "ensure_piper_voice_available") as ensure_voice,
            mock.patch.object(service, "_load_piper_voice", return_value=fake_voice) as load_voice,
            mock.patch.object(pathlib.Path, "resolve", lambda self: self),
        ):
            runtime_one = get_piper_runtime(config)
            runtime_two = get_piper_runtime(config)

        self.assertIs(runtime_one, runtime_two)
        self.assertIs(runtime_one.voice, fake_voice)
        self.assertEqual(ensure_voice.call_count, 2)
        load_voice.assert_called_once_with(
            config,
            pathlib.Path("/downloads/de_DE-thorsten-medium.onnx"),
        )

    def test_writes_sentence_silence_between_audio_chunks(self) -> None:
        class FakeChunk:
            def __init__(self, audio_int16_bytes: bytes) -> None:
                self.sample_rate = 4
                self.sample_width = 2
                self.sample_channels = 1
                self.audio_int16_bytes = audio_int16_bytes

        class FakeVoice:
            class config:
                sample_rate = 4

            def synthesize(self, text: str, syn_config: object = None):  # noqa: ANN001
                del text, syn_config
                yield FakeChunk(b"\x01\x00\x02\x00")
                yield FakeChunk(b"\x03\x00")

        wav_bytes = io.BytesIO()
        with wave.open(wav_bytes, "wb") as wav_file:
            write_piper_wav(FakeVoice(), "Hallo. Welt.", object(), wav_file, 0.5)

        with wave.open(io.BytesIO(wav_bytes.getvalue()), "rb") as wav_file:
            self.assertEqual(wav_file.getframerate(), 4)
            self.assertEqual(wav_file.getnchannels(), 1)
            self.assertEqual(wav_file.readframes(5), b"\x01\x00\x02\x00\x00\x00\x00\x00\x03\x00")


if __name__ == "__main__":
    unittest.main()
