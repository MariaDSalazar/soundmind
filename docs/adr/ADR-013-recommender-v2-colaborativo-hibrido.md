# ADR-013 — Recommender v2: ALS colaborativo, híbrido y re-ranking contextual

- **Fecha**: 2026-06-10 · **Estado**: aceptada · **Fase**: F4

## Contexto

F3 dejó recomendación por **contenido** (embeddings de texto + coseno). F4 suma
las otras dos señales del modelo híbrido (§6): **colaborativo** ("oyentes como
tú") y **contextual** (cuándo/cómo escucha). Restricciones que mandan:

- Mismo free tier que F3: entrenar es pesado, servir debe ser ligero.
- **Datos escasos hoy** (~9 tracks, 2 usuarios): el colaborativo casi no tiene
  señal y un modelo contextual entrenado saldría degenerado.

## Decisión

**1. ALS entrenado en batch; servir = producto interno en pgvector.** El batch
(GitHub Actions) entrena ALS sobre feedback implícito (librería `implicit`) y
escribe **factores latentes** (`user_factors`, `track_factors`, `vector(32)`). El
servicio FastAPI **no entrena**: la recomendación colaborativa es el producto
interno `factors <#> :user_factor` (pgvector), mismo patrón ligero que F3.

**2. Solo datos propios, sin bootstrap externo.** Se descarta sembrar con
ListenBrainz: casar su catálogo con Jamendo/Audius/Archive (IDs distintos) es
data-engineering pesado y de encaje dudoso. ALS entrena con `listen_events`+`likes`
propios; el colaborativo mejora solo conforme crezcan los eventos.

**3. Híbrido con fallback a contenido.** El score final mezcla contenido (F3) y
colaborativo normalizados; cuando un usuario/track **no tiene factores** (lo
normal hoy), cae al contenido. Así el sistema siempre responde algo útil.

**4. Re-ranking contextual HEURÍSTICO, no entrenado.** Con pocos datos, en vez de
la regresión logística de §6.3 (que sobreajustaría), se re-ordena con señales
simples y explicables: afinidad con la **hora típica** del track (`track_stats.avg_hour`
vs hora actual) y penalización de lo **recién skipeado**. La regresión logística
queda documentada para cuando haya volumen.

**5. Pesos de feedback implícito** (§6.1): like 2.0, complete 1.0, play 0.5. Los
**skips no entran** en la matriz positiva del ALS (confianza negativa rompe el
modelo); se usan como señal negativa en el re-ranking contextual.

**6. Índices ANN (HNSW) ahora.** F3 los difirió a F4: se añade HNSW a
`content_vec` (coseno) y `track_factors` (producto interno). A esta escala el
planner hará scan exacto igual, pero quedan listos para crecer.

## Consecuencias

- ✅ Serving sigue minúsculo (sin `implicit`/BLAS en runtime): solo álgebra en pgvector.
- ✅ Explicabilidad ampliada (§6.5): reasons `collaborative` ("a oyentes como tú…")
  y anotación contextual ("a esta hora sueles escuchar esto").
- ✅ Re-entrenamiento programado: el cron nocturno (GitHub Actions) ya existe; se
  le añade el paso de ALS + `track_stats`. Modelo versionado por `model_version`.
- ⚠️ Con 2 usuarios el colaborativo es casi ruido; el valor real aparece con
  volumen. El fallback a contenido sostiene la experiencia mientras tanto (honesto,
  no se finge señal que no existe).
- ⚠️ `vector(32)` fija la dimensión de factores del ALS; cambiarla exige migración.
