# F4 — Diseño del Recommender v2 (colaborativo + híbrido)

> Estado: **en construcción** · Fecha: 2026-06-10 · Fase F4 (roadmap §13)
> Decisiones registradas en [ADR-013](adr/ADR-013-recommender-v2-colaborativo-hibrido.md).
> Construye sobre [F3](F3-DISENO-RECOMMENDER.md).

## 1. Objetivo

Completar el **modelo híbrido en tres señales** (§6):

1. **Contenido** (F3) — embeddings de texto + coseno. *Ya hecho.*
2. **Colaborativo** (F4) — ALS sobre feedback implícito: "a oyentes como tú les gustó".
3. **Contextual** (F4) — re-ranking por hora del día y racha de skips.

…y combinarlas en un **score híbrido** con **fallback a contenido** cuando el
colaborativo no tiene señal. Cada recomendación sigue siendo **explicable** (§6.5).

Alcance F4 (roadmap §13): *ALS + re-ranking contextual + explicabilidad +
re-entrenamiento programado*.

## 2. Las dos mitades (igual que F3): batch pesado vs serving ligero

| Mitad | Dónde | Lleva ML | Hace |
|---|---|---|---|
| **Batch** | GitHub Actions (cron) | ✅ `implicit` | entrena ALS → factores; calcula `track_stats` |
| **Serving** | FastAPI (Render) | ❌ no | producto interno + coseno en pgvector + re-rank heurístico |

```
listen_events + likes ──ALS (implicit, batch)──► user_factors / track_factors (vec 32)
                       └─agregación (batch)────► track_stats (play_count, avg_hour)
                                                          │
   GET /for-me  ──►  FastAPI  ──┬─ contenido: taste_vec  <=>  track_embeddings
                                ├─ colaborativo: user_factors <#> track_factors
                                ├─ blend(α·contenido + β·colaborativo)  (fallback a contenido)
                                └─ re-rank contextual (hora ≈ avg_hour, −skips recientes)
```

## 3. Datos (migración 004, dueño: recommender)

| Tabla | Contenido |
|---|---|
| `user_factors` | `factors vector(32)` del ALS por usuario. |
| `track_factors` | `factors vector(32)` del ALS por track. |
| `track_stats` | `play_count`, `avg_hour` (señal contextual). |
| índices HNSW | en `track_embeddings.content_vec` (coseno) y `track_factors.factors` (ip). |

## 4. Algoritmos (v2)

- **ALS** (`implicit.als.AlternatingLeastSquares`, 32 factores). Matriz implícita
  usuario×track con confianza ponderada (§6.1): **like 2.0, complete 1.0, play 0.5**.
  Los **skips no entran** (confianza negativa rompe ALS) — se usan en el contexto.
- **Colaborativo (serving)**: candidatos por `track_factors.factors <#> user_factors`
  (producto interno; `<#>` de pgvector devuelve el negativo, se ordena ascendente).
- **Híbrido**: `score = α·norm(contenido) + β·norm(colaborativo)`. Si el usuario no
  tiene `user_factors` o un track no tiene `track_factors`, ese término es 0 →
  **fallback natural a contenido**. α=0.5, β=0.5 (configurable).
- **Re-ranking contextual** (§6.3, heurístico):
  - *Hora*: bonus si `|hora_actual − track_stats.avg_hour|` es pequeño.
  - *Skips*: penaliza/excluye tracks skipeados recientemente por el usuario.
- **Explicabilidad** (§6.5): `reason.type` ∈ `similar_track | taste | collaborative`;
  más una nota contextual (`contextHourMatch`) cuando aplica.

## 5. API (sin cambios de forma; for-me se vuelve híbrido)

`GET /recommendations/for-me?limit=&hour=` — `hour` opcional (0..23) para el
contexto; si falta, el servicio usa la hora del servidor. Devuelve `ForMeResponse`
con tracks ya mezclados y re-rankeados, cada uno con su `reason`.

## 6. Plan por incrementos

1. **Fundamentos** — diseño + ADR-013 + migración 004 (factores, stats, HNSW). *(este doc)*
2. **Batch ALS** — `jobs/collab/train_als.py` + `track_stats`; enganchado al cron.
3. **Serving híbrido** — colaborativo + blend + re-rank contextual + reasons.
4. **Frontend** — explicabilidad enriquecida por pista.
5. **Verificación** — migración, batch, validación end-to-end.

## 7. Honestidad sobre los datos

Con ~9 tracks y 2 usuarios el colaborativo es casi ruido; su valor real llega con
volumen. El **fallback a contenido** sostiene la experiencia y NO se finge señal
inexistente. El entregable de F4 es la **arquitectura híbrida lista y versionada**,
que mejora sola conforme entran eventos.
