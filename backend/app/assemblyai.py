"""AssemblyAI-TTS-1 adapter: HTTP synthesis and WebSocket streaming.

https://www.assemblyai.com/docs/tts/message-frames
No retries: a repeated paid request needs a fresh, explicit playback action.
"""
import asyncio
import base64
import json
import logging
import math
import os
import re
import time
from urllib.parse import urlencode
from uuid import UUID

import httpx
from websockets.asyncio.client import connect

from .models import MAX_NARRATION_CHARACTERS
from .voice import VoiceUnavailable
from .budget import SynthesisBudget

WS_ENDPOINT = "wss://tts.us.assemblyai.com/v1/ws"
HTTP_ENDPOINT = "https://tts.us.assemblyai.com/v1/speech"
VOICES = {"aai-jane", "aai-audrey", "aai-george"}
MAX_TEXT = MAX_NARRATION_CHARACTERS  # Below Generate's 2000 and within initial pacing grace.
MAX_AUDIO = 24000 * 2 * 180
logger = logging.getLogger("hauntcast.tts")
KEY_CONFIGURATION_ERROR = (
    "AssemblyAI configuration error: ASSEMBLYAI_API_KEY is missing, empty, or a placeholder. "
    "Set a real key in the server's root .env and restart FastAPI, "
    "or explicitly set VOICE_PROVIDER=mock for local audio."
)


def is_placeholder_key(value: str | None) -> bool:
    """Reject local/example credentials; this does not verify account access."""
    if not value or not value.strip():
        return True
    value = value.strip().casefold()
    compact = re.sub(r"[^a-z0-9]", "", value)
    words = set(re.findall(r"[a-z0-9]+", value))
    return (
        not compact
        or len(set(compact)) == 1
        or value.startswith(("<", "${", "{{"))
        or compact in {"none", "null", "undefined", "unset", "notset", "todo", "apikey", "assemblyaiapikey",
                       "notarealkey", "notarealapikey", "notavalidkey", "localonly", "developmentonly"}
        or compact.startswith(("dummy", "placeholder", "your", "replace", "changeme", "insert", "paste",
                               "example", "fake", "test"))
        or compact.endswith("keyhere")
        or bool(words & {"dummy", "placeholder", "example", "fake", "test"})
    )


