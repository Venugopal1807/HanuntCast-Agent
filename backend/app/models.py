from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

Persona = Literal["archivist", "skeptic", "medium"]
MAX_NARRATION_CHARACTERS = 1500


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class StartRequest(StrictModel):
    persona: Persona
    request_id: UUID


class ChoiceRequest(StrictModel):
    choice_id: str = Field(min_length=1, max_length=40, pattern=r"^[a-z_]+$")
    revision: int = Field(ge=0, le=10, strict=True)
    request_id: UUID


class Choice(StrictModel):
    id: str
    label: str
    hint: str


class Scene(StrictModel):
    id: str
    chapter: int
    location: str
    title: str
    text: str = Field(min_length=1, max_length=MAX_NARRATION_CHARACTERS)
    choices: list[Choice]
    ending: Literal["liberation", "escape", "inheritance"] | None = None

    @model_validator(mode="after")
    def consistent_scene(self):
        chapters = {"threshold": 1, "gallery": 2, "belfry": 3, "reckoning": 4,
                    "liberation": 5, "escape": 5, "inheritance": 5}
        if chapters.get(self.id) != self.chapter:
            raise ValueError("Scene identity and chapter disagree")
        if self.chapter == 5:
            if self.ending != self.id or self.choices:
                raise ValueError("An ending must be final")
        elif self.ending is not None or not 2 <= len(self.choices) <= 3:
            raise ValueError("An active scene must offer two or three choices")
        if len({c.id for c in self.choices}) != len(self.choices):
            raise ValueError("Choice IDs must be unique")
        return self


class SessionView(StrictModel):
    id: UUID
    persona: Persona
    revision: int
    scene: Scene
    inventory: list[str]
    journal: list[str]
    story_mode: Literal["deterministic-demo"] = "deterministic-demo"
    voice_mode: Literal["mock", "live", "unavailable"] = "mock"

    @model_validator(mode="after")
    def consistent_memory(self):
        if self.revision != self.scene.chapter - 1 or len(self.journal) != self.revision:
            raise ValueError("Scene revision and journal disagree")
        if len(self.inventory) != min(3, self.revision) or len(set(self.inventory)) != len(self.inventory):
            raise ValueError("Inventory does not match story progress")
        return self


class AuthView(StrictModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class CapabilitiesView(StrictModel):
    story: Literal["deterministic-demo"] = "deterministic-demo"
    voice: Literal["mock", "live", "unavailable"]
    assemblyai_available: bool = False
    live_ttfa_ms: None = None
    reason: str
