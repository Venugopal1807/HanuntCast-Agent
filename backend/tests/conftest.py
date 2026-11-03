import pytest

from app.budget import initialize


@pytest.fixture
def paid_fixture(monkeypatch, tmp_path):
    """Explicit opt-in for tests whose provider transports are mocked."""
    path = tmp_path / "budget.sqlite3"
    initialize(str(path), 100, 150000)
    token = "fixture-only-live-access-token-with-at-least-48-characters"
    monkeypatch.setenv("DEPLOYMENT_MODE", "local")
    monkeypatch.setenv("TTS_BUDGET_PATH", str(path))
    monkeypatch.setenv("TTS_LIVE_ACCESS_TOKEN", token)
    return {"X-HauntCast-Live-Access": token}
