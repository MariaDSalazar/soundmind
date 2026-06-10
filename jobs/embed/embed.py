"""
Job batch de embeddings del Recommender v1 (F3). Corre en GitHub Actions (cron),
NO en Render: aquí sí cabe torch (ver ADR-012). Tres pasos idempotentes:

  1. INGESTA  — puebla `tracks` desde los snapshots JSONB de `listen_events`
                (event sourcing de F2). Corpus = lo realmente reproducido.
  2. EMBED    — para cada track SIN embedding, genera el vector 384-d con
                sentence-transformers y lo guarda en `track_embeddings`.
  3. TASTE    — recalcula `user_profiles.taste_vec` como centroide PONDERADO de
                los embeddings de lo que cada usuario reprodujo/likeó (§6.1/§6.4).

Solo necesita la variable de entorno DATABASE_URL (GitHub Secret).
"""
import os
import sys

import numpy as np
import psycopg
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"  # 384-d (coincide con vector(384))
EMBED_BATCH = 64

# Pesos del feedback implícito para el centroide de gustos (§6.1).
EVENT_WEIGHTS = {"complete": 1.0, "play": 0.5, "skip": -0.5}
LIKE_WEIGHT = 2.0


def track_text(title: str, artist: str | None, genre_tags: list[str]) -> str:
    """Texto que se embebe: lo que define el 'sonido' por contenido-texto."""
    generos = ", ".join(genre_tags) if genre_tags else "sin etiquetas"
    artista = artist or "artista desconocido"
    return f"{title} — {artista}. Géneros: {generos}"


def ingest_tracks(conn) -> int:
    """Upsert de `tracks` desde los snapshots de listen_events (idempotente)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tracks
              (id, source, source_track_id, title, artist, genre_tags,
               duration_s, stream_url, artwork_url, is_preview)
            SELECT DISTINCT ON (track->>'id')
              track->>'id', track->>'source', track->>'sourceTrackId',
              track->>'title', track->>'artist',
              ARRAY(SELECT jsonb_array_elements_text(track->'genreTags')),
              (track->>'durationS')::int, track->>'streamUrl', track->>'artworkUrl',
              COALESCE((track->>'isPreview')::boolean, false)
            FROM listen_events
            WHERE track IS NOT NULL AND track->>'id' IS NOT NULL
              -- Solo fuentes libres/legales (ADR-011): no ingerir restos de
              -- pruebas con fuentes retiradas (deezer/saavn) al corpus del recomendador.
              AND track->>'source' IN ('jamendo', 'audius', 'archive')
              -- Solo URLs reproducibles (https + host con dominio + ruta): descarta
              -- pistas de prueba con stream_url falso (example.org, https://x/...).
              AND track->>'streamUrl' LIKE 'https://%.%/%'
              AND track->>'streamUrl' NOT LIKE '%example.%'
            ORDER BY track->>'id', created_at DESC
            ON CONFLICT (id) DO NOTHING
            """
        )
        return cur.rowcount


def embed_missing(conn, model) -> int:
    """Embebe los tracks que aún no tienen vector. Devuelve cuántos embebió."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.id, t.title, t.artist, t.genre_tags
            FROM tracks t
            LEFT JOIN track_embeddings e ON e.track_id = t.id
            WHERE e.track_id IS NULL
            """
        )
        pending = cur.fetchall()

    if not pending:
        return 0

    total = 0
    for start in range(0, len(pending), EMBED_BATCH):
        chunk = pending[start : start + EMBED_BATCH]
        texts = [track_text(title, artist, tags) for _id, title, artist, tags in chunk]
        # normalize_embeddings=True → norma 1, así el coseno es estable.
        vectors = model.encode(texts, normalize_embeddings=True, batch_size=EMBED_BATCH)
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO track_embeddings (track_id, content_vec, model_version)
                VALUES (%s, %s, %s)
                ON CONFLICT (track_id) DO UPDATE
                  SET content_vec = EXCLUDED.content_vec,
                      model_version = EXCLUDED.model_version,
                      updated_at = now()
                """,
                [
                    (row[0], np.asarray(vec, dtype=np.float32), MODEL_NAME)
                    for row, vec in zip(chunk, vectors)
                ],
            )
        total += len(chunk)
    return total


def refresh_taste_vectors(conn) -> int:
    """
    Recalcula taste_vec por usuario = centroide ponderado de los embeddings de sus
    tracks. Solo toca usuarios con ≥1 track embebido (no pisa el taste del
    onboarding de quien aún no ha escuchado nada). Devuelve usuarios actualizados.
    """
    with conn.cursor() as cur:
        # (user_id, track_id, peso) combinando eventos de escucha y likes, solo
        # para tracks que ya tienen embedding.
        cur.execute(
            """
            SELECT s.user_id, s.track_id, s.weight, e.content_vec
            FROM (
              SELECT le.user_id, le.track_id,
                     CASE le.event_type
                       WHEN 'complete' THEN %s WHEN 'play' THEN %s ELSE %s END AS weight
              FROM listen_events le
              UNION ALL
              SELECT l.user_id, l.track_id, %s FROM likes l
            ) s
            JOIN track_embeddings e ON e.track_id = s.track_id
            """,
            (EVENT_WEIGHTS["complete"], EVENT_WEIGHTS["play"], EVENT_WEIGHTS["skip"], LIKE_WEIGHT),
        )
        rows = cur.fetchall()

    # Acumular suma ponderada de vectores por usuario.
    acc: dict[int, list] = {}
    for user_id, _track_id, weight, vec in rows:
        v = np.asarray(vec, dtype=np.float32) * float(weight)
        if user_id in acc:
            acc[user_id][0] += v
            acc[user_id][1] += abs(float(weight))
        else:
            acc[user_id] = [v, abs(float(weight))]

    updated = 0
    with conn.cursor() as cur:
        for user_id, (vsum, wsum) in acc.items():
            if wsum <= 0:
                continue
            centroid = vsum / wsum
            norm = np.linalg.norm(centroid)
            if norm == 0:
                continue
            centroid = centroid / norm  # normalizado para coseno
            cur.execute(
                """
                INSERT INTO user_profiles (user_id, taste_vec, updated_at)
                VALUES (%s, %s, now())
                ON CONFLICT (user_id) DO UPDATE
                  SET taste_vec = EXCLUDED.taste_vec, updated_at = now()
                """,
                (user_id, centroid.astype(np.float32)),
            )
            updated += 1
    return updated


def main() -> int:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("ERROR: falta DATABASE_URL", file=sys.stderr)
        return 1

    print(f"Cargando modelo {MODEL_NAME}…")
    model = SentenceTransformer(MODEL_NAME)

    with psycopg.connect(dsn, autocommit=False) as conn:
        register_vector(conn)

        ingested = ingest_tracks(conn)
        conn.commit()
        print(f"INGESTA: {ingested} tracks nuevos en `tracks`")

        embedded = embed_missing(conn, model)
        conn.commit()
        print(f"EMBED:   {embedded} tracks embebidos")

        tastes = refresh_taste_vectors(conn)
        conn.commit()
        print(f"TASTE:   {tastes} perfiles de gusto actualizados")

    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
