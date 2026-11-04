"""Offline tests for the pre-generation tool. No test here can reach the network."""
import importlib.util
import json
import sqlite3
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("pregenerate", Path(__file__).resolve().parents[1] / "tools/pregenerate_narration.py")
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)
MP3 = b"\xff\xfb" + b"\x00" * 4096


class Response:
    def __init__(self, status=200, ctype="audio/mpeg", body=MP3, billed="0"):
        self.status_code, self.body = status, body
        self.headers = {"content-type": ctype, "x-tts-billed-characters": billed}

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def iter_bytes(self):
        yield self.body


class Client:
    def __init__(self, responses, log):
        self.responses, self.log = responses, log

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def stream(self, method, url, headers, json):
        self.log.append((method, url, json))
        return self.responses.pop(0)


@pytest.mark.parametrize("tier,requests,characters", [("openings", 3, 1345), ("chapters", 57, 26753), ("all", 246, 139550)])
def test_plan_covers_every_unique_reachable_text(tier, requests, characters):
    items = tool.plan(tier)
    assert len(items) == requests and sum(len(i["text"]) for i in items) == characters
    assert len({i["key"] for i in items}) == requests
    assert {i["voice"] for i in items} == {"aai-george", "aai-jane", "aai-audrey"}


def test_scene_key_matches_browser_contract():
    # Same value the frontend computes with crypto.subtle (see pregenerated.test.ts).
    assert tool.scene_key("archivist", "A key waits on the table.") == \
        "62c92f3660ca3c3a746d02192b032c986482b41bbbe0bad7c79baf8e5617bd0b"


def test_dry_run_sends_nothing(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr(tool, "OUTPUT", tmp_path)
    monkeypatch.setattr(tool.httpx, "Client", lambda *a, **k: pytest.fail("dry run must not open a client"))
    assert tool.main(["--tier", "openings"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report == {"dry_run": True, "tier": "openings", "requests": 3, "characters": 1345,
                      "voices": ["aai-audrey", "aai-george", "aai-jane"],
                      "approve_with": "HAUNTCAST_PREGENERATE_APPROVED=openings:1345"}


def test_execute_refuses_without_exact_approval(monkeypatch, tmp_path):
    log = []
    monkeypatch.setenv("HAUNTCAST_PREGENERATE_APPROVED", "openings:1344")
    with pytest.raises(PermissionError):
        tool.execute("openings", tmp_path, tmp_path / "ledger.sqlite3", lambda: Client([], log))
    assert not log and not (tmp_path / "ledger.sqlite3").exists()


def test_execute_reserves_writes_manifest_and_resumes_without_paying_twice(monkeypatch, tmp_path):
    monkeypatch.setenv("HAUNTCAST_PREGENERATE_APPROVED", "openings:1345")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "synthetic-transport-credential-0000")
    monkeypatch.setattr(tool, "load_dotenv", lambda *a, **k: None)
    ledger, log = tmp_path / "ledger.sqlite3", []
    summary = tool.execute("openings", tmp_path, ledger, lambda: Client([Response(), Response(), Response()], log))
    assert summary["requests_sent"] == 3 and len(log) == 3
    assert all(body["encoding"] == "mp3" and body["model_id"] == "assemblyai-tts-1" for _, _, body in log)
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert len(manifest["scenes"]) == 3 and set(manifest["samples"]) == {"archivist", "skeptic", "medium"}
    for entry in manifest["scenes"].values():
        assert (tmp_path / entry["file"]).read_bytes() == MP3
    with sqlite3.connect(ledger) as db:
        assert db.execute("SELECT attempts, characters FROM budget").fetchone() == (3, 1345)
    again = tool.execute("openings", tmp_path, ledger, lambda: pytest.fail("resume must not send requests"))
    assert again["requests_planned"] == 0


def test_execute_stops_at_first_failure_without_retry(monkeypatch, tmp_path):
    monkeypatch.setenv("HAUNTCAST_PREGENERATE_APPROVED", "openings:1345")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "synthetic-transport-credential-0000")
    monkeypatch.setattr(tool, "load_dotenv", lambda *a, **k: None)
    log = []
    with pytest.raises(tool.VoiceUnavailable):
        tool.execute("openings", tmp_path, tmp_path / "ledger.sqlite3", lambda: Client([Response(status=500)], log))
    assert len(log) == 1
    assert json.loads((tmp_path / "manifest.json").read_text() if (tmp_path / "manifest.json").exists() else '{"scenes": {}}')["scenes"] == {}


def test_execute_refuses_placeholder_key(monkeypatch, tmp_path):
    monkeypatch.setenv("HAUNTCAST_PREGENERATE_APPROVED", "openings:1345")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "dummy_assemblyai_key_local_only")
    monkeypatch.setattr(tool, "load_dotenv", lambda *a, **k: None)
    with pytest.raises(PermissionError):
        tool.execute("openings", tmp_path, tmp_path / "ledger.sqlite3", lambda: pytest.fail("no client"))


