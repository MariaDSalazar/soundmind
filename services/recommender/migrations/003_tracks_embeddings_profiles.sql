-- F3 · Recommender v1: catálogo persistido + IA de contenido (pgvector).
-- Dueño: Recommender service (ADR-008: ownership por tablas sobre 1 sola DB Neon).
-- Referencia a users(id) (dueño: gateway) — válido por ser la misma base.
-- La tabla `tracks` estaba diferida desde F2 (001_likes_listen_events.sql); aquí
-- por fin aparece porque la necesita pgvector.

CREATE EXTENSION IF NOT EXISTS vector;

-- Metadata del catálogo (NUNCA audio, solo URLs oficiales del CDN). Se puebla
-- por ingesta batch desde los snapshots JSONB de listen_events (event sourcing):
-- el corpus = lo que la gente realmente reprodujo/likeó.
CREATE TABLE IF NOT EXISTS tracks (
  id              TEXT        PRIMARY KEY,        -- "${source}:${sourceTrackId}"
  source          TEXT        NOT NULL,
  source_track_id TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  artist          TEXT,
  genre_tags      TEXT[]      NOT NULL DEFAULT '{}',
  duration_s      INTEGER,
  stream_url      TEXT,
  artwork_url     TEXT,
  is_preview      BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Embedding de CONTENIDO-TEXTO (tags + género + título + artista) en 384-d.
-- Lo genera el job batch (GitHub Actions) con sentence-transformers; el servicio
-- FastAPI NO embebe en runtime (free tier) — solo consulta coseno aquí.
CREATE TABLE IF NOT EXISTS track_embeddings (
  track_id      TEXT        PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  content_vec   vector(384) NOT NULL,
  model_version TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nota: a esta escala (corpus pequeño) el KNN exacto con `<=>` es suficiente y
-- siempre correcto. El índice ANN (ivfflat/hnsw) se añade en F4 cuando el corpus
-- crezca — requiere datos cargados + ANALYZE para ser efectivo, así que se
-- difiere a propósito para no arrastrar un índice mal entrenado.

-- Centroide de gustos del usuario. taste_vec se siembra en el onboarding
-- (promedio de embeddings de los géneros elegidos) y luego el batch lo recalcula
-- como centroide de lo que reproduce/likea (aprendizaje continuo, §6.4).
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id    BIGINT      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  taste_vec  vector(384),
  onboarded  BOOLEAN     NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recomendaciones servidas + su explicación (§6.5) y feedback (loop de §6.4).
CREATE TABLE IF NOT EXISTS recommendations (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id      TEXT        NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  score         REAL        NOT NULL,
  reason        JSONB,                              -- {type, anchor, signal}
  model_version TEXT,
  served_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  feedback      TEXT
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_recent
  ON recommendations (user_id, served_at DESC);
