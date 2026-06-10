# ADR-008 — Users Service: persistencia directa en gateway y ownership por tablas

- **Fecha**: 2026-06-09 · **Estado**: aceptada · **Fase**: F2

## Contexto

F2 introduce persistencia real (PostgreSQL Neon + Redis Streams Upstash) para
perfiles, likes y eventos de escucha. Hasta F1 el gateway autenticaba con un
`InMemoryUserRepository` y un store de refresh tokens en memoria. Surgen dos
preguntas de arquitectura:

1. ¿Quién persiste a los usuarios/credenciales: el gateway directo a Postgres, o
   un nuevo users service que el gateway consulta por REST en cada login?
2. ¿Cómo se reparten las tablas si solo hay **un** Postgres en el free tier?

## Decisión

**1. El gateway habla directo a Postgres** (`PostgresUserRepository` reemplaza al
in-memory), tal como ya anticipaba el `TODO(F2)` en `user.repository.ts`. Se
descarta meter un salto HTTP gateway→users en el camino crítico de auth (latencia
extra y exponer el `password_hash` por la red interna en cada login).

**2. Ownership por tablas sobre una sola DB Neon.** Cada servicio es dueño de sus
tablas; la integridad se garantiza con claves foráneas y `ON DELETE CASCADE`:

- `gateway` → `users` (incluye `consent_tracking`).
- `users` service → `likes`, `listen_events` (FK→`users(id) ON DELETE CASCADE`).
- `tracks` se **difiere a F3** (la necesita pgvector); `track_id` se guarda como
  texto `"${source}:${sourceTrackId}"` sin FK por ahora.

**3. Auth interna verificada en cada servicio.** El gateway reenvía el
`Authorization: Bearer` al users service, que **verifica el mismo JWT RS256** con
la clave pública (`JWT_PUBLIC_KEY`). No confía en headers manipulables; el
`user_id` proviene del `sub` del token verificado.

**4. Consentimiento y borrado en el dueño.** `PUT /me/consent` y `DELETE /me`
viven en el gateway (dueño de `users`). El `DELETE` se apoya en CASCADE para
limpiar likes/eventos y emite un tombstone `user-deleted` a Redis para que el
recomendador purgue datos derivados (derecho al olvido, §9).

## Consecuencias

- ✅ Camino de auth simple y rápido; el comentario `TODO(F2)` se cumple literal.
- ✅ `DELETE /me` es atómico vía CASCADE; un solo punto de verdad para `users`.
- ✅ Event-driven real: los eventos fluyen a Redis Streams desacoplados del
  recomendador, con idempotencia por `event_id` (§8).
- ✅ Defensa en profundidad: cada servicio valida el JWT, no solo el borde.
- ⚠️ **DB compartida**: el users service *lee* `users.consent_tracking` (tabla
  ajena). Se acepta como compromiso del free tier (un solo Neon) y se restringe a
  lectura; toda escritura de `users` es del gateway. Si se separasen las DBs en el
  futuro, el gate de consentimiento pasaría a consultarse por REST/cache.
- ⚠️ El gateway gana una dependencia de Redis (refresh-store rotativo + tombstone),
  que también resuelve el `TODO(F2): mover a Redis` del `AuthService`.
- ⚠️ Cuota Upstash (10k cmd/día): un `XADD` por evento; si se satura, batch/muestreo
  documentado y logueado (sin truncamiento silencioso).
