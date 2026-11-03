import asyncio
import base64
import json
import threading
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app import assemblyai
from app.main import create_app
from app.voice import VoiceUnavailable

ID = "10885144-0d4b-4928-9eff-ef292a352937"
BEGIN = {"type": "Begin", "id": ID, "configuration": {
    "sample_rate": 16000, "encoding": "pcm_s16le", "model": "assemblyai-tts-1"}}
AUDIO = {"type": "Audio", "audio": base64.b64encode(b"\x00\x00\xff\x7f" * 80).decode(), "flush_id": 7}
DONE = {"type": "FlushDone", "flush_id": 7, "audio_duration_ms": 10}


class Socket:
    def __init__(self, frames):
        self.frames = iter(frames)
        self.sent = []
        self.closed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        self.closed = True

    async def recv(self):
        value = next(self.frames)
        if isinstance(value, Exception):
            raise value
        return json.dumps(value)

    async def send(self, value):
        self.sent.append(json.loads(value))


@pytest.fixture
def provider(monkeypatch, paid_fixture):
    # Unrecognized fixture text, never a genuine credential; transports below are mocked.
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")
    return assemblyai.AssemblyAIVoiceProvider()


def run_stream(monkeypatch, provider, frames, stop=None):
    socket = Socket(frames)
    def connect(url, **kwargs):
        assert url.startswith(assemblyai.WS_ENDPOINT)
        assert "transport-fixture-credential" not in url
        assert kwargs["additional_headers"] == {"Authorization": "transport-fixture-credential"}
        assert kwargs["max_queue"] == 8
        return socket
    monkeypatch.setattr(assemblyai, "connect", connect)
    async def collect():
        return [event async for event in provider.stream("Hello.", "medium", stop or threading.Event())]
    return socket, collect


def test_stream_incremental_configuration_and_metrics(monkeypatch, provider):
    socket, collect = run_stream(monkeypatch, provider, [BEGIN, AUDIO, DONE, {"type": "Termination"}])
    events = asyncio.run(collect())
    assert [e["type"] for e in events] == ["begin", "audio", "done"]
    assert events[0]["sample_rate"] == 16000  # Authoritative echo, not requested 24000.
    assert events[-1]["server_first_audio_ms"] >= 0
    assert events[-1]["provider_id"] == ID
    assert [m["type"] for m in socket.sent] == ["Generate", "Flush", "Terminate"]
    assert socket.closed


@pytest.mark.parametrize("frames", [
    [{"type": "Error", "error_code": 1008}],
    [BEGIN, {"type": "Error", "error_code": 3009, "retry_after_seconds": 17}],
    [BEGIN, {**AUDIO, "audio": "!!"}],
    [BEGIN, {**AUDIO, "audio": "AA=="}],
    [BEGIN, AUDIO, {**DONE, "flush_id": 8}],
    [BEGIN, AUDIO, {**DONE, "audio_duration_ms": 1000}],
    [BEGIN, ConnectionError("transport-fixture-credential")],
    [BEGIN, {"type": "Termination"}],
    [{**BEGIN, "configuration": {**BEGIN["configuration"], "encoding": "pcm_mulaw"}}],
])
def test_failure_is_safe_and_cancels(monkeypatch, provider, frames):
    socket, collect = run_stream(monkeypatch, provider, frames)
    with pytest.raises(VoiceUnavailable) as error:
        asyncio.run(collect())
    assert "transport-fixture-credential" not in str(error.value)
    assert socket.closed and socket.sent[-1] == {"type": "Cancel"}


def test_cancel_and_generator_close(monkeypatch, provider):
    stop = threading.Event()
    socket, _ = run_stream(monkeypatch, provider, [BEGIN, AUDIO], stop)
    async def consume():
        stream = provider.stream("Hello.", "medium", stop)
        assert (await anext(stream))["type"] == "begin"
        assert (await anext(stream))["type"] == "audio"
        stop.set()
        assert [e async for e in stream] == []
        await stream.aclose()
        await stream.aclose()
    asyncio.run(consume())
    assert socket.sent[-1] == {"type": "Cancel"} and socket.closed