verify_spec = importlib.util.spec_from_file_location("verify_narration", Path(__file__).resolve().parents[1] / "tools/verify_narration.py")
verifier = importlib.util.module_from_spec(verify_spec)
verify_spec.loader.exec_module(verifier)


def test_verifier_accepts_a_complete_generated_tier(monkeypatch, tmp_path):
    monkeypatch.setenv("HAUNTCAST_PREGENERATE_APPROVED", "openings:1345")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "synthetic-transport-credential-0000")
    monkeypatch.setattr(tool, "load_dotenv", lambda *a, **k: None)
    tool.execute("openings", tmp_path, tmp_path / "ledger.sqlite3", lambda: Client([Response(), Response(), Response()], []))
    report = verifier.verify("openings", tmp_path)
    assert report["problems"] == [] and report["verified"] == 3 and report["coverage"] == {"chapter1": 3}
    assert report["samples"] == ["archivist", "medium", "skeptic"]
    # The same files do not satisfy a larger tier.
    assert verifier.verify("all", tmp_path)["verified"] == 3


def test_verifier_flags_wrong_voice_missing_file_bad_audio_and_orphans(monkeypatch, tmp_path):
    monkeypatch.setenv("HAUNTCAST_PREGENERATE_APPROVED", "openings:1345")
    monkeypatch.setenv("ASSEMBLYAI_API_KEY", "synthetic-transport-credential-0000")
    monkeypatch.setattr(tool, "load_dotenv", lambda *a, **k: None)
    tool.execute("openings", tmp_path, tmp_path / "ledger.sqlite3", lambda: Client([Response(), Response(), Response()], []))
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    keys = list(manifest["scenes"])
    manifest["scenes"][keys[0]]["voice"] = "aai-jane" if manifest["scenes"][keys[0]]["voice"] != "aai-jane" else "aai-george"
    (tmp_path / manifest["scenes"][keys[1]]["file"]).unlink()
    (tmp_path / manifest["scenes"][keys[2]]["file"]).write_bytes(b"not audio" * 400)
    manifest["scenes"]["0" * 64] = {"file": "scenes/x.mp3", "voice": "aai-jane", "characters": 1, "generated": "2026-11-04"}
    (tmp_path / "scenes" / "stray.mp3").write_bytes(MP3)
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    problems = " | ".join(verifier.verify("openings", tmp_path)["problems"])
    for expected in ("wrong voice", "file missing", "invalid or tiny audio", "orphan audio file: scenes/stray.mp3", "orphan manifest entry"):
        assert expected in problems


def test_repository_manifest_is_consistent_with_the_story():
    """Whatever narration is committed must match current story text exactly (no stale audio)."""
    report = verifier.verify("all")
    assert [p for p in report["problems"] if not p.startswith("missing recording")] == []
