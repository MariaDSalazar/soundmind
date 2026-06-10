-- F2 · Snapshot de la pista en el evento de escucha (event sourcing).
-- Permite reconstruir y reproducir el historial sin tabla `tracks` (diferida a F3).
ALTER TABLE listen_events ADD COLUMN IF NOT EXISTS track JSONB;
