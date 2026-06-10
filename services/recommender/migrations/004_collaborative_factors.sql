-- F4 · Recommender v2: colaborativo (ALS) + re-ranking contextual.
-- Dueño: Recommender service. Factores latentes del ALS (entrenados en batch);
-- el serving solo hace producto interno en pgvector (`<#>`), sin librerías ML.
-- Dimensión 32 = factores del ALS (fija para la columna vector).

-- Factor latente del usuario (perfil colaborativo). Producto interno con
-- track_factors = afinidad colaborativa "oyentes como tú".
CREATE TABLE IF NOT EXISTS user_factors (
  user_id       BIGINT      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  factors       vector(32)  NOT NULL,
  model_version TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Factor latente del track.
CREATE TABLE IF NOT EXISTS track_factors (
  track_id      TEXT        PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  factors       vector(32)  NOT NULL,
  model_version TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estadísticas por track para el re-ranking contextual (§6.3): popularidad y
-- hora media de escucha (señal "esta pista suele sonar a esta hora").
CREATE TABLE IF NOT EXISTS track_stats (
  track_id   TEXT        PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  play_count INTEGER     NOT NULL DEFAULT 0,
  avg_hour   REAL,                                 -- 0..23, NULL si no hay datos
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices ANN (diferidos a propósito desde F3, ver ADR-012): aceleran el coseno
-- de contenido y el producto interno colaborativo cuando el corpus crezca. HNSW
-- se construye incrementalmente, así que es seguro crearlo ya aunque haya pocos
-- datos (a esta escala el planner igual hará scan exacto).
CREATE INDEX IF NOT EXISTS idx_track_embeddings_hnsw
  ON track_embeddings USING hnsw (content_vec vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_track_factors_hnsw
  ON track_factors USING hnsw (factors vector_ip_ops);
