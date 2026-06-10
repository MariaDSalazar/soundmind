-- F2 · Migración del users service (dueño de `likes` y `listen_events`).
-- Requiere que la tabla `users` (gateway, 001_users.sql) ya exista.
-- `track_id` es texto "${source}:${sourceTrackId}" — la tabla `tracks` se
-- difiere a F3 (la necesita pgvector), así que NO hay FK a tracks todavía.

CREATE TABLE IF NOT EXISTS likes (
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)        -- like idempotente por (usuario, pista)
);

CREATE TABLE IF NOT EXISTS listen_events (
  -- event_id: clave de idempotencia compartida con el Redis Stream (§8).
  event_id     UUID        PRIMARY KEY,
  user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id     TEXT        NOT NULL,
  event_type   TEXT        NOT NULL CHECK (event_type IN ('play', 'skip', 'complete')),
  played_ms    INTEGER     NOT NULL DEFAULT 0,
  context_hour SMALLINT    NOT NULL CHECK (context_hour BETWEEN 0 AND 23),
  device       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historial por usuario, orden cronológico inverso (paginación cursor-based).
CREATE INDEX IF NOT EXISTS idx_listen_events_user_recent
  ON listen_events (user_id, created_at DESC, event_id DESC);
