"""Casos de uso del Recommender v1. Orquestan el repositorio (puerto) sin saber
que detrás hay pgvector — inversión de dependencias en práctica."""
from ..domain.models import ForMeResponse, OnboardingResult, TrackReco
from ..domain.ports import RecommendationRepository

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
    """'Para ti': recomendaciones por taste_vec, excluyendo lo ya escuchado."""

    def __init__(self, repo: RecommendationRepository):
        self._repo = repo

    def execute(self, user_id: int, limit: int = 20) -> ForMeResponse:
        onboarded, tracks = self._repo.for_user(user_id, _clamp(limit, 20))
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
