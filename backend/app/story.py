"""Original deterministic fiction behind a provider-agnostic story boundary."""
from dataclasses import dataclass, field
from typing import Protocol

from .models import Choice, Persona, Scene
from .narration import narrate


@dataclass
class Memory:
    persona: Persona
    scene: str = "threshold"
    inventory: list[str] = field(default_factory=list)
    journal: list[str] = field(default_factory=list)
    facts: set[str] = field(default_factory=set)


class StoryProvider(Protocol):
    def render(self, memory: Memory) -> Scene: ...
    def choose(self, memory: Memory, choice_id: str) -> None: ...


def option(id: str, label: str, hint: str) -> Choice:
    return Choice(id=id, label=label, hint=hint)


SCENES = {
    "threshold": (1, "The entrance hall", "Someone left the light on."),
    "gallery": (2, "The whispering gallery", "The house knows your name."),
    "belfry": (3, "The sealed belfry", "Every promise has a price."),
    "reckoning": (4, "The heart of the house", "It is waiting for an answer."),
    "liberation": (5, "After the last heartbeat", "The house exhales."),
    "escape": (5, "After the last heartbeat", "You make it out. Mostly."),
    "inheritance": (5, "After the last heartbeat", "Welcome home, keeper."),
}
CHOICES = {
    "threshold": [option("take_key", "Take the brass key", "A way out, or a way further in."),
                  option("study_portrait", "Study the girl's portrait", "Someone scratched away her name."),
                  option("follow_steps", "Follow the small footprints", "They lead toward the sound of breathing.")],
    "gallery": [option("trust_child", "Promise to help the girl", "Promises have weight in this house."),
                option("read_ledger", "Read the black ledger", "Learn who owns the debt."),
                option("seek_exit", "Search for another exit", "Keep your distance from the mirror.")],
    "belfry": [option("free_ribbon", "Untie the girl's ribbon", "Break the anchor that keeps her here."),
               option("ring_bell", "Ring the silver bell", "Claim the keeper's authority."),
               option("open_window", "Unbolt the garden window", "Prepare a route out of the house.")],
    "reckoning": [option("release", "Lead the girl into the dawn", "Her anchor is broken. End the bargain together."),
                  option("leave", "Leave while you still can", "Survive, and carry the memory outside."),
                  option("accept", "Become the house's keeper", "Exchange your freedom for its power.")],
}
EFFECTS = {
    "take_key": ("key", "Brass key", "gallery"),
    "study_portrait": ("name", "Eleanor's name", "gallery"),
    "follow_steps": ("steps", "Silent passage", "gallery"),
    "trust_child": ("trust", "A promise to the girl", "belfry"),
    "read_ledger": ("debt", "The keeper's bargain", "belfry"),
    "seek_exit": ("exit", "Garden window located", "belfry"),
    "free_ribbon": ("ribbon", "Unbound ribbon", "reckoning"),
    "ring_bell": ("bell", "The bell's mark", "reckoning"),
    "open_window": ("window", "An open escape route", "reckoning"),
    "release": ("release", None, "liberation"),
    "leave": ("leave", None, "escape"),
    "accept": ("accept", None, "inheritance"),
}


def validate_memory(m: Memory) -> None:
    """Require facts, inventory and journal to describe the same legal server-owned route."""
    if m.persona not in ("archivist", "skeptic", "medium") or m.scene not in SCENES:
        raise ValueError("Unknown narrator or scene")
    completed = SCENES[m.scene][0] - 1
    history: list[Choice] = []
    for scene in ("threshold", "gallery", "belfry", "reckoning")[:completed]:
        selected = [choice for choice in CHOICES[scene] if EFFECTS[choice.id][0] in m.facts]
        if len(selected) != 1:
            raise ValueError("Story facts disagree with progress")
        history.extend(selected)
    if m.facts != {EFFECTS[choice.id][0] for choice in history}:
        raise ValueError("Story facts disagree with progress")
    expected_items = [EFFECTS[choice.id][1] for choice in history if EFFECTS[choice.id][1] is not None]
    if m.inventory != expected_items or m.journal != [choice.label for choice in history]:
        raise ValueError("Story inventory or journal disagrees with choices")
    if completed == 4:
        if EFFECTS[history[-1].id][2] != m.scene or (m.scene == "liberation" and "ribbon" not in m.facts):
            raise ValueError("Ending disagrees with the chosen route")


class DemoStoryProvider:
    def render(self, m: Memory) -> Scene:
        validate_memory(m)
        chapter, location, title = SCENES[m.scene]
        choices = [choice.model_copy(deep=True) for choice in CHOICES.get(m.scene, [])
                   if choice.id != "release" or "ribbon" in m.facts]
        return Scene(id=m.scene, chapter=chapter, location=location, title=title,
                     text=narrate(m), choices=choices, ending=m.scene if chapter == 5 else None)

    def choose(self, m: Memory, choice_id: str) -> None:
        selected = next((c for c in self.render(m).choices if c.id == choice_id), None)
        if selected is None:
            raise ValueError("That choice is not available in this scene.")
        fact, item, target = EFFECTS[choice_id]
        m.facts.add(fact)
        if item:
            m.inventory.append(item)
        m.journal.append(selected.label)
        m.scene = target
