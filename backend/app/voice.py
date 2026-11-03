"""Local demo cues, deliberately not presented as synthesized speech."""
import io
import math
import struct
import wave
from functools import lru_cache
from typing import Protocol


class VoiceUnavailable(RuntimeError):
    def __init__(self, message: str, *, retryable: bool = False, retry_after_seconds: int = 0):
        super().__init__(message)
        self.retryable = retryable
        self.retry_after_seconds = retry_after_seconds


class VoiceProvider(Protocol):
    mode: str
    def synthesize(self, text: str, persona: str) -> bytes: ...


class MockVoiceProvider:
    mode = "mock"

    def synthesize(self, text: str, persona: str) -> bytes:
        return mock_cue(persona)


@lru_cache(maxsize=3)
def mock_cue(persona: str) -> bytes:
    rate, seconds = 16000, 6
    base = {"archivist": 110, "skeptic": 130.81, "medium": 98}.get(persona, 110)
    frames = bytearray()
    for i in range(rate * seconds):
        t = i / rate
        envelope = min(1, t / 0.8, (seconds - t) / 1.2)
        pulse = 0.65 + 0.35 * math.sin(2 * math.pi * 0.4 * t)
        value = envelope * pulse * (math.sin(2 * math.pi * base * t)
                                    + 0.35 * math.sin(2 * math.pi * base * 1.498 * t))
        frames.extend(struct.pack("<h", int(value * 2200)))
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(frames)
    return output.getvalue()
