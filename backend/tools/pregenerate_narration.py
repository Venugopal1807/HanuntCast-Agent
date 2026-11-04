"""Pre-generate AssemblyAI-TTS-1 narration as static MP3 files for the public mock-only demo.

Default is a free, offline DRY RUN that prints the exact plan (texts, characters, requests).
Paid synthesis happens only with --execute AND an approval variable that names the exact plan:

    HAUNTCAST_PREGENERATE_APPROVED=<tier>:<characters>

Safeguards: every request is reserved first in a dedicated cumulative SQLite ledger sized to the
approved plan (no refunds, no reset); no retries; stops at the first failure; already-recorded
texts are skipped so a resumed run never pays twice; the API key is never printed or written.
Files are keyed by sha256("<persona>\\n<exact scene text>") so audio only plays for its own prose.
"""
import argparse
import copy
import hashlib
import json
import os
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import httpx  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

from app.assemblyai import HTTP_ENDPOINT, is_placeholder_key  # noqa: E402
from app.budget import SynthesisBudget, initialize  # noqa: E402
from app.story import DemoStoryProvider, Memory  # noqa: E402
from app.voice import VoiceUnavailable  # noqa: E402

OUTPUT = ROOT / "frontend" / "public" / "narration"
VOICES = {"archivist": "aai-george", "skeptic": "aai-jane", "medium": "aai-audrey"}
TIERS = ("openings", "chapters", "all")
BIT_RATE = 48000
MAX_MP3_BYTES = 4 * 1024 * 1024


def scene_key(persona: str, text: str) -> str:
    return hashlib.sha256(f"{persona}\n{text}".encode("utf-8")).hexdigest()


def plan(tier: str) -> list[dict]:
    """Every unique (persona, scene text) reachable through the real story engine."""
    if tier not in TIERS:
        raise ValueError("Unknown tier")
    story, found = DemoStoryProvider(), {}

    def walk(memory: Memory):
        scene = story.render(memory)
        if tier == "all" or (tier == "chapters" and scene.chapter < 5) or (tier == "openings" and scene.chapter == 1):
            key = scene_key(memory.persona, scene.text)
            found.setdefault(key, {"key": key, "persona": memory.persona, "scene": scene.id, "chapter": scene.chapter,
                                   "voice": VOICES[memory.persona], "text": scene.text})
        if tier == "openings" and scene.chapter >= 1:
            return
        for choice in scene.choices:
            following = copy.deepcopy(memory)
            story.choose(following, choice.id)
            walk(following)

    for persona in VOICES:
        walk(Memory(persona))
    return sorted(found.values(), key=lambda item: (item["chapter"], item["persona"], item["key"]))


def load_manifest(output: Path) -> dict:
    path = output / "manifest.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"version": 1, "model": "assemblyai-tts-1", "samples": {}, "scenes": {}}


def save_manifest(output: Path, manifest: dict) -> None:
    temporary = output / "manifest.json.tmp"
    temporary.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temporary, output / "manifest.json")


def pending(items: list[dict], manifest: dict, output: Path) -> list[dict]:
    return [item for item in items if not (item["key"] in manifest["scenes"]
                                           and (output / manifest["scenes"][item["key"]]["file"]).is_file())]


def synthesize(client: httpx.Client, key: str, item: dict) -> tuple[bytes, int]:
    with client.stream("POST", HTTP_ENDPOINT, headers={"Authorization": key}, json={
            "text": item["text"], "voice_id": item["voice"], "model_id": "assemblyai-tts-1", "language": "english",
            "encoding": "mp3", "bit_rate": BIT_RATE, "sample_rate": 24000, "stream": False}) as response:
        if response.status_code != 200:
            raise VoiceUnavailable(f"AssemblyAI returned HTTP {response.status_code}; stopping without retry.")
        if not response.headers.get("content-type", "").startswith("audio/mpeg"):
            raise VoiceUnavailable("AssemblyAI did not return MP3 audio; stopping without retry.")
        body = bytearray()
        for chunk in response.iter_bytes():
            body.extend(chunk)
            if len(body) > MAX_MP3_BYTES:
                raise VoiceUnavailable("MP3 exceeded the size limit; stopping.")
        billed = response.headers.get("x-tts-billed-characters", "")
    if len(body) < 1024:
        raise VoiceUnavailable("MP3 response was unexpectedly small; stopping.")
    return bytes(body), int(billed) if billed.isdigit() else -1


