import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("release_audit", Path(__file__).resolve().parents[2] / "tools/release_audit.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
env_spec = importlib.util.spec_from_file_location("create_release_env", Path(__file__).resolve().parents[2] / "tools/create_release_env.py")
env_tool = importlib.util.module_from_spec(env_spec)
env_spec.loader.exec_module(env_tool)


@pytest.mark.parametrize("path", [".env", ".env.production", "private.pem", "release-private/token",
                                  "SESSION_REPORT.md", "frontend/test-results/audio.wav", "budget.sqlite3-journal"])
def test_release_rejects_sensitive_paths(path):
    assert audit.sensitive_path(path)


def test_audit_empty_environment_value_does_not_consume_next_line(monkeypatch, tmp_path):
    monkeypatch.setattr(audit, "ROOT", tmp_path)
    (tmp_path / ".env").write_text("JWT_SECRET=\n# This is a comment, not a credential\nASSEMBLYAI_API_KEY=dummy_local_only\n")
    assert b"# This is a comment, not a credential" not in audit.secret_values()
    assert not audit.sensitive_path(".env.example")


def test_audit_detects_literal_secret_without_printing_it(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(audit, "ROOT", tmp_path)
    secret = "synthetic-only-credential-123456789"
    (tmp_path / ".env").write_text("ASSEMBLYAI_API_KEY=" + secret)
    (tmp_path / "source.txt").write_text(secret)
    monkeypatch.setattr(audit, "git", lambda *args: b"source.txt\0" if args[0] == "ls-files" else b"")
    monkeypatch.setattr(audit.subprocess, "run", lambda *args, **kwargs: type("Result", (), {"returncode": 0})())
    assert audit.audit()
    output = capsys.readouterr().out
    assert "source.txt" in output and secret not in output


def test_private_env_generation_is_exclusive_and_keeps_secrets_off_stdout(tmp_path, capsys):
    output, proxy = tmp_path / "restricted.env", tmp_path / "proxy.conf"
    env_tool.create("restricted", str(output), str(proxy))
    values = dict(line.split("=", 1) for line in output.read_text().splitlines() if line and not line.startswith("#"))
    token = values["TTS_LIVE_ACCESS_TOKEN"]
    assert len(token) >= 48 and token != values["JWT_SECRET"]
    assert token in proxy.read_text()
    assert token not in capsys.readouterr().out
    before = output.read_text()
    with pytest.raises(FileExistsError):
        env_tool.create("restricted", str(output), str(proxy))
    assert output.read_text() == before


def test_private_env_requires_proxy_path_before_writing(tmp_path):
    output = tmp_path / "restricted.env"
    with pytest.raises(ValueError):
        env_tool.create("restricted", str(output))
    assert not output.exists()
