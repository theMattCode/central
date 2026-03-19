import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
COMPOSE_ARGS = [
    "docker",
    "compose",
    "--env-file",
    "i12e/orchestrator/.env.dev",
    "--file",
    "i12e/orchestrator/docker-compose.yml",
]


def build_container_script(sample_text: str, language: str) -> str:
    return f"""
import json
import urllib.request

sample = {sample_text!r}
language = {language!r}

synthesize_payload = json.dumps({{
    "text": sample,
    "language": language,
    "voiceInstruction": "Ruhige, warme deutsche Stimme."
}}).encode()

synthesize_request = urllib.request.Request(
    "http://127.0.0.1:8082/synthesize",
    data=synthesize_payload,
    headers={{"Content-Type": "application/json"}},
)
synthesize_response = json.loads(
    urllib.request.urlopen(synthesize_request, timeout=300).read().decode()
)

turn_payload = json.dumps({{
    "audioBase64": synthesize_response["audioBase64"],
    "audioMimeType": synthesize_response["audioMimeType"],
    "language": language,
}}).encode()
turn_request = urllib.request.Request(
    "http://service-voice:8080/api/v1/voice/turn",
    data=turn_payload,
    headers={{"Content-Type": "application/json"}},
)
turn_response = json.loads(
    urllib.request.urlopen(turn_request, timeout=900).read().decode()
)

spoken_payload = json.dumps({{
    "audioBase64": turn_response["audioBase64"],
    "audioMimeType": turn_response["audioMimeType"],
    "language": language,
}}).encode()
spoken_request = urllib.request.Request(
    "http://service-voice-local-stt:8081/transcribe",
    data=spoken_payload,
    headers={{"Content-Type": "application/json"}},
)
spoken_response = json.loads(
    urllib.request.urlopen(spoken_request, timeout=900).read().decode()
)

print(json.dumps({{
    "inputText": sample,
    "serviceTranscript": turn_response["transcript"],
    "responseText": turn_response["responseText"],
    "responseAudioMimeType": turn_response["audioMimeType"],
    "responseAudioBase64Length": len(turn_response["audioBase64"]),
    "spokenResponseTranscript": spoken_response["text"],
}}, ensure_ascii=False))
""".strip()


def run_smoke_test(sample_text: str, language: str) -> dict[str, object]:
    result = subprocess.run(
        [
            *COMPOSE_ARGS,
            "exec",
            "-T",
            "service-voice-local-tts",
            "python",
            "-",
        ],
        cwd=REPO_ROOT,
        input=build_container_script(sample_text, language),
        text=True,
        capture_output=True,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Smoke test command failed.")

    return json.loads(result.stdout)


def validate_result(payload: dict[str, object]) -> list[str]:
    errors: list[str] = []

    service_transcript = str(payload.get("serviceTranscript", "")).strip()
    response_text = str(payload.get("responseText", "")).strip()
    spoken_response_transcript = str(payload.get("spokenResponseTranscript", "")).strip()
    response_audio_mime_type = str(payload.get("responseAudioMimeType", "")).strip()
    response_audio_length = int(payload.get("responseAudioBase64Length", 0))

    if not service_transcript:
        errors.append("serviceTranscript is empty.")
    if "guten" not in service_transcript.lower():
        errors.append("serviceTranscript does not look like the expected spoken input.")
    if not response_text:
        errors.append("responseText is empty.")
    if "mock-antwort" in response_text.lower():
        errors.append("responseText still comes from the mock LLM.")
    if response_audio_mime_type != "audio/wav":
        errors.append(f"responseAudioMimeType is {response_audio_mime_type!r}, expected 'audio/wav'.")
    if response_audio_length < 1024:
        errors.append("response audio is unexpectedly small.")
    if not spoken_response_transcript:
        errors.append("spokenResponseTranscript is empty.")

    return errors


def main() -> int:
    sample_text = os.getenv(
        "SMOKE_VOICE_TEXT",
        "Guten Morgen aus dem komplett lokalen Sprachtest.",
    )
    language = os.getenv("SMOKE_VOICE_LANGUAGE", "de")

    try:
        payload = run_smoke_test(sample_text, language)
    except Exception as error:
        print(f"Smoke test failed to execute: {error}", file=sys.stderr)
        return 1

    errors = validate_result(payload)
    if errors:
        print("Smoke test failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
