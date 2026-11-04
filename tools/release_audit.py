"""Offline file/staging audit; reports filenames only, never matched secret values."""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(["git", "-c", f"safe.directory={ROOT.as_posix()}", *args], cwd=ROOT)


def sensitive_path(name):
    p = Path(name)
    return (any(part in {".aws", ".codex", ".agents", "release-private", "recordings", "test-results", "playwright-report"}
                for part in p.parts)
            or (p.name.startswith(".env") and p.name != ".env.example")
            or p.name in {"SESSION_REPORT.md", ".htpasswd"}
            or bool(re.search(r"\.(?:pem|key|sqlite3|db)(?:-.*)?$", p.name)))


def secret_values():
    values = []
    source = (ROOT / ".env").read_text(encoding="utf-8") if (ROOT / ".env").exists() else ""
    pairs = list(re.findall(r"(?m)^([A-Z_]+)[ \t]*=[ \t]*(.*)$", source)) + list(os.environ.items())
    for name, value in pairs:
        value = value.strip().strip("\"'")
        if (re.search(r"(?:SECRET|API_KEY|ACCESS_TOKEN)$", name) and len(value) >= 16
                and not value.lower().startswith(("dummy", "test", "fixture", "transport-fixture", "replace", "your"))):
            values.append(value.encode())
    return values


def audit(staged=False):
    tracked = git("ls-files", "-z").decode().split("\0")
    eligible = git("ls-files", "--others", "--exclude-standard", "-z").decode().split("\0")
    names = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").decode().split("\0") if staged else tracked + eligible
    problems = []
    values = secret_values()
    for name in sorted(set(filter(None, names))):
        if sensitive_path(name):
            problems.append(f"Sensitive path: {name}")
            continue
        if not staged and not (ROOT / name).is_file():
            continue  # Tracked but deleted (uncommitted) files cannot ship from this working tree.
        data = git("show", f":{name}") if staged else (ROOT / name).read_bytes()
        if any(value in data for value in values) or re.search(
                rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}", data):
            problems.append(f"Potential secret content: {name}")
    if not staged:
        for directory in [ROOT / "frontend" / "dist"]:
            for path in directory.rglob("*") if directory.exists() else []:
                if path.is_file() and any(value in path.read_bytes() for value in values):
                    problems.append(f"Secret in build: {path.relative_to(ROOT)}")
        for name in [".env", ".env.production", "release-private/access-token", "recordings/demo.mp4",
                     "test-results/private.wav", "frontend/test-results/private.png", "SESSION_REPORT.md"]:
            ignored = subprocess.run(["git", "-c", f"safe.directory={ROOT.as_posix()}", "check-ignore", "--no-index", "-q", name], cwd=ROOT, check=False)
            if ignored.returncode:
                problems.append(f"Missing ignore protection: {name}")
    for problem in problems:
        print(problem)
    print("Release audit FAILED" if problems else "Release audit passed (offline; no secret values printed)")
    return bool(problems)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--staged", action="store_true")
    sys.exit(audit(parser.parse_args().staged))
