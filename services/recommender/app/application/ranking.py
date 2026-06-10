"""Ranker híbrido (F4): combina las señales de contenido (F3) y colaborativo
(ALS) y aplica un re-ranking contextual heurístico (§6.3). Lógica de dominio
PURA y testeable — no toca la base de datos."""
from ..domain.models import Candidate, Reason, TrackReco

# Mezcla contenido/colaborativo (ADR-013). Iguales por defecto.
ALPHA_CONTENT = 0.5
BETA_COLLAB = 0.5
# Pesos del re-ranking contextual (pequeños: ajustan el orden, no lo dominan).
W_HOUR = 0.15
W_SKIP = 0.30


def _minmax_norm(values: dict[str, float]) -> dict[str, float]:
    """Normaliza a [0,1] por min-max para que contenido y colaborativo (escalas
    distintas) sean comparables. Si todos son iguales, todos valen 1.0."""
    if not values:
        return {}
    lo, hi = min(values.values()), max(values.values())
    if hi <= lo:
        return {k: 1.0 for k in values}
    return {k: (v - lo) / (hi - lo) for k, v in values.items()}


def _hour_distance(a: float, b: float) -> float:
    """Distancia circular en horas (0..12)."""
    d = abs(a - b) % 24
    return min(d, 24 - d)


def rank_candidates(
    candidates: list[Candidate], hour: int, limit: int
) -> list[TrackReco]:
    content_raw = {c.id: c.content_score for c in candidates if c.content_score is not None}
    collab_raw = {c.id: c.collab_score for c in candidates if c.collab_score is not None}
    content_n = _minmax_norm(content_raw)
    collab_n = _minmax_norm(collab_raw)

    scored: list[tuple[float, TrackReco]] = []
    for c in candidates:
        cn = content_n.get(c.id, 0.0)
        kn = collab_n.get(c.id, 0.0)
        # Si ninguna señal aplica al track, no es recomendable.
        if c.id not in content_n and c.id not in collab_n:
            continue

        content_contrib = ALPHA_CONTENT * cn
        collab_contrib = BETA_COLLAB * kn
        base = content_contrib + collab_contrib

        # Re-ranking contextual (§6.3): afinidad de hora + castigo a skips.
        context_note: str | None = None
        if c.avg_hour is not None:
            affinity = 1 - _hour_distance(hour, c.avg_hour) / 12  # 0..1
            if affinity > 0:
                base += W_HOUR * affinity
            if affinity >= 0.75:
                context_note = "A esta hora sueles escuchar esto"
        if c.recently_skipped:
            base -= W_SKIP

        # La señal DOMINANTE decide la explicación (§6.5).
        if c.id in collab_n and collab_contrib >= content_contrib:
            reason = Reason(type="collaborative", signal="als", context=context_note)
        else:
            reason = Reason(type="taste", signal="content", context=context_note)

        reco = TrackReco(
            id=c.id,
            source=c.source,
            sourceTrackId=c.sourceTrackId,
            title=c.title,
            artist=c.artist,
            durationS=c.durationS,
            streamUrl=c.streamUrl,
            artworkUrl=c.artworkUrl,
            genreTags=c.genreTags,
            isPreview=c.isPreview,
            score=max(0.0, min(1.0, base)),
            reason=reason,
        )
        scored.append((base, reco))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [reco for _, reco in scored[:limit]]
