# F2 — Diseño del Users Service (Perfil y eventos)

> Estado: **diseño + scaffolding** · Fecha: 2026-06-09 · Fase F2 (roadmap §13)
> Decisiones registradas en [ADR-008](adr/ADR-008-users-service.md).

## 1. Objetivo

Entregar el **servicio de usuarios** (`services/users/`): historial de escucha,
likes y eventos (`play | skip | complete | like`) que se persisten en
**PostgreSQL (Neon)** y se publican en **Redis Streams (Upstash)** para que el
recomendador (F3/F4) los consuma de forma desacoplada (event-driven, §6.4).

Alcance de F2 (1 semana, roadmap §13): *Historial, likes, eventos de escucha a
Redis Streams*. **No** incluye el recomendador ni embeddings (eso es F3).

## 2. Propiedad de datos (una sola DB Neon, ownership por tablas)

Free tier = un único Postgres Neon. Cada servicio es **dueño de sus tablas**;
la integridad se garantiza con FKs y `ON DELETE CASCADE`. (Ver ADR-008.)

| Tabla | Dueño | Notas |
|---|---|---|
| `users` | **gateway** | F2 reemplaza `InMemoryUserRepository` por `PostgresUserRepository`. Añade `consent_tracking`. |
| `likes` | **users** | PK `(user_id, track_id)`; FK→`users(id)` `ON DELETE CASCADE`. |
| `listen_events` | **users** | FK→`users(id)` `ON DELETE CASCADE`. |
| `tracks` | — | **Diferida a F3** (la necesita pgvector). `track_id` se guarda como texto `"${source}:${sourceTrackId}"`, sin FK por ahora. |

> El users service **lee** `users.consent_tracking` (compromiso de DB compartida)
> pero **nunca escribe** la tabla `users`. Todas las escrituras de `users` son del
> gateway.

## 3. Autenticación interna (defensa en profundidad)

`ARQUITECTURA.md §9`: *"RBAC verificado en Gateway y en cada servicio"*.

- El gateway ya verifica el access token (`requireAuth`) y, en el proxy,
  **reenvía el header `Authorization: Bearer <jwt>`** al users service.
- El users service tiene su propio `requireAuth` que **verifica el mismo JWT
  RS256** con `JWT_PUBLIC_KEY` (solo la pública; nunca tiene la privada). Reusa
  `aud: soundmind-api`. Así el servicio no confía ciegamente en un header.
- El `user_id` sale del `sub` del token verificado, no de un header manipulable.

## 4. API (montada por el gateway bajo `/api/v1`)

Todas exigen auth. Errores en formato **RFC 9457 (Problem Details)**, igual que F1.

| Método | Ruta | Acción |
|---|---|---|
| `POST` | `/me/listen-events` | Registra un evento `play\|skip\|complete`. Gate de consentimiento. |
| `GET`  | `/me/history` | Historial reciente (paginación cursor-based por `created_at,id`). |
| `PUT`  | `/me/likes/:trackId` | Marca like (idempotente). |
| `DELETE` | `/me/likes/:trackId` | Quita like. |
| `GET`  | `/me/likes` | Lista de likes del usuario. |

Endpoints que **se quedan en el gateway** (dueño de `users`):

| Método | Ruta | Acción |
|---|---|---|
| `PUT` | `/me/consent` | Activa/desactiva `consent_tracking`. |
| `DELETE` | `/me` | Borra el usuario → CASCADE elimina likes + listen_events; emite tombstone `user-deleted` a Redis (derecho al olvido, §9). |

### Contrato `POST /me/listen-events`
```jsonc
// request body (validado con Zod)
{
  "trackId": "jamendo:1234567",
  "eventType": "complete",      // play | skip | complete
  "playedMs": 187000,
  "device": "web"               // opcional
}
// context_hour se deriva en servidor (no se confía en el cliente)
// 202 Accepted si se aceptó; 204 No Content si el usuario no dio consentimiento
```

## 5. Eventos (Redis Streams)