class AssemblyAIVoiceProvider:
    def __init__(self):
        self.key = os.getenv("ASSEMBLYAI_API_KEY", "").strip()
        self.mode = "unavailable" if is_placeholder_key(self.key) else "live"
        defaults = {"archivist": "aai-george", "skeptic": "aai-jane", "medium": "aai-audrey"}
        self.voices = {p: os.getenv("ASSEMBLYAI_VOICE_" + p.upper(), v) for p, v in defaults.items()}
        if any(v not in VOICES for v in self.voices.values()):
            raise RuntimeError("Unsupported AssemblyAI voice. See .env.example.")

    def validate(self, text):
        if is_placeholder_key(self.key):
            raise VoiceUnavailable(KEY_CONFIGURATION_ERROR)
        if not text.strip() or len(text) > MAX_TEXT:
            raise VoiceUnavailable("Narration must contain 1 to 1500 characters.")

    def synthesize(self, text: str, persona: str) -> bytes:
        """Buffered HTTP WAV for the explicit, one-call connectivity smoke test."""
        self.validate(text)
        SynthesisBudget.configured().reserve(len(text))
        try:
            with httpx.Client(timeout=httpx.Timeout(30, connect=5)) as client:
                with client.stream("POST", HTTP_ENDPOINT, headers={"Authorization": self.key}, json={
                    "text": text, "voice_id": self.voices[persona], "container": "wav", "stream": False}) as response:
                    response.raise_for_status()
                    if not response.headers.get("content-type", "").startswith("audio/wav"):
                        raise ValueError("Invalid WAV response")
                    content = bytearray()
                    deadline = time.monotonic() + 120
                    for chunk in response.iter_bytes():
                        if len(content) + len(chunk) > MAX_AUDIO or time.monotonic() > deadline:
                            raise ValueError("HTTP synthesis limit")
                        content.extend(chunk)
                    if content[:4] != b"RIFF" or content[8:12] != b"WAVE":
                        raise ValueError("Invalid WAV response")
                    return bytes(content)
        except (httpx.HTTPError, ValueError):
            raise VoiceUnavailable("AssemblyAI HTTP synthesis failed; check credentials and account access.") from None

    async def stream(self, text, persona, stopped):
        self.validate(text)
        SynthesisBudget.configured().reserve(len(text))
        params = urlencode({"voice_id": self.voices[persona], "language": "english",
                            "sample_rate": 24000, "encoding": "pcm_s16le", "word_boundaries": "false"})
        started = time.perf_counter()
        first_audio = None
        total = 0
        session_id = None
        complete = False
        try:
            async with connect(WS_ENDPOINT + "?" + params, additional_headers={"Authorization": self.key},
                               open_timeout=5, close_timeout=2, max_size=1048576, max_queue=8) as ws:
                try:
                    async with asyncio.timeout(120):
                        message = json.loads(await asyncio.wait_for(ws.recv(), 20))
                        if message.get("type") == "Error":
                            raise self.provider_error(message)
                        if message.get("type") != "Begin":
                            raise ValueError("Expected Begin")
                        config = message["configuration"]
                        rate = config["sample_rate"]
                        if (config["encoding"] != "pcm_s16le" or rate not in (8000, 16000, 22050, 24000, 44100, 48000)
                                or config["model"] != "assemblyai-tts-1"):
                            raise ValueError("Unsupported session configuration")
                        maximum = config.get("limits", {}).get("max_generate_text_length", 2000)
                        if len(text) > maximum:
                            raise ValueError("Session text limit")
                        session_id = str(UUID(message["id"]))
                        yield {"type": "begin", "sample_rate": rate, "encoding": "pcm_s16le",
                               "provider_id": session_id}
                        if stopped.is_set():
                            return
                        await ws.send(json.dumps({"type": "Generate", "text": text}))
                        await ws.send(json.dumps({"type": "Flush"}))
                        flush_id = None
                        last_frame = time.monotonic()
                        while not stopped.is_set():
                            try:
                                raw = await asyncio.wait_for(ws.recv(), 0.25)
                            except TimeoutError:
                                if time.monotonic() - last_frame > 20:
                                    raise VoiceUnavailable("AssemblyAI audio timed out. Retry explicitly.") from None
                                continue
                            last_frame = time.monotonic()
                            message = json.loads(raw)
                            kind = message.get("type")
                            if kind == "Error":
                                raise self.provider_error(message)
                            if kind in ("Audio", "FlushDone"):
                                if flush_id is None:
                                    flush_id = message["flush_id"]
                                if message["flush_id"] != flush_id:
                                    raise ValueError("Unexpected flush")
                            if kind == "Audio":
                                pcm = base64.b64decode(message["audio"], validate=True)
                                if not pcm or len(pcm) % 2:
                                    raise ValueError("Malformed PCM")
                                total += len(pcm)
                                if total > MAX_AUDIO:
                                    raise ValueError("Audio exceeds application limit")
                                if first_audio is None:
                                    first_audio = (time.perf_counter() - started) * 1000
                                    logger.info("tts_first_audio provider_id=%s latency_ms=%.1f", session_id, first_audio)
                                yield {"type": "audio", "audio": message["audio"]}
                            elif kind == "FlushDone":
                                if not total or abs(message["audio_duration_ms"] - total / (rate * 2) * 1000) > 20:
                                    raise ValueError("Incomplete audio")
                                await ws.send(json.dumps({"type": "Terminate"}))
                                while True:
                                    ending = json.loads(await asyncio.wait_for(ws.recv(), 5))
                                    if ending.get("type") == "Error":
                                        raise self.provider_error(ending)
                                    if ending.get("type") == "Termination":
                                        break
                                complete = True
                                yield {"type": "done", "server_first_audio_ms": first_audio, "provider_id": session_id}
                                return
                            elif kind == "Termination":
                                raise ValueError("Premature termination")
                finally:
                    if not complete:
                        # Closing also discards synthesis if Cancel cannot be delivered.
                        try:
                            await asyncio.wait_for(ws.send(json.dumps({"type": "Cancel"})), 1)
                        except (Exception, asyncio.CancelledError):
                            pass
        except asyncio.CancelledError:
            raise
        except VoiceUnavailable:
            raise
        except Exception:
            raise VoiceUnavailable("AssemblyAI stream interrupted. Retry explicitly; synthesis may have been billed.") from None

    @staticmethod
    def provider_error(message):
        code = message.get("error_code")
        delay = message.get("retry_after_seconds")
        logger.warning("tts_provider_error code=%s", code if isinstance(code, int) else None)
        cooldown = min(300, math.ceil(max(0, delay))) if type(delay) in (int, float) and math.isfinite(delay) else 0
        return VoiceUnavailable(
            f"AssemblyAI rejected synthesis (code {code if type(code) is int else 'unknown'}).",
            retryable=message.get("retryable") is True, retry_after_seconds=cooldown)
