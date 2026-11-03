import asyncio
from concurrent.futures import ThreadPoolExecutor
import sqlite3
import threading
from unittest.mock import Mock
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app import assemblyai
from app.budget import DENIED, SynthesisBudget, initialize
from app.main import create_app
from app.voice import VoiceUnavailable


def test_atomic_budget_survives_new_instances_and_concurrent_requests(tmp_path):
    path = str(tmp_path / "budget.sqlite3")
    initialize(path, 3, 12)

    def reserve(_):
        try:
            SynthesisBudget(path).reserve(4)
            return True
        except VoiceUnavailable:
            return False

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(reserve, range(12))) == 3
    with pytest.raises(VoiceUnavailable, match="budget"):
        SynthesisBudget(path).check()
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT attempts,characters FROM budget").fetchone() == (3, 12)
        assert db.execute("SELECT count(*) FROM reservations").fetchone()[0] == 3
    with pytest.raises(FileExistsError):
        initialize(path, 999, 99999)


@pytest.mark.parametrize("state", ["missing", "corrupt", "exhausted", "characters", "locked"])
def test_budget_failure_never_opens_provider_transport(monkeypatch, tmp_path, state):
    path = tmp_path / "budget.sqlite3"
    if state == "corrupt":
        path.write_text("unreadable ledger")
    elif state != "missing":
        initialize(str(path), 1, 1 if state == "characters" else 100)
        if state == "exhausted":
            SynthesisBudget(str(path)).reserve(1)
    monkeypatch.setenv("TTS_BUDGET_PATH", str(path))
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")
    http, websocket = Mock(), Mock()
    monkeypatch.setattr(assemblyai.httpx, "Client", http)
    monkeypatch.setattr(assemblyai, "connect", websocket)
    held = sqlite3.connect(path) if state == "locked" else None
    if held:
        held.execute("BEGIN EXCLUSIVE")
    try:
        provider = assemblyai.AssemblyAIVoiceProvider()
        with pytest.raises(VoiceUnavailable) as error:
            provider.synthesize("Hello", "medium")
        assert str(error.value) == DENIED

        async def collect():
            return [event async for event in provider.stream("Hello", "medium", threading.Event())]

        with pytest.raises(VoiceUnavailable):
            asyncio.run(collect())
        http.assert_not_called()
        websocket.assert_not_called()
    finally:
        if held:
            held.close()


def test_failed_provider_attempt_remains_charged(monkeypatch, tmp_path):
    path = str(tmp_path / "budget.sqlite3")
    initialize(path, 1, 100)
    monkeypatch.setenv("TTS_BUDGET_PATH", path)
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")
    monkeypatch.setattr(assemblyai.httpx, "Client", Mock(side_effect=ValueError("sensitive upstream data")))
    with pytest.raises(VoiceUnavailable):
        assemblyai.AssemblyAIVoiceProvider().synthesize("Hello", "medium")
    with pytest.raises(VoiceUnavailable):
        SynthesisBudget(path).reserve(1)


@pytest.mark.parametrize("access", [None, "wrong"])
def test_anonymous_jwt_cannot_buy_voice(monkeypatch, paid_fixture, access, caplog):
    monkeypatch.setenv("VOICE_PROVIDER", "assemblyai")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")
    upstream = Mock()
    monkeypatch.setattr(assemblyai, "connect", upstream)
    with TestClient(create_app()) as client:
        headers = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
        if access:
            headers["X-HauntCast-Live-Access"] = access
        scene = client.post("/api/sessions", headers=headers, json={"persona": "medium", "request_id": str(uuid4())}).json()
        response = client.post(f"/api/sessions/{scene['id']}/audio/stream?revision=0&request_id={uuid4()}", headers=headers)
        assert response.status_code == 403
        assert "fixture" not in response.text
        assert client.get("/healthz").json() == {"status": "ok"}
        upstream.assert_not_called()
    assert paid_fixture["X-HauntCast-Live-Access"] not in caplog.text


def test_exhausted_budget_denied_by_route_before_stream(monkeypatch, paid_fixture):
    monkeypatch.setenv("VOICE_PROVIDER", "assemblyai")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")
    for _ in range(100):
        SynthesisBudget.configured().reserve(1)
    upstream = Mock()
    monkeypatch.setattr(assemblyai, "connect", upstream)
    with TestClient(create_app(), headers=paid_fixture) as client:
        headers = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
        scene = client.post("/api/sessions", headers=headers, json={"persona": "medium", "request_id": str(uuid4())}).json()
        response = client.post(f"/api/sessions/{scene['id']}/audio/stream?revision=0&request_id={uuid4()}", headers=headers)
        assert response.status_code == 503
        assert response.json()["detail"] == DENIED
        upstream.assert_not_called()


@pytest.mark.parametrize("secret", ["", "short", "a" * 64])
def test_production_rejects_weak_secret(monkeypatch, secret):
    monkeypatch.setenv("DEPLOYMENT_MODE", "public")
    monkeypatch.setenv("JWT_SECRET", secret)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        create_app()


def test_public_cannot_select_paid_provider(monkeypatch):
    monkeypatch.setenv("DEPLOYMENT_MODE", "public")
    monkeypatch.setenv("JWT_SECRET", "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN")
    monkeypatch.setenv("VOICE_PROVIDER", "assemblyai")
    with pytest.raises(RuntimeError, match="requires VOICE_PROVIDER=mock"):
        create_app()


def test_public_mock_stays_free_with_provider_credentials_present(monkeypatch):
    monkeypatch.setenv("DEPLOYMENT_MODE", "public")
    monkeypatch.setenv("JWT_SECRET", "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN")
    monkeypatch.setenv("VOICE_PROVIDER", "mock")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")
    provider = Mock(side_effect=AssertionError("Public must not instantiate live provider"))
    monkeypatch.setattr("app.main.AssemblyAIVoiceProvider", provider)
    with TestClient(create_app()) as client:
        assert client.get("/healthz").json() == {"status": "ok"}
        headers = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
        assert client.get("/api/capabilities", headers=headers).json()["voice"] == "mock"
        scene = client.post("/api/sessions", headers=headers, json={"persona": "medium", "request_id": str(uuid4())}).json()
        assert client.get(f"/api/sessions/{scene['id']}/audio?revision=0", headers=headers).status_code == 200
    provider.assert_not_called()


def test_app_restart_does_not_reset_spent_budget(monkeypatch, tmp_path, paid_fixture):
    path = str(tmp_path / "restart.sqlite3")
    initialize(path, 1, 1500)
    monkeypatch.setenv("TTS_BUDGET_PATH", path)
    monkeypatch.setenv("VOICE_PROVIDER", "assemblyai")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")
    upstream = Mock(side_effect=RuntimeError("private upstream context"))
    monkeypatch.setattr(assemblyai, "connect", upstream)
    for index in range(2):
        with TestClient(create_app(), headers=paid_fixture) as client:
            headers = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
            scene = client.post("/api/sessions", headers=headers, json={"persona": "medium", "request_id": str(uuid4())}).json()
            response = client.post(f"/api/sessions/{scene['id']}/audio/stream?revision=0&request_id={uuid4()}", headers=headers)
            assert response.status_code == (200 if index == 0 else 503)
            assert "private upstream context" not in response.text
    upstream.assert_called_once()
