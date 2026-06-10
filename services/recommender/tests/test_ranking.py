"""Tests del ranker híbrido (F4) — lógica pura, sin DB. Ejecuta con `pytest`."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.application.ranking import rank_candidates  # noqa: E402
from app.domain.models import Candidate  # noqa: E402


def _cand(id_, content=None, collab=None, avg_hour=None, skipped=False):
    return Candidate(
        id=id_, source="audius", sourceTrackId=id_.split(":")[-1], title=id_,
        content_score=content, collab_score=collab, avg_hour=avg_hour, recently_skipped=skipped,
    )


def test_descarta_candidatos_sin_ninguna_senal():
    cands = [_cand("audius:a"), _cand("audius:b", content=0.9)]
    out = rank_candidates(cands, hour=12, limit=10)
    assert [t.id for t in out] == ["audius:b"]  # 'a' sin señal se descarta


def test_fallback_a_contenido_cuando_no_hay_colaborativo():
    cands = [_cand("audius:a", content=0.2), _cand("audius:b", content=0.9)]
    out = rank_candidates(cands, hour=12, limit=10)
    assert [t.id for t in out] == ["audius:b", "audius:a"]
    assert out[0].reason.type == "taste"  # sin colaborativo → razón de contenido


def test_la_senal_colaborativa_dominante_marca_la_razon():
    # Mismo contenido; 'b' tiene fuerte señal colaborativa → razón colaborativa y arriba.
    cands = [
        _cand("audius:a", content=0.8, collab=0.0),
        _cand("audius:b", content=0.8, collab=5.0),
    ]
    out = rank_candidates(cands, hour=12, limit=10)
    assert out[0].id == "audius:b"
    assert out[0].reason.type == "collaborative"


def test_penaliza_skip_reciente():
    # Pool realista (≥3 para que min-max no sea degenerado): 'a' tiene el mejor
    # contenido pero fue skipeado → cae por debajo de 'b' por el castigo (−0.30).
    cands = [
        _cand("audius:a", content=0.82, skipped=True),
        _cand("audius:b", content=0.80),
        _cand("audius:c", content=0.50),
    ]
    out = rank_candidates(cands, hour=12, limit=10)
    assert out[0].id == "audius:b"
    assert out.index(next(t for t in out if t.id == "audius:a")) > 0  # 'a' no es el top


def test_afinidad_de_hora_anota_el_contexto_y_sube():
    cands = [
        _cand("audius:noche", content=0.6, avg_hour=23),
        _cand("audius:manana", content=0.6, avg_hour=8),
    ]
    out = rank_candidates(cands, hour=23, limit=10)
    assert out[0].id == "audius:noche"
    assert out[0].reason.context is not None  # nota contextual presente
