"""Regression tests for code-review fixes; all provider traffic is simulated."""
import json
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import assemblyai
from app.main import create_app
from app.story import DemoStoryProvider, Memory


@pytest.mark.parametrize("persona", ["archivist", "skeptic", "medium"])
@pytest.mark.parametrize("first", ["take_key", "follow_steps", "study_portrait"])
def test_promise_does_not_reveal_an_undiscovered_name(persona, first):
    provider, memory = DemoStoryProvider(), Memory(persona)
    provider.choose(memory, first)
    provider.choose(memory, "trust_child")
    provider.render(memory)  # Inventory and facts still validate.
    if first != "study_portrait":
        assert "Eleanor" not in " ".join(memory.inventory)
        assert "Eleanor" not in provider.render(memory).text
    provider.choose(memory, "free_ribbon")
    provider.choose(memory, "release")
    assert "Eleanor" in provider.render(memory).text


@pytest.mark.parametrize("delay,expected", [(17, 17), (9999, 300), (-3, 0),
                                           (float("nan"), 0), (float("inf"), 0), (True, 0), ("17", 0)])
def test_provider_cooldown_is_structured_and_bounded(delay, expected):
    error = assemblyai.AssemblyAIVoiceProvider.provider_error(
        {"error_code": 3009, "retryable": True, "retry_after_seconds": delay})
    assert error.retryable is True
    assert error.retry_after_seconds == expected


def test_provider_error_metadata_survives_stream_route(monkeypatch, paid_fixture):
    monkeypatch.setenv("VOICE_PROVIDER", "assemblyai")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "transport-fixture-credential")

    async def stream(self, text, persona, stopped):
        yield {"type": "begin", "sample_rate": 24000}
        raise self.provider_error({"error_code": 3009, "retryable": True, "retry_after_seconds": 17})

    monkeypatch.setattr(assemblyai.AssemblyAIVoiceProvider, "stream", stream)
    with TestClient(create_app(), headers=paid_fixture) as client:
        headers = {"Authorization": "Bearer " + client.post("/api/auth").json()["access_token"]}
        story = client.post("/api/sessions", headers=headers,
                            json={"persona": "medium", "request_id": str(uuid4())}).json()
        response = client.post(f"/api/sessions/{story['id']}/audio/stream?revision=0&request_id={uuid4()}",
                               headers=headers)
        error = json.loads(response.text.splitlines()[-1])
        assert error["retryable"] is True
        assert error["retry_after_seconds"] == 17
