import io
import time
import wave
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app.assemblyai import AssemblyAIVoiceProvider
from app.main import create_app
from app.voice import VoiceUnavailable


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("VOICE_PROVIDER", "mock")
    monkeypatch.setenv("STORY_PROVIDER", "demo")
    monkeypatch.setenv("JWT_SECRET", "test-only-secret-that-is-longer-than-32-characters")
    with TestClient(create_app()) as value:
        yield value


def auth(client):
    response = client.post("/api/auth")
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def start(client, headers, **changes):
    body = {"persona": "archivist", "request_id": str(uuid4()), **changes}
    return client.post("/api/sessions", json=body, headers=headers)


def decision(choice="take_key", revision=0, **changes):
    return {"choice_id": choice, "revision": revision, "request_id": str(uuid4()), **changes}


def test_auth_and_ownership(client):
    assert client.get("/api/capabilities").status_code == 401
    assert client.post("/api/sessions", json={}).status_code == 401
    first, second = auth(client), auth(client)
    session = start(client, first).json()
    assert client.get(f"/api/sessions/{session['id']}", headers=second).status_code == 404
    assert client.get(f"/api/sessions/{session['id']}/audio?revision=0", headers=second).status_code == 404
    assert client.post(f"/api/sessions/{session['id']}/choices", headers=second, json=decision()).status_code == 404


def test_tampered_and_expired_tokens(client):
    headers = auth(client)
    headers["Authorization"] += "tampered"
    assert client.get("/api/capabilities", headers=headers).status_code == 401
    token = jwt.encode({"sub": str(uuid4()), "iat": 1, "exp": 2, "aud": "hauntcast", "iss": "hauntcast-demo"},
                       "test-only-secret-that-is-longer-than-32-characters", algorithm="HS256")
    assert client.get("/api/capabilities", headers={"Authorization": "Bearer " + token}).status_code == 401


def test_create_is_idempotent(client):
    headers, request_id = auth(client), str(uuid4())
    first = start(client, headers, request_id=request_id)
    second = start(client, headers, request_id=request_id)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert start(client, headers, request_id=request_id, persona="medium").status_code == 409


def test_retry_stale_revision_and_conflicting_id(client):
    headers = auth(client)
    session = start(client, headers).json()
    path = f"/api/sessions/{session['id']}/choices"
    body = decision()
    first = client.post(path, headers=headers, json=body)
    assert first.status_code == 200 and first.json()["revision"] == 1
    assert client.post(path, headers=headers, json=body).json() == first.json()
    assert client.post(path, headers=headers, json=decision()).status_code == 409
    assert client.post(path, headers=headers, json={**body, "choice_id": "study_portrait"}).status_code == 409
    assert client.get(f"/api/sessions/{session['id']}", headers=headers).json()["journal"] == ["Take the brass key"]


def test_concurrent_decisions_advance_once(client):
    headers = auth(client)
    session = start(client, headers).json()
    path = f"/api/sessions/{session['id']}/choices"
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda body: client.post(path, headers=headers, json=body),
                                  [decision("take_key"), decision("study_portrait")]))
    assert sorted(r.status_code for r in responses) == [200, 409]
    assert client.get(f"/api/sessions/{session['id']}", headers=headers).json()["revision"] == 1


@pytest.mark.parametrize("changes", [{"revision": "0"}, {"revision": True}, {"revision": -1},
                                     {"request_id": "not-a-uuid"}, {"choice_id": ""},
                                     {"choice_id": "release"}, {"extra": "untrusted"}])
def test_invalid_input_never_advances(client, changes):
    headers = auth(client)
    session = start(client, headers).json()
    assert client.post(f"/api/sessions/{session['id']}/choices", headers=headers, json=decision(**changes)).status_code == 422
    assert client.get(f"/api/sessions/{session['id']}", headers=headers).json()["revision"] == 0


def test_mock_audio_decodes_without_fake_latency(client):
    headers = auth(client)
    session = start(client, headers).json()
    response = client.get(f"/api/sessions/{session['id']}/audio?revision=0", headers=headers)
    assert response.status_code == 200
    assert response.headers["X-Voice-Mode"] == "mock"
    assert response.headers["Cache-Control"] == "no-store"
    with wave.open(io.BytesIO(response.content), "rb") as audio:
        assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
        assert audio.getframerate() == 16000 and audio.getnframes() == 96000
        assert any(audio.readframes(96000))
    capabilities = client.get("/api/capabilities", headers=headers).json()
    assert capabilities["live_ttfa_ms"] is None and capabilities["assemblyai_available"] is False
    assert client.get(f"/api/sessions/{session['id']}/audio?revision=1", headers=headers).status_code == 409


