"""Composition root del Recommender (Hexagonal): arma pool pgvector → repositorio
→ casos de uso → rutas. El servicio NO embebe (sin torch); solo consulta coseno."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pgvector.psycopg import register_vector
from psycopg_pool import ConnectionPool

from .application.use_cases import (
    GetRecommendationsForUser,
    GetSimilarTracks,
    ListGenres,
    OnboardUser,
)
from .config import get_settings
from .infrastructure.pg_repository import PgRecommendationRepository
from .interfaces.routes import build_router

settings = get_settings()

# Pool de conexiones (singleton controlado vía DI). `configure` registra el tipo
# vector en CADA conexión nueva para que pgvector devuelva/acepte numpy arrays.
pool = ConnectionPool(
    settings.DATABASE_URL,
    min_size=1,
    max_size=5,
    open=False,
    configure=register_vector,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(title="SoundMind Recommender", version="1.0.0", lifespan=lifespan)

repo = PgRecommendationRepository(pool)
app.include_router(
    build_router(
        similar=GetSimilarTracks(repo),
        for_me=GetRecommendationsForUser(repo),
        onboard=OnboardUser(repo),
        genres=ListGenres(repo),
    )
)


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "recommender"}
