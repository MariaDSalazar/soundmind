# ADR-012 — Recommender v1: embeddings batch + pgvector, contenido por texto

- **Fecha**: 2026-06-10 · **Estado**: aceptada · **Fase**: F3

## Contexto

F3 introduce el **Recommender v1**: "más como esta", recomendaciones por gusto y
onboarding de cold-start (§6.2/§6.6). La arquitectura pide `sentence-transformers`
(384-d) sobre tags+género+descripción y similitud coseno en `pgvector`. El reto:
`sentence-transformers` arrastra **torch** (~700 MB–1 GB en disco/RAM) y el plan
free de Render da **512 MB** — embeber en runtime ahí significa build lento, OOM y
cold starts largos. Además la tabla `tracks` se difirió desde F2, así que no hay
catálogo persistido que embeber.

## Decisión

**1. Los embeddings se generan en BATCH, no en el servicio.** Un job Python en
**GitHub Actions (cron)** —runner con RAM de sobra— ejecuta `sentence-transformers`
(`all-MiniLM-L6-v2`, 384-d) y escribe los vectores en `track_embeddings`. El
servicio **FastAPI en Render NO incluye torch**: su única tarea de IA es ejecutar
consultas de similitud coseno (`<=>`) en `pgvector`. Encaja en 512 MB y arranca
rápido. Alinea con el "re-entrenamiento batch nocturno (GitHub Actions cron)" de §6.4.

**2. F3 v1 = contenido-texto solamente.** Se embebe `título + artista + género +
tags`. Las **features acústicas** (BPM/energía/valencia de AcousticBrainz/Essentia)
y el **colaborativo (ALS)** se difieren a **F4** (Recommender v2), tal como marca el
roadmap §13.

**3. El corpus son los tracks reproducidos/likeados.** La tabla `tracks` se puebla
por ingesta batch desde los **snapshots JSONB de `listen_events`** (event sourcing,
F2) — cero llamadas extra a APIs externas y el corpus = música que la gente
realmente usó (menos ruido que ingerir cada búsqueda).

**4. Onboarding sin modelo en runtime.** El usuario elige 3–5 géneros; `taste_vec`
se siembra como **centroide de los embeddings de tracks de esos géneros** (SQL puro,
sin torch). Luego el batch lo recalcula como centroide ponderado de lo que
reproduce/likea (like 2.0 > complete 1.0 > play). "Para ti" = coseno(`taste_vec`,
`track_embeddings`) excluyendo lo ya escuchado.

**5. El Recommender es dueño de las tablas de IA** (`tracks`, `track_embeddings`,
`user_profiles`, `recommendations`) sobre el mismo Neon (ADR-008). Verifica el
**mismo JWT RS256** con la clave pública en endpoints por-usuario (defensa en
profundidad).

## Consecuencias

- ✅ El servicio serving es minúsculo (sin torch): cabe en free tier y arranca rápido.
- ✅ KNN exacto con `<=>` es suficiente y siempre correcto a esta escala; el índice
  ANN (ivfflat/hnsw) se difiere a F4 cuando el corpus crezca (evita un índice mal
  entrenado sobre tabla casi vacía).
- ✅ Explicabilidad real (§6.5): cada reco lleva `reason {type, anchor, signal}`.
- ✅ Onboarding resuelve cold-start sin depender del colaborativo (entra en F4 con ~20 eventos).
- ⚠️ Latencia de frescura: un track nuevo no es recomendable hasta el siguiente run
  del cron (nocturno). Aceptable para v1; se puede disparar el job manualmente.
- ⚠️ Un like sin reproducción previa no tiene metadata (likes no guardan snapshot);
  queda fuera del corpus hasta que se reproduzca. Aceptable en v1.
- ⚠️ Cuarto servicio en Render free (se duerme); UptimeRobot lo mantiene despierto.