def test_cancel_task_releases_transport(monkeypatch, provider):
    socket, _ = run_stream(monkeypatch, provider, [BEGIN])
    async def consume():
        stream = provider.stream("Hello.", "medium", threading.Event())
        await anext(stream)
        await stream.aclose()
    asyncio.run(consume())
    assert socket.closed and socket.sent[-1] == {"type": "Cancel"}


def test_text_and_voice_bounds(monkeypatch, provider):
    for text in ("", " " * 10, "x" * 1501):
        with pytest.raises(VoiceUnavailable):
            provider.validate(text)
    monkeypatch.setenv("ASSEMBLYAI_VOICE_MEDIUM", "invented")
    with pytest.raises(RuntimeError):
        assemblyai.AssemblyAIVoiceProvider()


def test_http_smoke_transport(monkeypatch, provider):
    import io
    import wave
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(b"\0\0" * 20)
    calls = []
    def handle(request):
        calls.append(request)
        assert json.loads(request.content)["stream"] is False
        assert json.loads(request.content)["container"] == "wav"
        assert request.headers["Authorization"] == "transport-fixture-credential"
        return httpx.Response(200, content=out.getvalue(), headers={"content-type": "audio/wav"})
    real_client = httpx.Client
    monkeypatch.setattr(assemblyai.httpx, "Client", lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs))
    assert provider.synthesize("Hello.", "medium") == out.getvalue()
    assert len(calls) == 1


def test_stream_route_auth_ownership_deduplication(monkeypatch, paid_fixture):
    monkeypatch.setenv("VOICE_PROVIDER", "assemblyai")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")
    calls = []
    async def stream(self, text, persona, stopped):
        calls.append(text)
        yield {"type": "begin", "sample_rate": 24000}
        yield {"type": "done"}
    monkeypatch.setattr(assemblyai.AssemblyAIVoiceProvider, "stream", stream)
    with TestClient(create_app(), headers=paid_fixture) as client:
        headers = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
        other = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
        story = client.post("/api/sessions", headers=headers, json={"persona": "medium", "request_id": str(uuid4())}).json()
        assert story["voice_mode"] == "live"
        path = f"/api/sessions/{story['id']}/audio/stream?revision=0&request_id={uuid4()}"
        assert client.post(path).status_code == 401
        assert client.post(path, headers=other).status_code == 404
        assert client.post(path, headers=headers).status_code == 200
        assert client.post(path, headers=headers).status_code == 409
        assert len(calls) == 1
        assert client.post(path.replace('revision=0', 'revision=1'), headers=headers).status_code == 409


@pytest.mark.parametrize("persona,voice", [
    ("archivist", "aai-george"), ("skeptic", "aai-jane"), ("medium", "aai-audrey")])
@pytest.mark.parametrize("choices", [
    [], ["take_key"], ["study_portrait", "read_ledger"],
    ["follow_steps", "trust_child", "open_window"],
    ["study_portrait", "trust_child", "free_ribbon", "release"],
    ["take_key", "seek_exit", "open_window", "leave"],
    ["follow_steps", "read_ledger", "ring_bell", "accept"],
])
def test_every_chapter_and_ending_streams_its_exact_persona_text(monkeypatch, persona, voice, choices, paid_fixture):
    from urllib.parse import parse_qs, urlsplit
    monkeypatch.setenv("VOICE_PROVIDER", "assemblyai")
    monkeypatch.setenv("STORY_PROVIDER", "demo")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")
    for name in ("ARCHIVIST", "SKEPTIC", "MEDIUM"):
        monkeypatch.delenv("ASSEMBLYAI_VOICE_" + name, raising=False)
    socket = Socket([{**BEGIN, "configuration": {**BEGIN["configuration"], "voice_id": voice}},
                     AUDIO, DONE, {"type": "Termination"}])
    connections = []

    def connect(url, **kwargs):
        connections.append(url)
        assert parse_qs(urlsplit(url).query)["voice_id"] == [voice]
        assert kwargs["additional_headers"] == {"Authorization": "transport-fixture-credential"}
        return socket

    monkeypatch.setattr(assemblyai, "connect", connect)
    with TestClient(create_app(), headers=paid_fixture) as client:
        headers = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
        scene = client.post("/api/sessions", headers=headers, json={
            "persona": persona, "request_id": str(uuid4())}).json()
        for revision, choice in enumerate(choices):
            response = client.post(f"/api/sessions/{scene['id']}/choices", headers=headers,
                                   json={"choice_id": choice, "revision": revision, "request_id": str(uuid4())})
            assert response.status_code == 200
            scene = response.json()
        response = client.post(f"/api/sessions/{scene['id']}/audio/stream?revision={len(choices)}&request_id={uuid4()}",
                               headers=headers)
        assert response.status_code == 200
        assert [json.loads(line)["type"] for line in response.text.splitlines()] == ["begin", "audio", "done"]
        assert len(connections) == 1
        assert socket.sent[0] == {"type": "Generate", "text": scene["scene"]["text"]}
        assert 0 < len(socket.sent[0]["text"]) <= assemblyai.MAX_TEXT
        assert [message["type"] for message in socket.sent] == ["Generate", "Flush", "Terminate"]
        assert socket.closed


