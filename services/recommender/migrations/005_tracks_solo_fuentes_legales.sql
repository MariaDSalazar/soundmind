-- F4 cleanup · El corpus del recomendador SOLO debe contener fuentes libres/
-- legales (ADR-011: Jamendo/Audius/Internet Archive). Eventos de pruebas viejas
-- dejaron tracks de fuentes retiradas (deezer/saavn) que el embed ingirió. Aquí
-- se purgan y se impide a nivel de esquema que vuelvan.
-- Idempotente: el runner re-aplica todas las migraciones en cada corrida.

-- 1) Purga (CASCADE limpia track_embeddings/track_factors/track_stats/recommendations).
DELETE FROM tracks WHERE source NOT IN ('jamendo', 'audius', 'archive');

-- 2) CHECK que blinda la tabla a futuro (defensa en profundidad, además del
--    filtro en el job de ingesta). DO block para que sea idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracks_source_legal'
  ) THEN
    ALTER TABLE tracks
      ADD CONSTRAINT tracks_source_legal
      CHECK (source IN ('jamendo', 'audius', 'archive'));
  END IF;
END $$;
