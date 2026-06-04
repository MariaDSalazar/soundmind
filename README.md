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

- [x] **F1 — MVP catálogo**: búsqueda multi-fuente + reproducción + auth JWT
- [ ] **F2 — Perfil y eventos**: historial, likes, eventos de escucha (Redis Streams), PostgreSQL
- [ ] **F3 — IA de contenido**: embeddings + "más como esta" + onboarding de gustos
- [ ] **F4 — IA híbrida**: filtrado colaborativo (ALS) + re-ranking contextual + explicabilidad
- [ ] **F5 — Pulido**: diagramas C4, OpenAPI navegable, demo en vivo

## Licencia

[MIT](LICENSE) © 2026 Maria del Carmen Salazar Torres
