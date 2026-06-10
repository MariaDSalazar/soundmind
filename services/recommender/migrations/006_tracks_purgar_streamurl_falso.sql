-- F4 cleanup · Purga tracks de PRUEBA con stream_url falso/inválido. Venían de
-- eventos de prueba con pistas inventadas (p.ej. https://example.org/777.mp3,
-- https://x/y.mp3); el recomendador los sugería y NO se podían reproducir.
-- Idempotente (el runner re-aplica todas las migraciones). CASCADE limpia
-- track_embeddings/track_factors/track_stats/recommendations.
--
-- Regla de "URL reproducible": https:// + host con dominio (un punto) + ruta.
-- Eso conserva Jamendo (prod-N.storage.jamendo.com), Audius (discoveryprovider…
-- .audius.co) e Internet Archive (archive.org), y descarta los hosts falsos.
DELETE FROM tracks
WHERE stream_url IS NULL
   OR stream_url NOT LIKE 'https://%.%/%'
   OR stream_url LIKE '%example.%';
