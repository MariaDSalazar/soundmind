"""Rutas HTTP (borde). Validación con Pydantic; los casos de uso hacen el trabajo.
Montadas tras el gateway en /api/v1/recommendations (ver buildRecommenderProxyRoutes)."""
from fastapi import APIRouter, Depends, Query

from ..application.use_cases import (
    GetRecommendationsForUser,
    GetSimilarTracks,
    ListGenres,
    OnboardUser,
)
from ..domain.models import ForMeResponse, OnboardingInput, OnboardingResult, TrackReco
from ..infrastructure.auth import current_user_id


def build_router(
    similar: GetSimilarTracks,
    for_me: GetRecommendationsForUser,
    onboard: OnboardUser,
    genres: ListGenres,
) -> APIRouter:
    router = APIRouter(prefix="/recommendations", tags=["recommendations"])

    @router.get("/similar/{track_id:path}", response_model=list[TrackReco])
    def get_similar(track_id: str, limit: int = Query(10, ge=1, le=50)):
        # track_id es "<source>:<id>" (lleva ':') — :path permite los dos puntos.
        return similar.execute(track_id, limit)

    @router.get("/onboarding/genres", response_model=list[str])
    def get_genres(limit: int = Query(30, ge=1, le=50)):
        return genres.execute(limit)

    @router.post("/onboarding", response_model=OnboardingResult)
    def post_onboarding(body: OnboardingInput, user_id: int = Depends(current_user_id)):
        return onboard.execute(user_id, body.genres)

    @router.get("/for-me", response_model=ForMeResponse)
    def get_for_me(
        limit: int = Query(20, ge=1, le=50), user_id: int = Depends(current_user_id)
    ):
        return for_me.execute(user_id, limit)

    return router
