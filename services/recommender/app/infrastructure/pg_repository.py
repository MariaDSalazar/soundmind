"""Adaptador de persistencia: implementa el puerto RecommendationRepository con
consultas de similitud coseno en pgvector (`<=>` = distancia coseno). Este es el
ÚNICO trabajo de IA en runtime — los embeddings los genera el batch (ADR-012)."""
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from ..domain.models import Reason, TrackReco

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

    def for_user(self, user_id: int, limit: int) -> tuple[bool, list[TrackReco]]:
        with self._pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT onboarded, taste_vec IS NOT NULL AS has_taste "
                    "FROM user_profiles WHERE user_id = %s",
                    (user_id,),
                )
                prof = cur.fetchone()
            if prof is None:
                return (False, [])  # sin perfil → la UI muestra onboarding
            onboarded, has_taste = prof
            if not has_taste:
                return (onboarded, [])

            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    f"""
                    SELECT {_TRACK_COLS},
                           1 - (e.content_vec <=> p.taste_vec) AS score
                    FROM user_profiles p
                    JOIN track_embeddings e ON TRUE
                    JOIN tracks t ON t.id = e.track_id
                    WHERE p.user_id = %s AND p.taste_vec IS NOT NULL
                      AND NOT EXISTS (
                        SELECT 1 FROM listen_events le
                        WHERE le.user_id = p.user_id AND le.track_id = t.id
                      )
                    ORDER BY e.content_vec <=> p.taste_vec
                    LIMIT %s
                    """,
                    (user_id, limit),
                )
                reason = Reason(type="taste", signal="content")
                return (onboarded, [_to_reco(r, reason) for r in cur.fetchall()])

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
