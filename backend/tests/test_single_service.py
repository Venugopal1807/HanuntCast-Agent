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


@pytest.fixture
def edge(monkeypatch, public):
    monkeypatch.setenv("CLIENT_IP_HEADER", "CF-Connecting-IP")
    with TestClient(create_app()) as client:
        yield client


def mint(client, ip=None, forwarded=None):
    headers = {}
    if ip:
        headers["CF-Connecting-IP"] = ip
    if forwarded:
        headers["X-Forwarded-For"] = forwarded
    return client.post("/api/auth", headers=headers)


def test_spoofed_forwarded_for_does_not_bypass_the_auth_limit(edge):
    codes = [mint(edge, "198.51.100.7", f"10.0.{i}.1").status_code for i in range(21)]
    assert codes[:20] == [200] * 20 and codes[20] == 429
    assert mint(edge, "198.51.100.8").status_code == 200  # A different edge-reported client has its own bucket.


def test_ipv6_clients_share_a_bucket_per_64(edge):
    codes = [mint(edge, f"2001:db8:1:2::{i:x}").status_code for i in range(21)]
    assert codes[20] == 429
    assert mint(edge, "2001:db8:1:3::1").status_code == 200


def test_invalid_edge_header_never_creates_a_new_bucket(edge):
    codes = [mint(edge, f"not-an-ip-{i}").status_code for i in range(21)]
    assert codes[20] == 429


def test_full_house_evicts_the_flooding_source_not_other_visitors(monkeypatch, edge):
    monkeypatch.setattr(main, "MAX_SESSIONS", 6)
    body = lambda: {"persona": "archivist", "request_id": str(uuid4())}  # noqa: E731
    visitor = {"Authorization": "Bearer " + mint(edge, "203.0.113.5").json()["access_token"], "CF-Connecting-IP": "203.0.113.5"}
    kept = edge.post("/api/sessions", json=body(), headers=visitor).json()["id"]
    for _ in range(4):  # Fresh tokens from one address, each under its per-owner cap.
        token = mint(edge, "198.51.100.9").json()["access_token"]
        flood = {"Authorization": "Bearer " + token, "CF-Connecting-IP": "198.51.100.9"}
        for _ in range(3):
            assert edge.post("/api/sessions", json=body(), headers=flood).status_code == 200
    assert len(edge.app.state.sessions) == 6
    assert edge.get(f"/api/sessions/{kept}", headers=visitor).status_code == 200
    late = {"Authorization": "Bearer " + mint(edge, "192.0.2.44").json()["access_token"], "CF-Connecting-IP": "192.0.2.44"}
    assert edge.post("/api/sessions", json=body(), headers=late).status_code == 200
    assert edge.get(f"/api/sessions/{kept}", headers=visitor).status_code == 200
