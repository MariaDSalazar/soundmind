"""Adaptador de persistencia: implementa el puerto RecommendationRepository con
consultas de similitud coseno en pgvector (`<=>` = distancia coseno). Este es el
ÚNICO trabajo de IA en runtime — los embeddings los genera el batch (ADR-012)."""
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from ..domain.models import Candidate, Reason, TrackReco

# Columnas de `tracks` + score; orden fijo para mapear a TrackReco.
_TRACK_COLS = """
  t.id, t.source, t.source_track_id, t.title, t.artist, t.genre_tags,
  t.duration_s, t.stream_url, t.artwork_url, t.is_preview
"""


def _to_reco(row: dict, reason: Reason) -> TrackReco:
    return TrackReco(
        id=row["id"],
        source=row["source"],
        sourceTrackId=row["source_track_id"],
        title=row["title"],
        artist=row["artist"],
        durationS=row["duration_s"],
        streamUrl=row["stream_url"],
        artworkUrl=row["artwork_url"],
        genreTags=row["genre_tags"] or [],
        isPreview=row["is_preview"],
        score=float(row["score"]),
        reason=reason,
    )


def _to_candidate(row: dict) -> Candidate:
    return Candidate(
        id=row["id"],
        source=row["source"],
        sourceTrackId=row["source_track_id"],
        title=row["title"],
        artist=row["artist"],
        durationS=row["duration_s"],
        streamUrl=row["stream_url"],
        artworkUrl=row["artwork_url"],
        genreTags=row["genre_tags"] or [],
        isPreview=row["is_preview"],
        content_score=row["content_score"],
        collab_score=row["collab_score"],
        avg_hour=row["avg_hour"],
        recently_skipped=row["recently_skipped"],
    )


class PgRecommendationRepository:
    def __init__(self, pool: ConnectionPool):
        self._pool = pool

    def top_genres(self, limit: int) -> list[str]:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT g AS genre
                FROM tracks t, unnest(t.genre_tags) AS g
                WHERE g <> ''
                GROUP BY g
                ORDER BY count(*) DESC, g
                LIMIT %s
                """,
                (limit,),
            )
            return [r[0] for r in cur.fetchall()]

    def similar_to_track(self, track_id: str, limit: int) -> list[TrackReco]:
        with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                SELECT {_TRACK_COLS},
                       1 - (e.content_vec <=> anchor.content_vec) AS score
                FROM track_embeddings anchor
                JOIN track_embeddings e ON e.track_id <> anchor.track_id
                JOIN tracks t ON t.id = e.track_id
                WHERE anchor.track_id = %s
                ORDER BY e.content_vec <=> anchor.content_vec
                LIMIT %s
                """,
                (track_id, limit),
            )
            reason = Reason(type="similar_track", signal="tags", anchor=track_id)
            return [_to_reco(r, reason) for r in cur.fetchall()]

    def candidates_for_user(self, user_id: int, pool: int) -> tuple[bool, list[Candidate]]:
        with self._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT onboarded FROM user_profiles WHERE user_id = %s", (user_id,))
                prof = cur.fetchone()
            if prof is None:
                return (False, [])  # sin perfil → la UI muestra onboarding
            onboarded = prof[0]

            # Una sola query trae ambas señales (coseno de contenido + producto
            # interno colaborativo) y el contexto. Las subconsultas escalares de
            # taste_vec/factors dan NULL si el usuario no tiene esa señal → el
            # ranker hace fallback. Se excluye lo ya reproducido/completado.
            # Subconsulta: el ORDER BY pre-filtra por la suma de señales, pero un
            # alias de salida no puede usarse DENTRO de una expresión del ORDER BY
            # (Postgres lo tomaría como columna de entrada) → se envuelve.
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    f"""
                    SELECT * FROM (
                      SELECT {_TRACK_COLS},
                        CASE WHEN e.content_vec IS NOT NULL THEN
                          1 - (e.content_vec <=> (SELECT taste_vec FROM user_profiles WHERE user_id = %(uid)s))
                        END AS content_score,
                        CASE WHEN f.factors IS NOT NULL THEN
                          -(f.factors <#> (SELECT factors FROM user_factors WHERE user_id = %(uid)s))
                        END AS collab_score,
                        ts.avg_hour,
                        EXISTS (
                          SELECT 1 FROM listen_events le
                          WHERE le.user_id = %(uid)s AND le.track_id = t.id AND le.event_type = 'skip'
                        ) AS recently_skipped
                      FROM tracks t
                      LEFT JOIN track_embeddings e ON e.track_id = t.id
                      LEFT JOIN track_factors f ON f.track_id = t.id
                      LEFT JOIN track_stats ts ON ts.track_id = t.id
                      WHERE NOT EXISTS (
                        SELECT 1 FROM listen_events le
                        WHERE le.user_id = %(uid)s AND le.track_id = t.id
                          AND le.event_type IN ('play', 'complete')
                      )
                        AND (e.content_vec IS NOT NULL OR f.factors IS NOT NULL)
                    ) q
                    ORDER BY COALESCE(q.content_score, 0) + COALESCE(q.collab_score, 0) DESC
                    LIMIT %(pool)s
                    """,
                    {"uid": user_id, "pool": pool},
                )
                return (onboarded, [_to_candidate(r) for r in cur.fetchall()])

    def seed_taste_from_genres(self, user_id: int, genres: list[str]) -> bool:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_profiles (user_id, taste_vec, onboarded, updated_at)
                VALUES (
                  %s,
                  (SELECT avg(e.content_vec)
                   FROM track_embeddings e JOIN tracks t ON t.id = e.track_id
                   WHERE t.genre_tags && %s::text[]),
                  TRUE, now()
                )
                ON CONFLICT (user_id) DO UPDATE
                  -- COALESCE: no borrar un taste existente si los géneros nuevos
                  -- aún no tienen corpus embebido.
                  SET taste_vec = COALESCE(EXCLUDED.taste_vec, user_profiles.taste_vec),
                      onboarded = TRUE, updated_at = now()
                RETURNING taste_vec IS NOT NULL AS seeded
                """,
                (user_id, genres),
            )
            row = cur.fetchone()
            conn.commit()
            return bool(row[0]) if row else False
