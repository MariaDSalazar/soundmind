"""Tests de los casos de uso (application) con un repositorio fake — sin DB."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.application.use_cases import (  # noqa: E402
    MAX_LIMIT,
    GetRecommendationsForUser,
    GetSimilarTracks,
    ListGenres,
    OnboardUser,
)
from app.domain.models import Candidate, Reason, TrackReco  # noqa: E402


class FakeRepo:
    def __init__(self, *, onboarded=True, candidates=None, similar=None, genres=None, seeded=True):
        self._onboarded = onboarded
        self._candidates = candidates or []
        self._similar = similar or []
        self._genres = genres or []
        self._seeded = seeded
        self.calls = {}

    def top_genres(self, limit):
        self.calls["top_genres"] = limit
        return self._genres[:limit]

    def similar_to_track(self, track_id, limit):
        self.calls["similar"] = (track_id, limit)
        return self._similar[:limit]

    def candidates_for_user(self, user_id, pool):
        self.calls["candidates"] = (user_id, pool)
        return (self._onboarded, self._candidates)

    def seed_taste_from_genres(self, user_id, genres):
        self.calls["seed"] = (user_id, genres)
        return self._seeded


def _cand(id_, content=0.5):
    return Candidate(id=id_, source="audius", sourceTrackId=id_.split(":")[-1], title=id_, content_score=content)


def _reco(id_):
    return TrackReco(id=id_, source="audius", sourceTrackId=id_, title=id_, score=0.9,
                     reason=Reason(type="similar_track", signal="tags"))


def test_get_similar_clamps_al_maximo():
    repo = FakeRepo(similar=[_reco("a")])
    out = GetSimilarTracks(repo).execute("audius:1", limit=999)
    assert repo.calls["similar"][1] == MAX_LIMIT  # 50
    assert len(out) == 1


def test_get_similar_default_si_limit_no_positivo():
    repo = FakeRepo()
    GetSimilarTracks(repo).execute("audius:1", limit=0)
    assert repo.calls["similar"][1] == 10  # default


def test_list_genres_respeta_limite():
    repo = FakeRepo(genres=["rock", "lofi", "jazz"])
    assert ListGenres(repo).execute(limit=2) == ["rock", "lofi"]


def test_onboard_devuelve_resultado_y_propaga_generos():
    repo = FakeRepo(seeded=True)
    res = OnboardUser(repo).execute(7, ["rock", "lofi"])
    assert res.onboarded is True and res.tasteSeeded is True
    assert repo.calls["seed"] == (7, ["rock", "lofi"])


def test_for_user_sin_onboarding_devuelve_vacio():
    repo = FakeRepo(onboarded=False, candidates=[])
    res = GetRecommendationsForUser(repo).execute(1, hour=12, limit=10)
    assert res.onboarded is False and res.tracks == []


def test_for_user_rankea_candidatos_y_pide_pool_amplio():
    repo = FakeRepo(candidates=[_cand("audius:a", 0.9), _cand("audius:b", 0.2)])
    res = GetRecommendationsForUser(repo).execute(1, hour=12, limit=10)
    assert res.onboarded is True
    assert [t.id for t in res.tracks] == ["audius:a", "audius:b"]
    assert repo.calls["candidates"][1] == 40  # pool = max(limit*4, 40)
