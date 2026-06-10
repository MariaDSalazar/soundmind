"""Casos de uso del Recommender v1. Orquestan el repositorio (puerto) sin saber
que detrás hay pgvector — inversión de dependencias en práctica."""
from ..domain.models import ForMeResponse, OnboardingResult, TrackReco
from ..domain.ports import RecommendationRepository
from .ranking import rank_candidates

MAX_LIMIT = 50


def _clamp(limit: int, default: int) -> int:
    if limit <= 0:
        return default
    return min(limit, MAX_LIMIT)


class GetSimilarTracks:
    """'Más como esta': vecinos por contenido del track ancla."""

    def __init__(self, repo: RecommendationRepository):
        self._repo = repo

    def execute(self, track_id: str, limit: int = 10) -> list[TrackReco]:
        return self._repo.similar_to_track(track_id, _clamp(limit, 10))


class GetRecommendationsForUser:
    """'Para ti' HÍBRIDO (F4): mezcla contenido (F3) + colaborativo (ALS) y
    re-rankea por contexto (hora, skips). Cae a contenido cuando no hay señal
    colaborativa. `hour` es la hora local del cliente (0..23) para el contexto."""

    def __init__(self, repo: RecommendationRepository):
        self._repo = repo

    def execute(self, user_id: int, hour: int, limit: int = 20) -> ForMeResponse:
        clamped = _clamp(limit, 20)
        # Pool de candidatos más amplio que el límite: el ranker re-ordena dentro.
        onboarded, candidates = self._repo.candidates_for_user(user_id, pool=max(clamped * 4, 40))
        tracks = rank_candidates(candidates, hour=hour, limit=clamped)
        return ForMeResponse(onboarded=onboarded, tracks=tracks)


class OnboardUser:
    """Cold-start (§6.6): siembra el gusto a partir de los géneros elegidos."""

    def __init__(self, repo: RecommendationRepository):
        self._repo = repo

    def execute(self, user_id: int, genres: list[str]) -> OnboardingResult:
        seeded = self._repo.seed_taste_from_genres(user_id, genres)
        # Se marca onboarded aunque no haya corpus aún (no re-preguntar); las
        # recomendaciones llegarán cuando el batch embeba tracks de esos géneros.
        return OnboardingResult(onboarded=True, tasteSeeded=seeded)


class ListGenres:
    """Géneros disponibles en el corpus para el selector de onboarding."""

    def __init__(self, repo: RecommendationRepository):
        self._repo = repo

    def execute(self, limit: int = 30) -> list[str]:
        return self._repo.top_genres(_clamp(limit, 30))
