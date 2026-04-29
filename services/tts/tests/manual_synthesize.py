#!/usr/bin/env python3
import argparse
import base64
import json
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Call the local TTS service and write the synthesized WAV output."
    )
    parser.add_argument(
        "text",
        nargs="?",
        default="Guten Abend. Dies ist ein manueller Test der geklonten Morgan-Stimme.",
        help="Text to synthesize.",
    )
    parser.add_argument(
        "--url",
        default="http://localhost:5040/synthesize",
        help="TTS synthesize endpoint URL.",
    )
    parser.add_argument(
        "--language",
        default="de",
        help="Language code to send to the assistant TTS contract.",
    )
    parser.add_argument(
        "--voice-instruction",
        default="",
        help="Optional voiceInstruction value. Qwen voice clone currently ignores this.",
    )
    parser.add_argument(
        "--output",
        default="/tmp/qwen-tts-test.wav",
        help="Path where the decoded WAV output should be written.",
    )
    parser.add_argument(
        "--play",
        action="store_true",
        help="Open the generated WAV with the first available local player.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=600,
        help="HTTP request timeout in seconds.",
    )
    parser.add_argument(
        "--wait-timeout",
        type=float,
        default=1800,
        help="How long to wait for the TTS service to become ready.",
    )
    parser.add_argument(
        "--no-wait",
        action="store_true",
        help="Skip polling /healthz before synthesis.",
    )
    return parser.parse_args()


def health_url_for_synthesize_url(url: str) -> str:
    parsed_url = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(
        (
            parsed_url.scheme,
            parsed_url.netloc,
            "/healthz",
            "",
            "",
        )
    )


def wait_for_service(url: str, timeout: float) -> None:
    health_url = health_url_for_synthesize_url(url)
    deadline = time.monotonic() + timeout
    last_error = "not checked yet"
    next_notice = 0.0

    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(health_url, timeout=3) as response:
                if response.status == 200:
                    return
                last_error = f"HTTP {response.status}"
        except (ConnectionResetError, ConnectionRefusedError, TimeoutError, socket.timeout) as error:
            last_error = str(error)
        except urllib.error.URLError as error:
            last_error = str(error.reason)

        now = time.monotonic()
        if now >= next_notice:
            print(
                f"Waiting for TTS service at {health_url} ({last_error})...",
                file=sys.stderr,
            )
            next_notice = now + 15

        time.sleep(2)

    raise TimeoutError(
        f"TTS service did not become ready within {timeout:.0f}s. "
        "Check the container logs with: docker logs -f central-tts"
    )


def synthesize(args: argparse.Namespace) -> dict:
    payload = json.dumps(
        {
            "text": args.text,
            "language": args.language,
            "voiceInstruction": args.voice_instruction,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        args.url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"TTS service returned HTTP {error.code}: {body}") from error
    except (ConnectionResetError, ConnectionRefusedError, TimeoutError, socket.timeout) as error:
        raise RuntimeError(
            "TTS connection failed. The model may still be loading, or the service "
            "may have crashed. Check the container logs with: docker logs -f central-tts"
        ) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"TTS request failed: {error.reason}") from error


def write_audio(payload: dict, output_path: Path) -> None:
    audio_base64 = payload.get("audioBase64")
    if not isinstance(audio_base64, str) or not audio_base64:
        raise ValueError("TTS response did not include a non-empty audioBase64 value.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(base64.b64decode(audio_base64))


def play_audio(output_path: Path) -> None:
    for command in ("ffplay", "xdg-open", "open"):
        executable = shutil.which(command)
        if executable is None:
            continue

        if command == "ffplay":
            subprocess.run(
                [executable, "-nodisp", "-autoexit", str(output_path)],
                check=False,
            )
            return

        subprocess.run([executable, str(output_path)], check=False)
        return

    print("No supported audio player found. Open the WAV manually.", file=sys.stderr)


def main() -> int:
    args = parse_args()
    output_path = Path(args.output)

    try:
        if not args.no_wait:
            wait_for_service(args.url, args.wait_timeout)

        payload = synthesize(args)
        write_audio(payload, output_path)
        print(output_path)

        if args.play:
            play_audio(output_path)
    except Exception as error:
        print(f"manual_synthesize.py: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
