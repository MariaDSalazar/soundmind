-- F2 · Migración del gateway (dueño de la tabla `users`).
-- Reemplaza el InMemoryUserRepository de F1 (ver ADR-008).
-- Debe ejecutarse ANTES de la migración del users service (FKs la referencian).

CREATE TABLE IF NOT EXISTS users (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email            TEXT        NOT NULL UNIQUE,
  password_hash    TEXT        NOT NULL,
  display_name     TEXT        NOT NULL,
  -- Consentimiento explícito de tracking de escucha (GDPR/LOPD, §9).
  -- El users service SOLO lee esta columna; nunca la escribe.
  consent_tracking BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
