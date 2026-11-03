"""Configuration regressions: no HTTP or WebSocket provider transport may open."""
import asyncio
import io
import threading
import wave
from unittest.mock import Mock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import assemblyai
from app.main import create_app
from app.voice import VoiceUnavailable

INVALID_KEYS = [
    None, "", " \t\n", "dummy_assemblyai_key_local_only", " DUMMY_ASSEMBLYAI_KEY_LOCAL_ONLY ",
    "dummy", "placeholder", "your_api_key_here", "your-assemblyai-api-key", "yourAssemblyAiApiKeyHere",
    "replace_me", "replace-with-real-key", "changeme", "change_me", "insert-key-here", "paste_key_here",
    "test", "test-key", "secret-test-key", "example_key", "fake-api-key", "api_key", "ASSEMBLYAI_API_KEY",
    "ASSEMBLYAI_API_KEY_HERE", "none", "null", "undefined", "not-set", "not-a-real-key", "local-only",
    "xxxxxx", "********", "<dashboard-key>", "${ASSEMBLYAI_API_KEY}", "{{api_key}}",
]


@pytest.fixture(autouse=True)
def no_provider_network(monkeypatch):
    http = Mock(side_effect=AssertionError("HTTP provider transport must not open"))
    websocket = Mock(side_effect=AssertionError("WebSocket provider transport must not open"))
    monkeypatch.setattr(assemblyai.httpx, "Client", http)
    monkeypatch.setattr(assemblyai, "connect", websocket)
    monkeypatch.setenv("STORY_PROVIDER", "demo")
    monkeypatch.setenv("JWT_SECRET", "configuration-fixture-secret-over-32-characters")
    yield
    http.assert_not_called()
    websocket.assert_not_called()


def set_key(monkeypatch, key):
    if key is None:
        monkeypatch.delenv("ASSEMBLYAI_API_KEY", raising=False)
    else:
        monkeypatch.setenv("ASSEMBLYAI_API_KEY", key)


@pytest.mark.parametrize("key", INVALID_KEYS)
def test_placeholders_block_both_live_transports(monkeypatch, key, caplog):
    set_key(monkeypatch, key)
    assert assemblyai.is_placeholder_key(key)
    provider = assemblyai.AssemblyAIVoiceProvider()
    assert provider.mode == "unavailable"
    with pytest.raises(VoiceUnavailable) as error:
        provider.synthesize("Hello.", "medium")
    assert str(error.value) == assemblyai.KEY_CONFIGURATION_ERROR

    async def collect():
        return [event async for event in provider.stream("Hello.", "medium", threading.Event())]

    with pytest.raises(VoiceUnavailable) as error:
        asyncio.run(collect())
    assert str(error.value) == assemblyai.KEY_CONFIGURATION_ERROR
    assert not caplog.records


@pytest.mark.parametrize("key", [None, "", " ", "dummy_assemblyai_key_local_only", "your_api_key_here", "test-key"])
def test_explicit_assemblyai_reports_configuration_error(monkeypatch, key, caplog):
    set_key(monkeypatch, key)
    monkeypatch.setenv("VOICE_PROVIDER", "assemblyai")
    with TestClient(create_app()) as client:
        assert client.get("/api/capabilities").status_code == 401
        headers = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
        response = client.get("/api/capabilities", headers=headers)
        assert response.status_code == 503
        assert response.json() == {"detail": assemblyai.KEY_CONFIGURATION_ERROR}
        session = client.post("/api/sessions", headers=headers, json={
            "persona": "medium", "request_id": str(uuid4()),
        }).json()
        assert session["voice_mode"] == "unavailable"
        path = f"/api/sessions/{session['id']}/audio"
        responses = [client.get(path + "?revision=0", headers=headers), client.post(
            path + f"/stream?revision=0&request_id={uuid4()}", headers=headers,
        )]
        for response in responses:
            assert response.status_code == 503
            assert response.json() == {"detail": assemblyai.KEY_CONFIGURATION_ERROR}
        stored = next(iter(client.app.state.sessions.values()))
        assert not stored.audio_active and not stored.audio_requests
    assert "dummy_assemblyai_key_local_only" not in caplog.text


@pytest.mark.parametrize("key", [None, "", "dummy_assemblyai_key_local_only", "transport-fixture-credential"])
@pytest.mark.parametrize("persona", ["archivist", "skeptic", "medium"])
def test_mock_mode_plays_without_assemblyai(monkeypatch, key, persona, caplog):
    set_key(monkeypatch, key)
    monkeypatch.setenv("VOICE_PROVIDER", "mock")
    # Mock selection must not instantiate or validate the live provider.
    monkeypatch.setenv("ASSEMBLYAI_VOICE_MEDIUM", "unused-in-mock-mode")
    with TestClient(create_app()) as client:
        headers = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
        capabilities = client.get("/api/capabilities", headers=headers).json()
        assert capabilities["voice"] == "mock" and not capabilities["assemblyai_available"]
        assert capabilities["live_ttfa_ms"] is None
        session = client.post("/api/sessions", headers=headers, json={
            "persona": persona, "request_id": str(uuid4()),
        }).json()
        assert session["voice_mode"] == "mock"
        path = f"/api/sessions/{session['id']}/audio"
        response = client.get(path + "?revision=0", headers=headers)
        assert response.status_code == 200 and response.headers["X-Voice-Mode"] == "mock"
        with wave.open(io.BytesIO(response.content)) as wav:
            assert wav.getnchannels() == 1 and wav.getsampwidth() == 2
            assert wav.getframerate() == 16000 and wav.getnframes() == 96000
            assert any(wav.readframes(96000))
        replay = client.get(path + "?revision=0", headers=headers)
        assert replay.content == response.content
        assert client.post(path + f"/stream?revision=0&request_id={uuid4()}", headers=headers).status_code == 503
        assert key is None or not key or key not in str(capabilities) + str(session) + caplog.text


def test_unrecognized_key_is_not_claimed_as_verified(monkeypatch):
    # This arbitrary fixture is not a real key. Only account access could verify one.
    set_key(monkeypatch, " transport-fixture-credential ")
    provider = assemblyai.AssemblyAIVoiceProvider()
    assert not assemblyai.is_placeholder_key(provider.key)
    assert provider.key == "transport-fixture-credential" and provider.mode == "live"


def test_transport_guard_rechecks_key(monkeypatch):
    set_key(monkeypatch, "transport-fixture-credential")
    provider = assemblyai.AssemblyAIVoiceProvider()
    provider.key = "dummy_assemblyai_key_local_only"
    with pytest.raises(VoiceUnavailable, match="AssemblyAI configuration error"):
        provider.synthesize("Hello.", "medium")

    async def collect():
        return [event async for event in provider.stream("Hello.", "medium", threading.Event())]

    with pytest.raises(VoiceUnavailable, match="AssemblyAI configuration error"):
        asyncio.run(collect())
