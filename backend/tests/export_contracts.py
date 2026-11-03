"""Emit actual Python response models for the cross-language contract test."""
import json
import sys
from itertools import product
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import SessionView  # noqa: E402
from app.story import DemoStoryProvider, Memory  # noqa: E402

records = []
provider = DemoStoryProvider()
for persona, first, second, third in product(
    ["archivist", "skeptic", "medium"], ["take_key", "study_portrait", "follow_steps"],
    ["trust_child", "read_ledger", "seek_exit"], ["free_ribbon", "ring_bell", "open_window"],
):
    for final in (["release", "leave", "accept"] if third == "free_ribbon" else ["leave", "accept"]):
        memory = Memory(persona)
        for revision, choice in enumerate([first, second, third, final, None]):
            records.append(SessionView(id=UUID("28c7a1f1-c098-49eb-a7e5-c497aee93cd6"), persona=persona,
                                      revision=revision, scene=provider.render(memory), inventory=memory.inventory,
                                      journal=memory.journal).model_dump(mode="json"))
            if choice:
                provider.choose(memory, choice)
print(json.dumps(records))
