import pathlib
import sys
import tempfile
import threading
import unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

import service
from service import (
    Config,
    DEFAULT_REFERENCE_AUDIO,
    DEFAULT_REFERENCE_TEXT,
    QwenRuntime,
    build_qwen_model_kwargs,
    create_qwen_runtime,
    load_config,
    normalize_qwen_language,
    parse_synthesis_request,
    should_log_request,
    synthesize_with_qwen,
)


def test_config(**overrides):
    values = {
        "port": 8082,
        "model": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "reference_audio": DEFAULT_REFERENCE_AUDIO,
        "reference_text": DEFAULT_REFERENCE_TEXT,
        "x_vector_only_mode": False,
        "device_map": "cuda:0",
        "dtype": "bfloat16",
        "attn_implementation": "flash_attention_2",
    }
    values.update(overrides)
    return Config(**values)


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

    def test_load_config_defaults_to_morgan_clone_sample(self) -> None:
        with mock.patch.dict("os.environ", {}, clear=True):
            config = load_config()

        self.assertEqual(config.model, "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
        self.assertEqual(config.reference_audio, DEFAULT_REFERENCE_AUDIO)
        self.assertEqual(config.reference_text, DEFAULT_REFERENCE_TEXT)
        self.assertFalse(config.x_vector_only_mode)
        self.assertEqual(config.device_map, "cuda:0")
        self.assertEqual(config.attn_implementation, "flash_attention_2")

    def test_load_config_disables_x_vector_only_when_reference_text_exists(self) -> None:
        with mock.patch.dict("os.environ", {"TTS_REFERENCE_TEXT": "Reference words."}, clear=True):
            config = load_config()

        self.assertEqual(config.reference_text, "Reference words.")
        self.assertFalse(config.x_vector_only_mode)

    def test_load_config_reads_reference_text_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            reference_text_file = pathlib.Path(temp_dir) / "reference.txt"
            reference_text_file.write_text("Reference words from file.\n", encoding="utf-8")

            with mock.patch.dict(
                "os.environ",
                {"TTS_REFERENCE_TEXT_FILE": str(reference_text_file)},
                clear=True,
            ):
                config = load_config()

        self.assertEqual(config.reference_text, "Reference words from file.")
        self.assertFalse(config.x_vector_only_mode)

    def test_normalizes_assistant_language_code_for_qwen(self) -> None:
        self.assertEqual(normalize_qwen_language("de"), "German")
        self.assertEqual(normalize_qwen_language("en-US"), "English")
        self.assertEqual(normalize_qwen_language("Italian"), "Italian")

    def test_requires_flash_attention_when_configured(self) -> None:
        config = test_config(dtype="default", attn_implementation="flash_attention_2")

        with mock.patch.object(
            service,
            "is_flash_attention_available",
            return_value=False,
        ):
            with self.assertRaisesRegex(RuntimeError, "flash_attn is not installed"):
                build_qwen_model_kwargs(config)

    def test_uses_flash_attention_when_flash_attn_is_available(self) -> None:
        config = test_config(dtype="default", attn_implementation="flash_attention_2")

        with mock.patch.object(
            service,
            "is_flash_attention_available",
            return_value=True,
        ):
            kwargs = build_qwen_model_kwargs(config)

        self.assertEqual(
            kwargs,
            {
                "device_map": "cuda:0",
                "attn_implementation": "flash_attention_2",
            },
        )

    def test_uses_non_flash_attention_implementation(self) -> None:
        config = test_config(dtype="default", attn_implementation="sdpa")

        kwargs = build_qwen_model_kwargs(config)

        self.assertEqual(
            kwargs,
            {
                "device_map": "cuda:0",
                "attn_implementation": "sdpa",
            },
        )

    def test_suppresses_healthcheck_request_logging(self) -> None:
        self.assertFalse(should_log_request("GET", "/healthz"))
        self.assertTrue(should_log_request("POST", "/synthesize"))

    def test_creates_voice_clone_prompt_once_at_startup(self) -> None:
        class FakeModel:
            def __init__(self) -> None:
                self.prompt_kwargs = None

            def create_voice_clone_prompt(self, **kwargs):
                self.prompt_kwargs = kwargs
                return {"prompt": "cached"}

        fake_model = FakeModel()
        with tempfile.TemporaryDirectory() as temp_dir:
            reference_audio = pathlib.Path(temp_dir) / "morgan-freeman.mp3"
            reference_audio.write_bytes(b"mp3")
            config = test_config(reference_audio=str(reference_audio))

            with mock.patch.object(service, "_load_qwen_model", return_value=fake_model):
                runtime = create_qwen_runtime(config)

        self.assertIs(runtime.model, fake_model)
        self.assertEqual(runtime.voice_clone_prompt, {"prompt": "cached"})
        self.assertEqual(
            fake_model.prompt_kwargs,
            {
                "ref_audio": str(reference_audio),
                "x_vector_only_mode": False,
                "ref_text": DEFAULT_REFERENCE_TEXT,
            },
        )

    def test_x_vector_only_prompt_omits_reference_text(self) -> None:
        class FakeModel:
            def __init__(self) -> None:
                self.prompt_kwargs = None

            def create_voice_clone_prompt(self, **kwargs):
                self.prompt_kwargs = kwargs
                return {"prompt": "cached"}

        fake_model = FakeModel()
        with tempfile.TemporaryDirectory() as temp_dir:
            reference_audio = pathlib.Path(temp_dir) / "morgan-freeman.mp3"
            reference_audio.write_bytes(b"mp3")
            config = test_config(
                reference_audio=str(reference_audio),
                x_vector_only_mode=True,
            )

            with mock.patch.object(service, "_load_qwen_model", return_value=fake_model):
                create_qwen_runtime(config)

        self.assertEqual(
            fake_model.prompt_kwargs,
            {
                "ref_audio": str(reference_audio),
                "x_vector_only_mode": True,
            },
        )

    def test_requires_reference_text_when_x_vector_only_mode_is_disabled(self) -> None:
        config = test_config(
            reference_audio=DEFAULT_REFERENCE_AUDIO,
            reference_text=None,
            x_vector_only_mode=False,
        )

        with (
            mock.patch.object(pathlib.Path, "is_file", return_value=True),
            self.assertRaisesRegex(ValueError, "TTS_REFERENCE_TEXT is required"),
        ):
            create_qwen_runtime(config)

    def test_synthesizes_with_reusable_voice_clone_prompt(self) -> None:
        class FakeModel:
            def __init__(self) -> None:
                self.generate_kwargs = None

            def generate_voice_clone(self, **kwargs):
                self.generate_kwargs = kwargs
                return [object()], 24_000

        fake_model = FakeModel()
        runtime = QwenRuntime(
            model=fake_model,
            voice_clone_prompt={"prompt": "cached"},
            synthesize_lock=threading.Lock(),
        )

        with mock.patch.object(service, "encode_wav", return_value=b"wav") as encode_wav:
            audio = synthesize_with_qwen(runtime, "Hallo Welt", "de", "Warm")

        self.assertEqual(audio, b"wav")
        self.assertEqual(
            fake_model.generate_kwargs,
            {
                "text": "Hallo Welt",
                "language": "German",
                "voice_clone_prompt": {"prompt": "cached"},
            },
        )
        encode_wav.assert_called_once_with(mock.ANY, 24_000)


if __name__ == "__main__":
    unittest.main()