def test_expiry_and_rate_limits(client):
    headers = auth(client)
    session = start(client, headers).json()
    next(iter(client.app.state.sessions.values())).created = time.time() - 3601
    assert client.get(f"/api/sessions/{session['id']}", headers=headers).status_code == 404
    for _ in range(19):
        assert client.post("/api/auth").status_code == 200
    response = client.post("/api/auth")
    assert response.status_code == 429 and response.headers["Retry-After"] == "60"


def test_assemblyai_unavailable_without_key(monkeypatch):
    monkeypatch.setenv("VOICE_PROVIDER", "assemblyai")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "")
    with pytest.raises(VoiceUnavailable):
        AssemblyAIVoiceProvider().synthesize("Hello", "medium")
    with TestClient(create_app()) as client:
        headers = auth(client)
        session = start(client, headers).json()
        assert session["voice_mode"] == "unavailable"
        response = client.get("/api/capabilities", headers=headers)
        assert response.status_code == 503
        assert "AssemblyAI configuration error" in response.json()["detail"]
        response = client.get(f"/api/sessions/{session['id']}/audio?revision=0", headers=headers)
        assert response.status_code == 503


@pytest.mark.parametrize("ending,final", [("liberation", "release"), ("escape", "leave"), ("inheritance", "accept")])
def test_complete_http_story_and_terminal_behavior(client, ending, final):
    headers = auth(client)
    session = start(client, headers).json()
    path = f"/api/sessions/{session['id']}/choices"
    for revision, choice in enumerate(["study_portrait", "trust_child", "free_ribbon", final]):
        response = client.post(path, headers=headers, json=decision(choice, revision))
        assert response.status_code == 200
        session = response.json()
        assert session["revision"] == revision + 1
        assert len(session["journal"]) == revision + 1
    assert session["scene"]["ending"] == ending
    assert session["scene"]["choices"] == []
    assert client.post(path, headers=headers, json=decision("leave", 4)).status_code == 422
    assert client.get(f"/api/sessions/{session['id']}", headers=headers).json() == session


def test_independent_memory_between_sessions_and_users(client):
    owner, stranger = auth(client), auth(client)
    first, second, third = start(client, owner).json(), start(client, owner).json(), start(client, stranger).json()
    client.post(f"/api/sessions/{first['id']}/choices", headers=owner, json=decision())
    for headers, untouched in [(owner, second), (stranger, third)]:
        assert client.get(f"/api/sessions/{untouched['id']}", headers=headers).json() == untouched
    assert client.post(f"/api/sessions/{first['id']}/choices", headers=stranger, json=decision("read_ledger", 1)).status_code == 404


def test_unexpected_errors_are_sanitized_and_correlated(client, monkeypatch, caplog):
    from app.story import DemoStoryProvider
    headers = auth(client)
    session = start(client, headers).json()

    def broken(*args):
        raise RuntimeError("private-test-value")

    monkeypatch.setattr(DemoStoryProvider, "render", broken)
    response = client.get(f"/api/sessions/{session['id']}", headers=headers)
    assert response.status_code == 500
    assert response.headers["X-Request-ID"]
    assert response.headers["X-Request-ID"] in caplog.text
    assert "private-test-value" not in response.text + caplog.text
    assert "Authorization" not in caplog.text


@pytest.mark.parametrize("persona", ["archivist", "skeptic", "medium"])
def test_personalized_endings_do_not_borrow_another_sessions_memories(client, persona):
    owner, stranger = auth(client), auth(client)
    first = start(client, owner, persona=persona).json()
    second = start(client, owner, persona=persona).json()
    untouched = start(client, stranger, persona=persona).json()
    for scene, route in [(first, ["take_key", "trust_child", "free_ribbon", "release"]),
                         (second, ["study_portrait", "read_ledger", "free_ribbon", "release"])]:
        for revision, choice in enumerate(route):
            response = client.post(f"/api/sessions/{scene['id']}/choices", headers=owner,
                                   json=decision(choice, revision))
            assert response.status_code == 200
    endings = [client.get(f"/api/sessions/{scene['id']}", headers=owner).json() for scene in (first, second)]
    assert endings[0]["scene"]["ending"] == endings[1]["scene"]["ending"] == "liberation"
    assert endings[0]["scene"]["text"] != endings[1]["scene"]["text"]
    assert "brass key" in endings[0]["scene"]["text"].lower()
    assert "kept your promise" in endings[0]["scene"]["text"]
    assert "brass key" not in endings[1]["scene"]["text"].lower()
    assert "keeper's bargain" in endings[1]["scene"]["text"]
    assert client.get(f"/api/sessions/{untouched['id']}", headers=stranger).json() == untouched
    assert client.get(f"/api/sessions/{first['id']}", headers=stranger).status_code == 404