def execute(tier: str, output: Path, ledger: Path, client_factory=lambda: httpx.Client(
        timeout=httpx.Timeout(90, connect=5), follow_redirects=False)) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest(output)
    todo = pending(plan(tier), manifest, output)
    characters = sum(len(item["text"]) for item in todo)
    summary = {"tier": tier, "requests_planned": len(todo), "characters_planned": characters,
               "requests_sent": 0, "characters_billed_reported": 0}
    if not todo:
        return summary
    approval = os.getenv("HAUNTCAST_PREGENERATE_APPROVED", "")
    if approval != f"{tier}:{characters}":
        raise PermissionError(f"Not approved. Set HAUNTCAST_PREGENERATE_APPROVED={tier}:{characters} to approve exactly this plan.")
    load_dotenv(ROOT / ".env")
    key = os.getenv("ASSEMBLYAI_API_KEY", "").strip()
    if is_placeholder_key(key):
        raise PermissionError("ASSEMBLYAI_API_KEY is missing or a placeholder; nothing was sent.")
    if not ledger.exists():
        ledger.parent.mkdir(parents=True, exist_ok=True)
        initialize(str(ledger), len(todo), characters)  # Sized to the approved plan; never resets an existing one.
    budget = SynthesisBudget(str(ledger))
    scenes_dir = output / "scenes"
    scenes_dir.mkdir(exist_ok=True)
    today = date.today().isoformat()
    with client_factory() as client:
        for item in todo:
            budget.reserve(len(item["text"]))  # Before any network transport; denies when the allowance is spent.
            summary["requests_sent"] += 1
            audio, billed = synthesize(client, key, item)
            name = f"scenes/{item['key'][:32]}.mp3"
            (output / name).write_bytes(audio)
            manifest["scenes"][item["key"]] = {"file": name, "voice": item["voice"], "characters": len(item["text"]),
                                               "generated": today}
            if item["chapter"] == 1:
                manifest["samples"][item["persona"]] = {"file": name, "voice": item["voice"], "characters": len(item["text"]),
                                                        "generated": today, "text": item["text"]}
            save_manifest(output, manifest)
            summary["characters_billed_reported"] += max(billed, 0)
    return summary


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tier", choices=TIERS, required=True)
    parser.add_argument("--execute", action="store_true", help="Send paid requests (requires the approval variable).")
    parser.add_argument("--ledger", help="Dedicated ledger; default release-private/pregenerate-<tier>.sqlite3")
    args = parser.parse_args(argv)
    ledger = Path(args.ledger) if args.ledger else ROOT / "release-private" / f"pregenerate-{args.tier}.sqlite3"
    if not args.execute:
        items = pending(plan(args.tier), load_manifest(OUTPUT), OUTPUT)
        characters = sum(len(item["text"]) for item in items)
        print(json.dumps({"dry_run": True, "tier": args.tier, "requests": len(items), "characters": characters,
                          "voices": sorted({item["voice"] for item in items}),
                          "approve_with": f"HAUNTCAST_PREGENERATE_APPROVED={args.tier}:{characters}"}, indent=2))
        return 0
    try:
        print(json.dumps(execute(args.tier, OUTPUT, ledger), indent=2))
        return 0
    except (PermissionError, VoiceUnavailable, httpx.HTTPError) as error:
        message = str(error) if not isinstance(error, httpx.HTTPError) else "Network error; stopping without retry."
        print("Pre-generation stopped: " + message, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
