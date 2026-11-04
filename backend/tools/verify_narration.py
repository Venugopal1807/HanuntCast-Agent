"""Offline verification of pre-generated narration. Free: reads local files only, no network.

    python backend/tools/verify_narration.py --tier all

Checks every planned (narrator, exact scene text) for the tier: manifest entry present under the
SHA-256 key of "<persona>\\n<text>", correct narrator voice, character count equal to the text,
audio file present, non-trivial size and a valid MP3/WAV header; narrator samples point at real
files; no manifest entry or file is orphaned. Exits non-zero on any problem.
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pregenerate_narration as tool  # noqa: E402


def audio_header_ok(data: bytes) -> bool:
    mp3 = data[:3] == b"ID3" or (len(data) > 1 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)
    wav = data[:4] == b"RIFF" and data[8:12] == b"WAVE"
    return mp3 or wav


def verify(tier: str, output: Path = tool.OUTPUT) -> dict:
    manifest = tool.load_manifest(output)
    plan = tool.plan(tier)
    problems, coverage = [], Counter()
    for item in plan:
        entry = manifest["scenes"].get(item["key"])
        label = f"{item['persona']}/{item['scene']}/{item['key'][:12]}"
        if entry is None:
            problems.append(f"missing recording: {label}")
            continue
        if entry["voice"] != item["voice"]:
            problems.append(f"wrong voice {entry['voice']} for {label} (expected {item['voice']})")
        if entry["characters"] != len(item["text"]):
            problems.append(f"character count mismatch for {label}")
        path = output / entry["file"]
        if not path.is_file():
            problems.append(f"file missing for {label}: {entry['file']}")
            continue
        data = path.read_bytes()
        if len(data) < 1024 or not audio_header_ok(data):
            problems.append(f"invalid or tiny audio for {label}: {entry['file']} ({len(data)} bytes)")
        coverage["ending" if item["chapter"] == 5 else f"chapter{item['chapter']}"] += 1
    for persona, sample in manifest.get("samples", {}).items():
        if not (output / sample["file"]).is_file():
            problems.append(f"sample file missing for {persona}: {sample['file']}")
        if sample["voice"] != tool.VOICES[persona]:
            problems.append(f"sample voice mismatch for {persona}")
    referenced = {e["file"] for e in manifest["scenes"].values()} | {s["file"] for s in manifest.get("samples", {}).values()}
    for path in sorted((output / "scenes").glob("*")) if (output / "scenes").exists() else []:
        if f"scenes/{path.name}" not in referenced:
            problems.append(f"orphan audio file: scenes/{path.name}")
    planned_all = {i["key"] for i in tool.plan("all")}
    for key in manifest["scenes"]:
        if key not in planned_all:
            problems.append(f"orphan manifest entry (matches no current story text): {key[:12]}")
    return {"tier": tier, "planned": len(plan), "verified": sum(coverage.values()), "coverage": dict(coverage),
            "samples": sorted(manifest.get("samples", {})), "problems": problems}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tier", choices=tool.TIERS, required=True)
    report = verify(parser.parse_args(argv).tier)
    print(json.dumps(report, indent=2))
    return 1 if report["problems"] or report["verified"] != report["planned"] else 0


if __name__ == "__main__":
    sys.exit(main())