- **Stream**: `listen-events`. Productor: `XADD listen-events * ...campos`.
- **Idempotencia** (§8): cada evento lleva `event_id` (UUID) presente tanto en la
  fila de Postgres como en el payload del stream; el consumidor (F3) deduplica por él.
- **At-least-once** con consumer groups del lado del recomendador (F3).
- **Gate de consentimiento**: si `consent_tracking = false`, el evento **no** se
  persiste ni se publica (privacidad por diseño, §9). Los likes sí se guardan
  (son acción explícita del usuario), pero solo se publican como señal si hay consentimiento.
- **Tombstone**: al borrar la cuenta, el gateway hace `XADD user-deleted * userId ...`
  para que el recomendador purgue perfiles/embeddings derivados.

## 6. Estructura interna (Hexagonal, igual que music/gateway)

```
services/users/
├── Dockerfile
├── package.json
├── tsconfig.json
├── migrations/
│   └── 001_likes_listen_events.sql
└── src/
    ├── index.ts                 # composition root (carga .env, arma deps)
    ├── env.ts                   # carga + valida variables (dotenv + zod)
    ├── domain/
    │   ├── entities.ts          # ListenEvent, Like (sin deps)
    │   └── ports.ts             # LikeRepository, ListenEventRepository, EventStreamPort, ConsentReaderPort
    ├── application/
    │   ├── record-listen-event.ts
    │   ├── toggle-like.ts
    │   └── get-history.ts
    ├── infrastructure/
    │   ├── db.ts                # Pool de pg (singleton controlado, inyectado)
    │   ├── postgres.likes.repository.ts
    │   ├── postgres.listen-events.repository.ts
    │   ├── postgres.consent.reader.ts
    │   └── redis.event-stream.ts  # XADD (ioredis sobre rediss://)
    └── interfaces/
        ├── auth.middleware.ts   # verifica JWT RS256 con la clave pública
        └── routes.ts            # controladores + validación Zod
```

## 7. Carga de `.env` (deuda técnica de F1 que F2 resuelve)

Los servicios corren con `tsx` y **no cargaban `.env`**. Se resuelve con
`import 'dotenv/config'` al inicio de `env.ts` (antes de leer `process.env`).
El mismo fix de una línea aplica a `gateway` y `music` cuando se actualicen.
En producción (Render) las variables vienen del entorno y `dotenv` es no-op.

## 8. Variables de entorno (ya en `.env.example`)

`DATABASE_URL` (Neon, `sslmode=require`), `REDIS_URL` (`rediss://`),
`USERS_PORT` (nuevo, default 4003), `JWT_PUBLIC_KEY` (compartida con el gateway
para verificar tokens). Se añade `USERS_SERVICE_URL` para el proxy del gateway.

## 9. Plan de implementación (orden sugerido)

1. **Migraciones**: correr `001_users.sql` (gateway) y luego `001_likes_listen_events.sql` (users). *(SQL ya escrito en scaffolding.)*
2. **Gateway**: `PostgresUserRepository` (reemplaza in-memory), mover refresh-store a Redis, endpoints `PUT /me/consent` y `DELETE /me`, productor de tombstone.
3. **Users service**: implementar repos Postgres + productor Redis + casos de uso + rutas (esqueletos ya creados con `TODO`).
4. **Gateway proxy**: montar `buildUsersProxyRoutes(USERS_SERVICE_URL)` reenviando el `Authorization`.
5. **Frontend** (`apps/web`): llamar a likes/historial y banner de consentimiento.
6. **Tests** (Vitest): casos de uso de dominio con repos/stream fake (in-memory), igual que `search-tracks.test.ts`.
7. **Deploy**: blueprint Render para `soundmind-users`; healthcheck `/healthz`.

## 10. Riesgos / notas

- **Cuota Upstash** (10k cmd/día free): un `XADD` por evento + likes. Suficiente
  para demo; si se queda corto, batch o muestreo (y se loguea lo descartado).
- **Neon pooler**: usar el endpoint *pooled* en `DATABASE_URL` (serverless-friendly).
- **`tracks` diferida**: hasta F3 no hay validación referencial de `track_id`;
  se acepta cualquier `"${source}:${id}"` bien formado (validado por Zod).
