from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ShortText = Annotated[str, Field(max_length=500)]
TraitKey = Literal[
    "visual_identity",
    "lighting",
    "linework",
    "texture",
    "shapes",
    "composition",
    "background",
    "rendering",
]
TRAIT_KEYS = (
    "visual_identity",
    "lighting",
    "linework",
    "texture",
    "shapes",
    "composition",
    "background",
    "rendering",
)
AssetId = Annotated[str, Field(pattern=r"^[a-f0-9]{32}$")]


def now() -> str:
    return datetime.now(UTC).isoformat()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Trait(StrictModel):
    value: str = Field(default="", max_length=2000)
    source: Literal["measurement", "ollama", "user"] = "user"


def empty_traits() -> dict[str, Trait]:
    return {key: Trait() for key in TRAIT_KEYS}


class PaletteColor(StrictModel):
    hex: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    share: float = Field(ge=0, le=1)

    @field_validator("hex")
    @classmethod
    def uppercase(cls, value: str) -> str:
        return value.upper()


class Measurements(StrictModel):
    palette: list[PaletteColor] = Field(max_length=12)
    luminance: float = Field(ge=0, le=1)
    saturation: float = Field(ge=0, le=1)
    contrast: float = Field(ge=0, le=1)
    edge_density: float = Field(ge=0, le=1)
    texture: float = Field(ge=0)


class Reference(StrictModel):
    id: AssetId
    filename: str = Field(max_length=255)
    width: int = Field(gt=0, le=40_000_000)
    height: int = Field(gt=0, le=40_000_000)
    format: Literal["PNG", "JPEG", "WEBP"]
    bytes: int = Field(ge=0)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class ReferenceObservation(StrictModel):
    reference_id: AssetId
    measurements: Measurements
    traits: dict[TraitKey, Trait] = Field(default_factory=empty_traits)


class AnalysisResult(StrictModel):
    mode: Literal["measurements", "ollama"]
    model: str | None = Field(default=None, max_length=200)
    palette: list[PaletteColor] = Field(default_factory=list, max_length=12)
    traits: dict[TraitKey, Trait] = Field(default_factory=empty_traits)
    positive_rules: list[ShortText] = Field(default_factory=list, max_length=32)
    negative_constraints: list[ShortText] = Field(default_factory=list, max_length=32)
    subject_exclusions: list[ShortText] = Field(default_factory=list, max_length=32)
    observations: list[ReferenceObservation] = Field(default_factory=list, max_length=20)
    analyzed_at: str = Field(default_factory=now, max_length=64)


class StyleProfile(StrictModel):
    schema_version: Literal[1] = 1
    id: AssetId = Field(default_factory=lambda: uuid4().hex)
    name: str = Field(default="Untitled style", min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    category: str = Field(default="Uncategorized", max_length=64)
    tags: list[Annotated[str, Field(min_length=1, max_length=48)]] = Field(
        default_factory=list, max_length=20
    )
    favorite: bool = False
    palette: list[PaletteColor] = Field(default_factory=list, max_length=12)
    traits: dict[TraitKey, Trait] = Field(default_factory=empty_traits)
    positive_rules: list[ShortText] = Field(default_factory=list, max_length=32)
    negative_constraints: list[ShortText] = Field(default_factory=list, max_length=32)
    subject_exclusions: list[ShortText] = Field(default_factory=list, max_length=32)
    reference_ids: list[AssetId] = Field(default_factory=list, max_length=20)
    analysis: AnalysisResult | None = None
    created_at: str = Field(default_factory=now, max_length=64)
    updated_at: str = Field(default_factory=now, max_length=64)

    @model_validator(mode="after")
    def analysis_matches_references(self):
        if self.analysis and not {o.reference_id for o in self.analysis.observations}.issubset(
            self.reference_ids
        ):
            raise ValueError("Analysis contains references outside this style; analyze again")
        return self

    @field_validator("name")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name cannot be blank")
        return value.strip()

    @field_validator("reference_ids", "tags")
    @classmethod
    def unique(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))
