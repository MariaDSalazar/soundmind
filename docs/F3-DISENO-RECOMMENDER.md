# F3 — Diseño del Recommender v1 (IA de contenido)

> Estado: **en construcción** · Fecha: 2026-06-10 · Fase F3 (roadmap §13)
> Decisiones registradas en [ADR-012](adr/ADR-012-recommender-v1-batch-embeddings.md).

## 1. Objetivo

Entregar la **primera IA de recomendación** basada en **contenido por texto**:

- **"Más como esta"** — dado un track, devolver los más similares (coseno).
- **"Para ti"** — recomendaciones según el gusto del usuario (`taste_vec`).
- **Onboarding (cold-start, §6.6)** — el usuario elige 3–5 géneros y arranca con
  recomendaciones por contenido puro, sin esperar al colaborativo.
- Cada recomendación es **explicable** (`reason`, §6.5).

Alcance F3 (roadmap §13): *Embeddings + "más como esta" + onboarding*. **Fuera de
F3** (→ F4): features acústicas (AcousticBrainz) y colaborativo (ALS).

## 2. Las dos mitades: batch (pesado) vs serving (ligero)

El reparto nace de la restricción de free tier (ver ADR-012):

| Mitad | Dónde corre | Lleva torch | Hace |
|---|---|---|---|
| **Batch** | GitHub Actions (cron) | ✅ sí | ingesta `tracks`, embebe con `sentence-transformers`, recalcula `taste_vec` |
| **Serving** | FastAPI en Render | ❌ no | solo consultas de similitud coseno (`pgvector <=>`) |

```
listen_events.track (JSONB, F2)  ──ingesta──►  tracks
                                                  │  sentence-transformers (batch, GH Actions)
                                                  ▼
                                          track_embeddings (vector 384)
        onboarding (géneros) ──┐                  │
                               ▼                  ▼
                         user_profiles ◄── coseno ── FastAPI (Render, sin torch)
                          (taste_vec)              ▲
                                                   │  GET /similar, /for-me  ·  POST /onboarding
                                              gateway proxy  ──►  apps/web
```

## 3. Propiedad de datos (sigue ADR-008: un Neon, ownership por tablas)

| Tabla | Dueño | Notas |
|---|---|---|
| `tracks` | **recommender** | metadata, nunca audio. Antes diferida; aparece en F3. |
| `track_embeddings` | **recommender** | `vector(384)` + `model_version`. FK→`tracks`. |
| `user_profiles` | **recommender** | `taste_vec vector(384)`, `onboarded`. FK→`users`. |
| `recommendations` | **recommender** | score + `reason` jsonb + feedback. |

Migración: `services/recommender/migrations/003_tracks_embeddings_profiles.sql`
(`CREATE EXTENSION vector;` + las 4 tablas). KNN exacto en v1; índice ANN a F4.

## 4. Modelo y algoritmos (v1)

- **Modelo**: `sentence-transformers/all-MiniLM-L6-v2` (384-d, ~80 MB, coincide con
  `vector(384)` de la arquitectura). `model_version` se guarda por embedding.
- **Texto a embeber**: `"{title} — {artist}. Géneros: {genre_tags}"`.
- **Similitud**: coseno con `1 - (content_vec <=> :q)` en pgvector.
- **`taste_vec`**:
  - *Onboarding*: centroide de los embeddings de tracks de los géneros elegidos.
  - *Continuo (batch)*: centroide ponderado de tracks reproducidos/likeados del
    usuario — like 2.0, complete 1.0, play 0.5, skip<30s −0.5 (§6.1).
- **`reason`** (§6.5): `{"type":"similar_track","anchor":"<trackId>","signal":"tags"}`
  o `{"type":"taste","signal":"content"}` → la UI lo traduce a *"Porque escuchaste X"*.

## 5. API del servicio (tras el gateway, `/api/v1/recommendations`)

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/recommendations/similar/{trackId}?limit=` | pública | tracks similares + `reason` |
| `GET` | `/recommendations/for-me?limit=` | JWT | recos por `taste_vec`, excluye lo ya oído |
| `POST` | `/recommendations/onboarding` `{genres:[...]}` | JWT | siembra `taste_vec`, marca `onboarded` |
| `GET` | `/recommendations/onboarding/genres` | pública | géneros disponibles (del corpus) |
| `GET` | `/healthz` | pública | estado |

Validación con **Pydantic** en cada borde (§9). Verifica el **mismo JWT RS256**
(clave pública) que el users service — defensa en profundidad (ADR-008).

## 6. Plan por incrementos

1. **Fundamentos** — diseño + ADR-012 + migración pgvector. *(este doc)*
2. **Batch job** — `jobs/embed/` Python + workflow cron (ingesta → embed → taste_vec).
3. **Servicio** — `services/recommender/` FastAPI hexagonal (sin torch).
4. **Gateway** — proxy `/recommendations/*` + tipos en `@soundmind/shared`.
5. **Frontend** — onboarding de géneros, "Más como esta", vista "Para ti".

## 7. Despliegue

- **Serving**: Render Web Service (Python). Env: `DATABASE_URL`, `JWT_PUBLIC_KEY`,
  `RECOMMENDER_PORT`. UptimeRobot para que no se duerma.
- **Batch**: GitHub Actions, cron nocturno + `workflow_dispatch` manual. Secret:
  `DATABASE_URL`. Sin Render (corre en el runner de GitHub).
