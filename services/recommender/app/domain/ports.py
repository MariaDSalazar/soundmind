"""Puertos (Ports & Adapters): el dominio define los contratos de datos; la
infraestructura (pgvector) los implementa. Los casos de uso dependen SOLO de esto."""
from typing import Protocol

from .models import TrackReco


class RecommendationRepository(Protocol):
    def top_genres(self, limit: int) -> list[str]:
        """Géneros más frecuentes del corpus (para el onboarding)."""
        ...

    def similar_to_track(self, track_id: str, limit: int) -> list[TrackReco]:
        """Vecinos por coseno del embedding del track ancla."""
        ...

    def for_user(self, user_id: int, limit: int) -> tuple[bool, list[TrackReco]]:
        """(onboarded, recomendaciones por taste_vec excluyendo lo ya escuchado)."""
        ...

    def seed_taste_from_genres(self, user_id: int, genres: list[str]) -> bool:
        """Siembra taste_vec = centroide de embeddings de esos géneros.
        Devuelve True si hubo corpus para sembrar (taste_vec no nulo)."""
        ...
