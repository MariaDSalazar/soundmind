# SoundMind 🎵

> Plataforma de streaming de **música libre** (Creative Commons + artistas independientes) con un **motor de recomendación propio basado en IA** que aprende de los gustos del usuario.

[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)

## ¿Por qué este proyecto?

Tras el cierre de la API de recomendaciones de Spotify (2024–2026), construir un recomendador musical con **datos y APIs abiertas** es un reto técnico real. SoundMind lo resuelve con:

- 🎧 **Streaming 100% legal**: catálogo Creative Commons de [Jamendo](https://www.jamendo.com) y artistas independientes de [Audius](https://audius.co). Nunca se almacena ni hace proxy de audio.
- 🧠 **IA híbrida propia** (Fase 3-4): filtrado colaborativo + embeddings de contenido + contexto, con recomendaciones explicables.
- 💸 **Costo $0**: todo corre en free tiers y open source.

## Arquitectura

Microservicios ligeros con **Clean/Hexagonal Architecture** — ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) para el documento completo (ADRs, patrones, seguridad, modelo de amenazas).

```
React SPA ──HTTPS──▶ Gateway (BFF, auth JWT RS256, rate limit)
                        ├──▶ Music Service (adaptadores Jamendo/Audius)
                        ├──▶ Users Service (F2)
                        └──▶ Recommender Service — Python/FastAPI (F3-F4)
```

| Workspace | Rol | Stack |
|---|---|---|
| `apps/web` | SPA | React 19 + TypeScript + Vite + Tailwind 4 + Zustand + TanStack Query |
| `services/gateway` | BFF: auth, rate limit, proxy | Node 22 + Express 5 + JWT RS256 + Argon2id |
| `services/music` | Catálogo y búsqueda multi-fuente | Node 22 + Express 5 + Zod |
| `packages/shared` | Tipos de dominio compartidos | TypeScript |

**Patrones aplicados** (buscar `PATTERN:` en el código): Hexagonal Ports & Adapters, BFF, Adapter, Facade, Factory Method, Repository, Observer.

## Quick start

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# (opcional pero recomendado) consigue tu API key gratis en https://devportal.jamendo.com/
# y ponla en JAMENDO_CLIENT_ID — sin ella el catálogo usa solo Audius

# 3. Levantar todo (gateway :4000, music :4002, web :5173)
npm run dev
```

Abre <http://localhost:5173>, busca algo (ej. "lofi") y reproduce. 🎶

### Con Docker (un solo comando)

```bash
docker compose -f infra/docker-compose.yml up --build
```

Levanta web (nginx, :5173), gateway (:4000) y music (:4002) con healthchecks y red interna. Las variables (`JAMENDO_CLIENT_ID`...) se leen del `.env` de la raíz.

## Deploy (free tier)

| Pieza | Plataforma | Cómo |
|---|---|---|
| `apps/web` | **Vercel** | Importar el repo — [`vercel.json`](vercel.json) ya define build y rewrites SPA. Configurar `VITE_API_URL` con la URL del gateway. |
| `services/gateway` y `services/music` | **Render** | New → Blueprint → este repo — [`render.yaml`](render.yaml) crea ambos servicios Docker con healthchecks y autodeploy desde `main`. |

### Generar claves JWT de producción

El gateway firma JWT con RS256. En desarrollo genera un par efímero; en producción genera el tuyo y pégalo en las env vars de Render (`JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`):

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem
openssl pkey -in jwt-private.pem -pubout -out jwt-public.pem
```

> ⚠️ Los `.pem` jamás se versionan (ya están en `.gitignore`). Tras el primer deploy, apunta `CORS_ORIGINS` (Render) a la URL de Vercel y `VITE_API_URL` (Vercel) a la URL del gateway.
>
> 💤 El free tier de Render "duerme" tras 15 min sin tráfico — [UptimeRobot](https://uptimerobot.com) (gratis) puede hacer ping a `/healthz` para mantenerlo despierto.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta los 3 servicios en paralelo |
| `npm run typecheck` | TypeScript estricto en todos los workspaces |
| `npm test` | Tests unitarios (Vitest) |

## Créditos y licencias de recursos

- Iconos UI: [Lucide](https://lucide.dev) (licencia ISC) — repositorio de iconos open source.
- Música: APIs oficiales de [Jamendo](https://devportal.jamendo.com/) (Creative Commons) y [Audius](https://docs.audius.org/api/) (artistas independientes).
- Metadata: [MusicBrainz](https://musicbrainz.org/) (datos abiertos) — a partir de F3.
- **Sin assets generados por IA**: todos los recursos visuales provienen de repositorios abiertos con licencia verificable.

## Roadmap

- [x] **F1 — MVP catálogo**: búsqueda multi-fuente + reproducción + auth JWT + Docker + deploy (Vercel/Render)
- [ ] **F2 — Perfil y eventos**: historial, likes, eventos de escucha (Redis Streams), PostgreSQL
- [ ] **F3 — IA de contenido**: embeddings + "más como esta" + onboarding de gustos
- [ ] **F4 — IA híbrida**: filtrado colaborativo (ALS) + re-ranking contextual + explicabilidad
- [ ] **F5 — Pulido**: diagramas C4, OpenAPI navegable, demo en vivo

## Licencia

[MIT](LICENSE) © 2026 Maria del Carmen Salazar Torres
