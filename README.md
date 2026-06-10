# SoundMind 🎵

> Plataforma de streaming de **música libre** (Creative Commons, artistas independientes y dominio público) con perfil de usuario, historial inteligente y un **motor de recomendación propio basado en IA** (en construcción) que aprende de tus gustos.

[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)

## ¿Por qué este proyecto?

Tras el cierre de la API de recomendaciones de Spotify (2024–2026), construir un recomendador musical con **datos y APIs abiertas** es un reto técnico real. SoundMind lo resuelve con:

- 🎧 **Streaming 100% legal**: catálogo Creative Commons de [Jamendo](https://www.jamendo.com), artistas independientes de [Audius](https://audius.co) y dominio público / netlabels del [Internet Archive](https://archive.org) — **todo en streaming completo**. Nunca se almacena ni se hace proxy de audio (solo se reproducen las URLs oficiales de cada CDN).
- 👤 **Perfil y eventos** (F2): cuentas con JWT, likes, historial de escucha **reproducible** y eventos a Redis Streams — con **consentimiento explícito** (GDPR) y borrado total de cuenta.
- 🧠 **IA híbrida propia** (Fase 3-4): filtrado colaborativo + embeddings de contenido + contexto, con recomendaciones explicables.
- 💸 **Costo $0**: todo corre en free tiers y open source.

> ℹ️ **Sobre el catálogo comercial**: la música de major label (p. ej. Bad Bunny) no está disponible gratis y legalmente en ninguna API — las disqueras no lo permiten. SoundMind prioriza la legalidad por diseño; el catálogo comercial completo queda como evolución futura vía el SDK oficial de Spotify (cuenta Premium del usuario). Las decisiones están registradas en [`docs/adr`](docs/adr) (ADR-006 a ADR-011).

## Arquitectura

Microservicios ligeros con **Clean/Hexagonal Architecture** — ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y el diseño de F2 en [`docs/F2-DISENO-USERS.md`](docs/F2-DISENO-USERS.md).

```
React SPA ──HTTPS──▶ Gateway (BFF, auth JWT RS256, rate limit, proxy)
                        ├──▶ Music Service (adaptadores Jamendo/Audius/Archive)
                        ├──▶ Users Service (perfil, likes, eventos)
                        │       ├──▶ PostgreSQL (Neon)
                        │       └──▶ Redis Streams (Upstash)
                        └──▶ Recommender Service — Python/FastAPI (F3-F4)
```

| Workspace | Rol | Stack |
|---|---|---|
| `apps/web` | SPA (auth, búsqueda, player, likes, historial) | React 19 + TypeScript + Vite + Tailwind 4 + Zustand + TanStack Query |
| `services/gateway` | BFF: auth, rate limit, proxy, cuenta | Node 22 + Express 5 + JWT RS256 + Argon2id + PostgreSQL |
| `services/music` | Catálogo y búsqueda multi-fuente (Jamendo, Audius, Internet Archive) | Node 22 + Express 5 + Zod |
| `services/users` | Perfil, likes, historial, eventos de escucha | Node 22 + Express 5 + PostgreSQL (Neon) + Redis Streams (Upstash) |
| `packages/shared` | Tipos de dominio compartidos | TypeScript |

**Patrones aplicados** (buscar `PATTERN:` en el código): Hexagonal Ports & Adapters, BFF, Adapter, Facade, Factory Method, Repository, Observer, **Event-Driven** (eventos de escucha a Redis Streams), **event sourcing ligero** (snapshot inmutable de la pista en cada evento → historial reproducible sin tabla de tracks).

## Funcionalidades (F1 + F2)

- 🔎 Búsqueda multi-fuente con intercalado round-robin que preserva la relevancia de cada API.
- ▶️ Reproductor con cola, anterior/siguiente, control de volumen y registro automático de escuchas.
- 👤 Registro / login (JWT RS256, refresh token rotativo en cookie `HttpOnly`).
- ❤️ Likes y **"Mi historial" reproducible** (cada evento guarda un snapshot de la pista).
- 🔒 Toggle de **consentimiento** de tracking (sin él no se registra nada) y borrado de cuenta (`DELETE /me`, con `ON DELETE CASCADE`).

## Quick start

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
#   - JAMENDO_CLIENT_ID: API key gratis en https://devportal.jamendo.com/ (sin ella, solo Audius/Archive)
#   - DATABASE_URL: PostgreSQL (Neon free tier)   — requerido por gateway y users
#   - REDIS_URL:    Redis (Upstash free tier)      — requerido por users

# 3. Levantar todo (gateway :4000, music :4002, users :4003, web :5173)
npm run dev
```

Abre <http://localhost:5173>, crea una cuenta, busca algo (ej. "lofi") y reproduce. 🎶

> Migraciones SQL en `services/*/migrations/`. Aplícalas a tu base Neon antes de usar el users service (el gateway crea `users`; el users service crea `likes` y `listen_events`).

## Deploy (free tier)

| Pieza | Plataforma | Cómo |
|---|---|---|
| `apps/web` | **Netlify** | Importar el repo — [`netlify.toml`](netlify.toml) define build y redirects SPA. Configurar `VITE_API_URL` con la URL del gateway. |
| `services/gateway`, `services/music`, `services/users` | **Render** | New → Blueprint → este repo — [`render.yaml`](render.yaml) crea los 3 servicios Docker con healthchecks y autodeploy desde `main`. |
| Base de datos / cola | **Neon** (PostgreSQL) + **Upstash** (Redis) | Free tier. |

### Gotchas de deploy aprendidos (importante)

- 🔑 **Claves JWT en Render**: el panel rompe los PEM multilínea. El código acepta el PEM **en base64** (recomendado) o en una línea con `\n`. Genera el par y pásalo en base64:
  ```bash
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem
  openssl pkey -in jwt-private.pem -pubout -out jwt-public.pem
  base64 -w0 jwt-private.pem   # → JWT_PRIVATE_KEY (gateway)
  base64 -w0 jwt-public.pem    # → JWT_PUBLIC_KEY  (gateway y users, el mismo)
  ```
  Los `.pem` jamás se versionan (ya están en `.gitignore`).
- 🐘 **`DATABASE_URL`**: usar solo `?sslmode=require`. Quitar `&channel_binding=require` — rompe el driver `pg` en el Docker de Render (Node 22).
- 🌐 **CORS / cookies**: apunta `CORS_ORIGINS` (gateway) a la URL de Netlify y `VITE_API_URL` (Netlify) a la del gateway. La cookie de refresh usa `SameSite=None; Secure` en prod (cross-site Netlify↔Render).
- 💤 **Cold start**: el free tier de Render duerme tras 15 min — [UptimeRobot](https://uptimerobot.com) (gratis) hace ping a `/healthz` de los 3 servicios cada 5 min para mantenerlos despiertos.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta los 4 servicios en paralelo |
| `npm run typecheck` | TypeScript estricto en todos los workspaces |
| `npm test` | Tests unitarios (Vitest) |

## Créditos y licencias de recursos

- Iconos UI: [Lucide](https://lucide.dev) (licencia ISC) — repositorio de iconos open source.
- Música: APIs oficiales de [Jamendo](https://devportal.jamendo.com/) (Creative Commons), [Audius](https://docs.audius.org/api/) (artistas independientes) e [Internet Archive](https://archive.org/help/aboutsearch.htm) (dominio público / netlabels).
- Metadata: [MusicBrainz](https://musicbrainz.org/) (datos abiertos) — a partir de F3.
- **Sin assets generados por IA**: todos los recursos visuales provienen de repositorios abiertos con licencia verificable.

## Roadmap

- [x] **F1 — MVP catálogo**: búsqueda multi-fuente + reproducción + auth JWT + Docker + deploy (Netlify/Render)
- [x] **F1.5 — Pulido del catálogo**: relevancia round-robin, player con feedback de errores
- [x] **F1.6 — Catálogo solo-legal**: + Internet Archive (streaming completo); se retiraron Deezer (previews 30s) y JioSaavn (catálogo no apto) — ver ADR-009/010/011
- [x] **F2 — Perfil y eventos**: registro/login, likes, historial reproducible, eventos de escucha (Redis Streams), PostgreSQL, consentimiento (GDPR), UI rediseñada con microanimaciones — **desplegado**
- [ ] **F3 — IA de contenido**: embeddings + "más como esta" + onboarding de gustos
- [ ] **F4 — IA híbrida**: filtrado colaborativo (ALS) + re-ranking contextual + explicabilidad
- [ ] **F5 — Pulido**: diagramas C4, OpenAPI navegable, demo en vivo

## Licencia

[MIT](LICENSE) © 2026 Maria del Carmen Salazar Torres