@pytest.mark.skipif(__import__("os").getenv("HAUNTCAST_LIVE_SMOKE") != "1", reason="Opt-in paid single HTTP synthesis")
def test_live_http_once(monkeypatch):
    import io
    import logging
    import os
    import wave
    from pathlib import Path

    assert os.getenv("VOICE_PROVIDER") == "assemblyai"
    assert os.getenv("STORY_PROVIDER", "demo") == "demo"
    provider = assemblyai.AssemblyAIVoiceProvider()
    text = "Welcome to Blackthorn House. Your story begins now."
    provider.validate(text)
    directory = Path(__file__).resolve().parents[2] / "test-results" / "assemblyai-http-smoke"
    directory.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents an accidental rerun after a potentially billed attempt.
    # Reset only with explicit authorization for another paid synthesis.
    with (directory / "attempt.json").open("x", encoding="utf-8") as attempt:
        json.dump({"voice": provider.voices["medium"], "input_characters": len(text)}, attempt)

    report = {"http_requests": 0, "selected_voice": provider.voices["medium"],
              "input_characters": len(text), "valid_wav": False}
    real_client = httpx.Client

    def before_request(request):
        if report["http_requests"] != 0:
            raise RuntimeError("Blocked additional live HTTP request")
        assert request.method == "POST" and str(request.url) == assemblyai.HTTP_ENDPOINT
        assert json.loads(request.content) == {
            "text": text, "voice_id": provider.voices["medium"], "container": "wav", "stream": False}
        report["http_requests"] += 1

    def after_response(response):
        report["http_status"] = response.status_code
        # Persist only validated, non-secret provider metadata; never headers wholesale.
        voice = response.headers.get("x-tts-voice-id")
        report["returned_voice"] = voice if voice in assemblyai.VOICES else None
        report["returned_model_valid"] = response.headers.get("x-tts-model") == "assemblyai-tts-1"
        for header, field in (("x-tts-sample-rate", "returned_sample_rate"),
                              ("x-tts-billed-characters", "billed_characters"),
                              ("x-tts-audio-duration-ms", "returned_audio_duration_ms")):
            value = response.headers.get(header, "")
            report[field] = int(value) if value.isascii() and value.isdecimal() and len(value) < 12 else None

    def client(**kwargs):
        return real_client(**kwargs, follow_redirects=False, transport=httpx.HTTPTransport(retries=0),
                           event_hooks={"request": [before_request], "response": [after_response]})

    monkeypatch.setattr(assemblyai.httpx, "Client", client)
    previous_logging = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    try:
        audio = provider.synthesize(text, "medium")
        assert provider.key.encode() not in audio
        with wave.open(io.BytesIO(audio)) as wav:
            rate = wav.getframerate()
            frames = wav.getnframes()
            assert wav.getnchannels() == 1 and wav.getsampwidth() == 2 and frames > 0
            assert rate in (8000, 16000, 22050, 24000, 44100, 48000)
            pcm = wav.readframes(frames)
            assert len(pcm) == frames * 2 and any(pcm)
            report.update(sample_rate=rate, duration_seconds=frames / rate, audio_bytes=len(audio), valid_wav=True)
        (directory / "speech.wav").write_bytes(audio)
        assert report["http_requests"] == 1 and report["http_status"] == 200
        assert report["returned_voice"] == report["selected_voice"]
        assert report["returned_sample_rate"] == report["sample_rate"]
        assert report["returned_model_valid"]
    finally:
        logging.disable(previous_logging)
        (directory / "result.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report))
