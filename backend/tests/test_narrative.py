"""Independent continuity/character checks over every canonical route; no provider calls."""
import copy
from itertools import product

import pytest
from pydantic import ValidationError

from app.assemblyai import MAX_TEXT
from app.models import Scene
from app.story import DemoStoryProvider, Memory

PERSONAS = ("archivist", "skeptic", "medium")
PREFIXES = list(product(("take_key", "study_portrait", "follow_steps"),
                        ("trust_child", "read_ledger", "seek_exit"),
                        ("free_ribbon", "ring_bell", "open_window")))
ROUTES = [(*prefix, final) for prefix in PREFIXES
          for final in (("release", "leave", "accept") if prefix[2] == "free_ribbon" else ("leave", "accept"))]


def walk(persona, path):
    provider, memory = DemoStoryProvider(), Memory(persona)
    scenes = [provider.render(memory)]
    for choice in path:
        provider.choose(memory, choice)
        before = copy.deepcopy(memory)
        scenes.append(provider.render(memory))
        assert provider.render(memory) == scenes[-1]
        assert memory == before  # Rendering never writes decisions or consumes randomness.
    return memory, scenes


@pytest.mark.parametrize("path", ROUTES)
def test_distinct_characters_share_facts_and_outcomes_at_every_chapter(path):
    runs = [walk(persona, path) for persona in PERSONAS]
    for index in range(5):
        scenes = [run[1][index] for run in runs]
        assert len({scene.text for scene in scenes}) == 3
        assert len({scene.model_dump_json(exclude={"text"}) for scene in scenes}) == 1
        for scene in scenes:
            assert 0 < len(scene.text) <= MAX_TEXT
            assert "{" not in scene.text and "}" not in scene.text
    for memory, _ in runs:
        assert memory.facts == runs[0][0].facts
        assert memory.inventory == runs[0][0].inventory
        assert memory.journal == runs[0][0].journal


@pytest.mark.parametrize("persona", PERSONAS)
def test_every_ending_reflects_each_meaningful_prior_decision(persona):
    by_outcome = {"liberation": set(), "escape": set(), "inheritance": set()}
    for path in ROUTES:
        memory, scenes = walk(persona, path)
        text = scenes[-1].text
        by_outcome[memory.scene].add(text)
        if path[0] == "take_key":
            assert "brass key is still in your coat" in text.lower()
            assert "Eleanor's name" not in text  # No portrait discovery on the key route.
        elif path[0] == "study_portrait":
            assert "Eleanor's name" in text
            assert "brass key" not in text.lower()
        else:
            assert "silent passage" in text
            assert "brass key" not in text.lower()
        if path[1] == "trust_child":
            kept = path[-1] == "release" or (path[-1] == "accept" and path[2] == "free_ribbon")
            assert ("kept your promise" in text) == kept
            assert ("broke your promise" in text) == (not kept)
        else:
            assert "your promise" not in text
            assert ("keeper's bargain" in text) == (path[1] == "read_ledger")
        if path[-1] == "leave":
            assert ("garden window" in text) == (path[2] == "open_window")
            assert ("front door" in text) == (path[2] != "open_window")
            assert "only a house" not in text
        if path[-1] == "accept":
            assert ("Eleanor escapes" in text) == (path[2] == "free_ribbon")
            assert ("remains in the mirror" in text) == (path[2] != "free_ribbon")
            assert ("recognizes the hand that rang it" in text) == (path[2] == "ring_bell")
    assert {outcome: len(texts) for outcome, texts in by_outcome.items()} == {
        "liberation": 9, "escape": 27, "inheritance": 27}


def test_skeptic_progression_and_each_narrators_own_dialogue():
    route = ("study_portrait", "read_ledger", "ring_bell", "accept")
    _, skeptical = walk("skeptic", route)
    assert "Working hypothesis" in skeptical[0].text
    assert "Projection" in skeptical[1].text
    assert "That is not acoustics" in skeptical[2].text
    assert "I am frightened" in skeptical[3].text
    assert "You have become the explanation" in skeptical[4].text
    _, historical = walk("archivist", route)
    assert "record" in historical[0].text and "archive" in historical[4].text
    assert "'Observe before you touch,'" in historical[0].text
    _, intuitive = walk("medium", route)
    assert "I feel her flinch" in intuitive[0].text
    assert "'She will feel the difference when you leave.'" in intuitive[1].text
    assert "Your pulse is everywhere now" in intuitive[4].text


@pytest.mark.parametrize("persona", PERSONAS)
def test_locating_a_window_does_not_open_it_or_free_the_girl(persona):
    _, scenes = walk(persona, ("follow_steps", "seek_exit", "ring_bell", "leave"))
    assert "still bolted" in scenes[2].text
    assert "garden window" not in scenes[-1].text
    assert "front door" in scenes[-1].text
    assert "left it bolted" in scenes[-1].text or "left its latch bolted" in scenes[-1].text


@pytest.mark.parametrize("corruption", ("inventory", "journal", "facts", "scene", "persona"))
def test_conflicting_server_memory_cannot_create_an_invented_ending(corruption):
    memory, _ = walk("medium", ("study_portrait", "trust_child", "free_ribbon", "release"))
    if corruption == "inventory":
        memory.inventory[0] = "Brass key"
    elif corruption == "journal":
        memory.journal[0] = "Take the brass key"
    elif corruption == "facts":
        memory.facts.add("key")
    elif corruption == "scene":
        memory.scene = "inheritance"
    else:
        memory.persona = "unknown"
    before = copy.deepcopy(memory)
    with pytest.raises(ValueError):
        DemoStoryProvider().render(memory)
    assert memory == before


def test_scene_validation_rejects_unvoiceable_template():
    scene = DemoStoryProvider().render(Memory("archivist"))
    for text in ("", "x" * (MAX_TEXT + 1)):
        with pytest.raises(ValidationError):
            Scene.model_validate({**scene.model_dump(), "text": text})


def test_mutating_a_rendered_choice_does_not_mutate_other_sessions():
    provider = DemoStoryProvider()
    first, second = Memory("archivist"), Memory("medium")
    provider.render(first).choices[0].label = "Changed by a consumer"
    assert provider.render(second).choices[0].label == "Take the brass key"
