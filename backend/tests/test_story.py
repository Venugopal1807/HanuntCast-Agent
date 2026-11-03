import copy
from itertools import product

import pytest

from app.story import DemoStoryProvider, Memory

FIRST = ["take_key", "study_portrait", "follow_steps"]
SECOND = ["trust_child", "read_ledger", "seek_exit"]
THIRD = ["free_ribbon", "ring_bell", "open_window"]
PATHS = [(*prefix, ending) for prefix in product(FIRST, SECOND, THIRD)
         for ending in (["release", "leave", "accept"] if prefix[2] == "free_ribbon" else ["leave", "accept"])]


@pytest.mark.parametrize("persona", ["archivist", "skeptic", "medium"])
@pytest.mark.parametrize("path", PATHS)
def test_every_reachable_path(persona, path):
    provider = DemoStoryProvider()
    memory = Memory(persona)
    for chapter, choice in enumerate(path, start=1):
        scene = provider.render(memory)
        assert scene.chapter == chapter
        assert len(scene.choices) in (2, 3)
        assert choice in [item.id for item in scene.choices]
        provider.choose(memory, choice)
    ending = provider.render(memory)
    assert ending.ending == {"release": "liberation", "leave": "escape", "accept": "inheritance"}[path[-1]]
    assert ending.chapter == 5 and ending.choices == []
    assert len(memory.journal) == 4 and len(memory.inventory) == 3
    if path[-1] == "release":
        assert "ribbon" in memory.facts
    if path[-1] == "leave":
        assert ("brass key is still" in ending.text.lower()) == (path[0] == "take_key")
        assert ("garden window" in ending.text) == (path[2] == "open_window")
        assert ("broke your promise" in ending.text) == (path[1] == "trust_child")
    if path[-1] == "accept":
        assert ("Eleanor escapes" in ending.text) == (path[2] == "free_ribbon")


def test_invalid_choice_does_not_mutate():
    memory = Memory("archivist")
    before = copy.deepcopy(memory)
    with pytest.raises(ValueError):
        DemoStoryProvider().choose(memory, "release")
    assert memory == before


def test_release_requires_freeing_ribbon():
    provider, memory = DemoStoryProvider(), Memory("medium")
    for choice in ["study_portrait", "trust_child", "ring_bell"]:
        provider.choose(memory, choice)
    assert "release" not in [c.id for c in provider.render(memory).choices]
    with pytest.raises(ValueError):
        provider.choose(memory, "release")


def test_persona_and_inventory_fidelity():
    provider = DemoStoryProvider()
    texts = [provider.render(Memory(p)).text for p in ["archivist", "skeptic", "medium"]]
    assert len(set(texts)) == 3
    memory = Memory("skeptic")
    provider.choose(memory, "follow_steps")
    assert "footprints led you" in provider.render(memory).text
    assert "Brass key" not in memory.inventory
