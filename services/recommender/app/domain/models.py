"""Modelos de dominio / contrato de API (Pydantic). Los campos van en camelCase
para que el JSON sea idéntico al tipo `Track` de @soundmind/shared y el frontend
los reutilice sin mapear."""
from pydantic import BaseModel, Field


class Reason(BaseModel):
    """Explicabilidad (§6.5): la UI lo traduce a 'Porque escuchaste X'."""

    type: str  # "similar_track" | "taste"
    signal: str  # "tags" | "content"
    anchor: str | None = None  # trackId ancla (en 'similar_track')


class TrackReco(BaseModel):
    """Una pista recomendada: forma de `Track` + score + reason."""

    id: str
    source: str
    sourceTrackId: str
    title: str
    artist: str | None = None
    durationS: int | None = None
    streamUrl: str | None = None
    artworkUrl: str | None = None
    genreTags: list[str] = Field(default_factory=list)
    isPreview: bool = False
    score: float
    reason: Reason


class ForMeResponse(BaseModel):
    """`onboarded=False` → la UI muestra el onboarding de géneros (cold start)."""

    onboarded: bool
    tracks: list[TrackReco]


class OnboardingInput(BaseModel):
    """El usuario elige 3–5 géneros para sembrar su taste_vec (§6.6)."""

    genres: list[str] = Field(min_length=1, max_length=10)


class OnboardingResult(BaseModel):
    onboarded: bool
    # False si ningún track del corpus cubre esos géneros todavía (taste_vec nulo).
    tasteSeeded: bool
