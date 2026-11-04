"""Single-service hosting (FastAPI serves the built frontend) and per-owner session limits."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import create_app

SECRET = "x" * 8 + "public-deployment-secret-with-enough-variety-0123456789"


@pytest.fixture
def dist(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "narration").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>Blackthorn</title>")
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log(1)")
    (tmp_path / "narration" / "manifest.json").write_text('{"version":1}')
    return tmp_path


@pytest.fixture
def public(monkeypatch, dist):
    for name, value in {"VOICE_PROVIDER": "mock", "STORY_PROVIDER": "demo", "DEPLOYMENT_MODE": "public",
                        "JWT_SECRET": SECRET, "FRONTEND_DIST": str(dist)}.items():
        monkeypatch.setenv(name, value)
    with TestClient(create_app()) as client:
        yield client


def auth(client):
    return {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}


@pytest.mark.parametrize("path", ["/", "/healthz", "/assets/index-abc123.js", "/narration/manifest.json", "/api/capabilities"])
def test_every_response_carries_security_headers(public, path):
    response = public.get(path)
    assert response.headers["Content-Security-Policy"].startswith("default-src 'self'")
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert "microphone=()" in response.headers["Permissions-Policy"]
    assert response.headers["Strict-Transport-Security"] == "max-age=31536000"


def test_static_frontend_and_api_share_one_origin(public):
    assert "Blackthorn" in public.get("/").text
    assert public.get("/healthz").json() == {"status": "ok"}
    assert public.get("/healthz").headers["Cache-Control"] == "no-store"
    assert public.get("/assets/index-abc123.js").headers["Cache-Control"].endswith("immutable")
    assert public.get("/narration/manifest.json").headers["Cache-Control"] == "public, max-age=3600"
    assert public.get("/api/capabilities").status_code == 401  # API still requires a JWT.
    assert public.get("/api/capabilities", headers=auth(public)).json()["voice"] == "mock"
    # Unknown API paths never fall through to the SPA, and no API docs are exposed.
    for path in ("/api/unknown", "/docs", "/redoc", "/openapi.json", "/.env"):
        assert public.get(path).status_code == 404


def test_frontend_dist_must_contain_a_build(monkeypatch, tmp_path):
    monkeypatch.setenv("VOICE_PROVIDER", "mock")
    monkeypatch.setenv("FRONTEND_DIST", str(tmp_path))
    with pytest.raises(RuntimeError, match="FRONTEND_DIST"):
        create_app()


def test_local_api_without_frontend_keeps_original_headers(monkeypatch):
    monkeypatch.setenv("VOICE_PROVIDER", "mock")
    monkeypatch.delenv("FRONTEND_DIST", raising=False)
    with TestClient(create_app()) as client:
        response = client.get("/healthz")
    assert response.headers["Cache-Control"] == "no-store" and "Content-Security-Policy" not in response.headers


def test_one_owner_cannot_fill_the_shared_session_cap(public):
    headers = auth(public)
    ids = [public.post("/api/sessions", json={"persona": "archivist", "request_id": str(uuid4())}, headers=headers).json()["id"]
           for _ in range(main.MAX_SESSIONS_PER_OWNER + 3)]
    owned = [s for s in public.app.state.sessions.values()]
    assert len(owned) == main.MAX_SESSIONS_PER_OWNER
    # The newest stories survive; the oldest are evicted and report expiry cleanly.
    assert public.get(f"/api/sessions/{ids[-1]}", headers=headers).status_code == 200
    assert public.get(f"/api/sessions/{ids[0]}", headers=headers).status_code == 404
    other = auth(public)
    assert public.post("/api/sessions", json={"persona": "medium", "request_id": str(uuid4())}, headers=other).status_code == 200
    assert len(public.app.state.sessions) == main.MAX_SESSIONS_PER_OWNER + 1
