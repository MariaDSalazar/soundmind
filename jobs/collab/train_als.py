"""
Batch colaborativo del Recommender v2 (F4). Corre en GitHub Actions (cron), NO en
Render. Dos pasos idempotentes:

  1. ALS    — entrena filtrado colaborativo sobre feedback implícito (lib
              `implicit`) y escribe los factores latentes (user_factors /
              track_factors). El serving solo hace producto interno en pgvector.
  2. STATS  — recalcula track_stats (play_count, avg_hour) para el re-ranking
              contextual (§6.3).

Pesos del feedback implícito (§6.1): like 2.0, complete 1.0, play 0.5. Los SKIPS
no entran en la matriz (confianza negativa rompe ALS) — son señal del contexto.

Solo necesita DATABASE_URL (GitHub Secret).
"""
import os
import sys

# Evita el warning de OpenBLAS y resultados no deterministas por threading.
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

import numpy as np
import psycopg
from pgvector.psycopg import register_vector
from scipy.sparse import csr_matrix
from implicit.als import AlternatingLeastSquares

FACTORS = 32
MODEL_VERSION = "als-v1-k32"
EVENT_WEIGHTS = {"complete": 1.0, "play": 0.5}  # skips fuera (van al contexto)
LIKE_WEIGHT = 2.0


def fetch_interactions(conn):
    """(user_id, track_id, peso) agregado, solo interacciones positivas."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.user_id, s.track_id, SUM(s.weight) AS w
            FROM (
              SELECT user_id, track_id,
                     CASE event_type WHEN 'complete' THEN %s WHEN 'play' THEN %s ELSE 0 END AS weight
              FROM listen_events WHERE event_type IN ('play', 'complete')
              UNION ALL
              SELECT user_id, track_id, %s FROM likes
            ) s
            JOIN tracks t ON t.id = s.track_id   -- solo tracks del catálogo (FK)
            GROUP BY s.user_id, s.track_id
            HAVING SUM(s.weight) > 0
            """,
            (EVENT_WEIGHTS["complete"], EVENT_WEIGHTS["play"], LIKE_WEIGHT),
        )
        return cur.fetchall()


def train_and_store_factors(conn) -> tuple[int, int]:
    rows = fetch_interactions(conn)
    if not rows:
        print("ALS:   sin interacciones positivas — no se entrena")
        return (0, 0)

    users = sorted({r[0] for r in rows})
    items = sorted({r[1] for r in rows})
    uidx = {u: i for i, u in enumerate(users)}
    iidx = {t: i for i, t in enumerate(items)}

    data = np.array([float(r[2]) for r in rows], dtype=np.float32)
    ur = np.array([uidx[r[0]] for r in rows])
    ic = np.array([iidx[r[1]] for r in rows])
    user_items = csr_matrix((data, (ur, ic)), shape=(len(users), len(items)))

    model = AlternatingLeastSquares(
        factors=FACTORS, regularization=0.05, iterations=20, random_state=42
    )
    model.fit(user_items)
    user_factors = np.asarray(model.user_factors, dtype=np.float32)
    item_factors = np.asarray(model.item_factors, dtype=np.float32)

    with conn.cursor() as cur:
        for user_id, i in uidx.items():
            cur.execute(
                """
                INSERT INTO user_factors (user_id, factors, model_version, updated_at)
                VALUES (%s, %s, %s, now())
                ON CONFLICT (user_id) DO UPDATE
                  SET factors = EXCLUDED.factors,
                      model_version = EXCLUDED.model_version, updated_at = now()
                """,
                (user_id, user_factors[i], MODEL_VERSION),
            )
        for track_id, i in iidx.items():
            cur.execute(
                """
                INSERT INTO track_factors (track_id, factors, model_version, updated_at)
                VALUES (%s, %s, %s, now())
                ON CONFLICT (track_id) DO UPDATE
                  SET factors = EXCLUDED.factors,
                      model_version = EXCLUDED.model_version, updated_at = now()
                """,
                (track_id, item_factors[i], MODEL_VERSION),
            )
    return (len(users), len(items))


def refresh_track_stats(conn) -> int:
    """play_count + hora media de escucha por track (señal contextual, §6.3)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO track_stats (track_id, play_count, avg_hour, updated_at)
            SELECT t.id,
                   COUNT(le.*) FILTER (WHERE le.event_type IN ('play', 'complete')),
                   AVG(le.context_hour) FILTER (WHERE le.event_type IN ('play', 'complete')),
                   now()
            FROM tracks t
            LEFT JOIN listen_events le ON le.track_id = t.id
            GROUP BY t.id
            ON CONFLICT (track_id) DO UPDATE
              SET play_count = EXCLUDED.play_count,
                  avg_hour = EXCLUDED.avg_hour, updated_at = now()
            """
        )
        return cur.rowcount


def main() -> int:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("ERROR: falta DATABASE_URL", file=sys.stderr)
        return 1

    with psycopg.connect(dsn, autocommit=False) as conn:
        register_vector(conn)

        n_users, n_items = train_and_store_factors(conn)
        conn.commit()
        print(f"ALS:   factores de {n_users} usuarios y {n_items} tracks")

        stats = refresh_track_stats(conn)
        conn.commit()
        print(f"STATS: {stats} filas de track_stats")

    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
