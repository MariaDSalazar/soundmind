# Recommender service (F3 contenido · F4 colaborativo + híbrido)

Servicio de recomendación **híbrido**. FastAPI + pgvector. **No lleva ML pesado**:
solo coseno (contenido) y producto interno (colaborativo) en pgvector. Los
embeddings y los factores ALS los genera el batch en GitHub Actions
(ver [ADR-012](../../docs/adr/ADR-012-recommender-v1-batch-embeddings.md),
[ADR-013](../../docs/adr/ADR-013-recommender-v2-colaborativo-hibrido.md),
[F3](../../docs/F3-DISENO-RECOMMENDER.md) y [F4](../../docs/F4-DISENO-RECOMMENDER-V2.md)).

`GET /for-me` es híbrido: mezcla contenido + colaborativo, cae a contenido cuando
no hay señal colaborativa, y re-rankea por contexto (`?hour=` opcional, 0..23).

## Endpoints (tras el gateway en `/api/v1/recommendations`)

| Método | Ruta | Auth |
|---|---|---|
| `GET` | `/recommendations/similar/{trackId}?limit=` | pública |
| `GET` | `/recommendations/onboarding/genres?limit=` | pública |
| `POST` | `/recommendations/onboarding` `{ "genres": [...] }` | JWT |
| `GET` | `/recommendations/for-me?limit=` | JWT |
| `GET` | `/healthz` | pública |

## Variables de entorno

| Var | Obligatoria | Detalle |
|---|---|---|
| `DATABASE_URL` | ✅ | el mismo Neon que el resto (pgvector). |
| `JWT_PUBLIC_KEY` o `JWT_PUBLIC_KEY_PATH` | ✅ (para endpoints por-usuario) | misma clave pública del gateway. Admite PEM, `\n` o base64. |
| `PORT` / `RECOMMENDER_PORT` | — | Render inyecta `PORT`; local usa `RECOMMENDER_PORT` (4004). |

## Correr en local

```bash
cd services/recommender
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Requiere la migración 003 aplicada y el batch corrido al menos una vez.
uvicorn app.main:app --host 0.0.0.0 --port 4004 --reload
```

## Desplegar en Render (Web Service · Python)

- **Root directory**: `services/recommender`
- **Build**: `pip install -r requirements.txt`
- **Start**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Env**: `DATABASE_URL`, `JWT_PUBLIC_KEY`. UptimeRobot para que no se duerma.
