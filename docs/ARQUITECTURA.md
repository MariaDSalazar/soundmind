# 🎵 SoundMind — Plataforma de Streaming con IA de Recomendación

> Documento de Arquitectura de Software — v1.0 (Junio 2026)
> Proyecto de portafolio: streaming musical legal + motor de recomendación con IA que aprende de los gustos del usuario.

---

## Tabla de Contenido

1. [Visión del Producto](#1-visión-del-producto)
2. [Restricciones y Principios](#2-restricciones-y-principios)
3. [Arquitectura General](#3-arquitectura-general)
4. [Stack Tecnológico (100% gratuito)](#4-stack-tecnológico-100-gratuito)
5. [APIs Externas (legales y abiertas)](#5-apis-externas-legales-y-abiertas)
6. [Motor de IA de Recomendación](#6-motor-de-ia-de-recomendación)
7. [Patrones de Diseño](#7-patrones-de-diseño)
8. [Protocolos de Comunicación](#8-protocolos-de-comunicación)
9. [Seguridad](#9-seguridad)
10. [Modelo de Datos](#10-modelo-de-datos)
11. [Despliegue (free tier)](#11-despliegue-free-tier)
12. [Estructura del Repositorio](#12-estructura-del-repositorio)
13. [Roadmap por Fases](#13-roadmap-por-fases)

---

## 1. Visión del Producto

**SoundMind** es una aplicación web de streaming musical que:

- Reproduce **música legal**: catálogo Creative Commons (Jamendo, Audius) con streaming completo, y previews de 30s (Deezer) para catálogo comercial.
- Integra un **motor de IA propio** que aprende de las interacciones del usuario (plays, skips, repeticiones, hora del día, likes) y recomienda música afín a su estilo.
- Explica sus recomendaciones (*"te sugiero esto porque escuchaste X y comparten patrón rítmico"*).

**Diferenciador clave**: tras el cierre de la API de recomendaciones de Spotify (2024–2026), construir el recomendador propio con datos abiertos es precisamente lo que demuestra seniority técnico.

---

## 2. Restricciones y Principios

| Restricción | Decisión |
|---|---|
| **Costo: $0** | Solo free tiers y open source. Sin tarjeta de crédito requerida. |
| **Legalidad** | Solo música CC/dominio público en streaming completo; previews oficiales para lo comercial. Nunca se almacena audio con copyright. |
| **Portafolio** | Código limpio, documentado, con tests, CI/CD y diagramas. El repo es el producto. |
| **Principios** | SOLID, Clean Architecture, 12-Factor App, API-first, seguridad por diseño. |

---

## 3. Arquitectura General

Se adopta una **arquitectura de microservicios ligera** (3 servicios) sobre **Clean Architecture / Hexagonal** en cada servicio. Suficientemente simple para un free tier, suficientemente seria para un portafolio.

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTE                                │
│   React + TypeScript (SPA/PWA) — Vercel                         │
└───────────────┬─────────────────────────────┬───────────────────┘
                │ HTTPS / REST (JSON)         │ WebSocket (eventos)
                ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY (BFF)                           │
│   Node.js + Express — auth, rate limit, agregación, caché       │
└──────┬──────────────────────┬──────────────────────┬────────────┘
       │ REST interno         │ REST interno         │ Cola (pub/sub)
       ▼                      ▼                      ▼
┌──────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ MUSIC SERVICE│   │  USER SERVICE      │   │ RECOMMENDER SERVICE│
│ (Node.js)    │   │  (Node.js)         │   │ (Python + FastAPI) │
│ Catálogo,    │   │  Perfiles, auth,   │   │ Modelo híbrido,    │
│ búsqueda,    │   │  historial,        │   │ embeddings,        │
│ streaming    │   │  eventos de        │   │ entrenamiento      │
│ (proxy APIs) │   │  escucha           │   │ incremental        │
└──────┬───────┘   └─────────┬──────────┘   └─────────┬──────────┘
       │                     │                        │
       ▼                     ▼                        ▼
┌─────────────┐   ┌─────────────────┐   ┌─────────────────────────┐
│ APIs        │   │ PostgreSQL      │   │ PostgreSQL + pgvector   │
│ externas:   │   │ (Supabase/Neon) │   │ (embeddings) +          │
│ Jamendo,    │   │ + Redis (Upstash│   │ Modelos: implicit ALS,  │
│ Audius,     │   │   - caché/cola) │   │ sentence-transformers   │
│ Deezer,     │   └─────────────────┘   └─────────────────────────┘
│ MusicBrainz,│
│ Last.fm     │
└─────────────┘
```

### Capas internas de cada servicio (Hexagonal)

```
src/
├── domain/          # Entidades + reglas de negocio (sin dependencias)
├── application/     # Casos de uso (use cases / services)
├── infrastructure/  # Adaptadores: DB, APIs externas, colas
└── interfaces/      # Controladores HTTP/WS, DTOs, validación
```

**Regla de dependencia**: las capas externas dependen de las internas, nunca al revés. El dominio no sabe que existe Express ni PostgreSQL.

### Decisiones de arquitectura (ADRs resumidos)

| # | Decisión | Razón |
|---|---|---|
| ADR-001 | Microservicios ligeros (3) en vez de monolito | Demuestra arquitectura distribuida sin sobre-ingeniería; el recomendador en Python exige separación de runtime. |
| ADR-002 | BFF / API Gateway propio | Centraliza auth, rate-limiting y oculta API keys de terceros al cliente. |
| ADR-003 | Python para el recomendador | Ecosistema ML (scikit-learn, implicit, sentence-transformers) sin equivalente en Node. |
| ADR-004 | pgvector en vez de un vector DB dedicado | Un solo Postgres gratuito (Supabase) cubre relacional + vectorial. |
| ADR-005 | Eventos de escucha vía cola (Upstash Redis Streams) | Desacopla la escritura del entrenamiento; patrón event-driven real. |

---

## 4. Stack Tecnológico (100% gratuito)

| Capa | Tecnología | Free tier |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS | Open source |
| Estado | Zustand + TanStack Query | Open source |
| Audio | HTML5 `<audio>` + Media Session API | Nativo |
| Gateway / servicios Node | Node.js 22 + Express + Zod | Open source |
| Recomendador | Python 3.12 + FastAPI + scikit-learn + `implicit` + sentence-transformers | Open source |
| Base de datos | PostgreSQL 16 + pgvector — **Supabase** (500 MB) o **Neon** (3 GB) | Gratis |
| Caché / cola | **Upstash Redis** (10k comandos/día) | Gratis |
| Auth | JWT propio (RS256) + OAuth 2.0 social (GitHub/Google) | Gratis |
| CI/CD | GitHub Actions | Gratis (repos públicos) |
| Hosting frontend | Vercel / Cloudflare Pages | Gratis |
| Hosting backend | Render / Railway / Fly.io free tier | Gratis |
| Observabilidad | Pino (logs) + Sentry free tier + UptimeRobot | Gratis |
| Documentación API | OpenAPI 3.1 + Swagger UI | Gratis / open source |
| Iconos UI | **Lucide** (`lucide-react`, licencia ISC) | Gratis / open source |
| Logos de marcas | **Simple Icons** (CC0) | Gratis / open source |
| Ilustraciones | **unDraw** (licencia abierta propia) | Gratis |

### 4.1 Política de recursos visuales

> 🚫 **Sin assets generados por IA.** Todos los iconos e ilustraciones provienen de repositorios de acceso abierto con licencias permisivas verificables:
>
> | Recurso | Repositorio | Licencia |
> |---|---|---|
> | Iconos de interfaz (play, skip, búsqueda, corazón...) | [Lucide](https://lucide.dev) — fork comunitario de Feather | ISC |
> | Iconos alternativos | [Tabler Icons](https://tabler.io/icons) | MIT |
> | Logos de marcas (GitHub, Google para OAuth) | [Simple Icons](https://simpleicons.org) | CC0 |
> | Ilustraciones (estados vacíos, onboarding) | [unDraw](https://undraw.co) | Open license |
>
> Esto garantiza atribución limpia y cero riesgo legal en un repositorio público.

---

## 5. APIs Externas (legales y abiertas)

| API | Uso en SoundMind | Licencia / límites |
|---|---|---|
| **Jamendo API** | Streaming completo de música Creative Commons | Gratis con API key; uso legal incluso comercial |
| **Audius API** | Streaming de artistas independientes (descentralizado) | Abierta, sin key |
| **Deezer API** | Búsqueda en catálogo comercial + previews 30s + portadas | Gratis tier básico |
| **MusicBrainz** | Metadata canónica (artistas, álbumes, géneros, MBIDs) | Abierta, sin key (rate limit 1 req/s) |
| **AcousticBrainz / Essentia** | Características acústicas (BPM, energía, mood) para el modelo de contenido | Datos abiertos / lib open source |
| **ListenBrainz** | Datasets abiertos de escuchas para bootstrap del filtrado colaborativo | Abierta |
| **Last.fm API** | Tags sociales y artistas similares (señal extra) | Gratis no comercial |

> ⚖️ **Política legal del proyecto**: ningún audio se descarga ni almacena en servidores propios. El streaming CC se sirve desde los CDN de Jamendo/Audius; los previews de Deezer se reproducen desde sus URLs oficiales. Solo se persisten metadatos y eventos de interacción del usuario (con su consentimiento — ver §9).

---

## 6. Motor de IA de Recomendación

**Modelo híbrido en tres señales**, con cold-start resuelto:

### 6.1 Filtrado colaborativo (lo que escuchan usuarios similares)
- Algoritmo: **ALS sobre feedback implícito** (librería `implicit`), entrenado con eventos propios + dataset abierto de ListenBrainz para arrancar.
- Matriz usuario×track ponderada: play completo = 1.0, repeat = 1.5, skip < 30 s = −0.5, like = 2.0.

### 6.2 Basado en contenido (cómo suena la música)
- **Embeddings de texto**: `sentence-transformers` sobre tags + género + descripción → vector 384-d en pgvector.
- **Características acústicas**: BPM, energía, valencia desde AcousticBrainz/Essentia.
- Similitud coseno vía `pgvector` (`<=>`) para "más como esta".

### 6.3 Contextual (cuándo y cómo escucha el usuario)
- Features: hora del día, día de semana, racha de skips, dispositivo.
- Re-ranking ligero (regresión logística) sobre los candidatos de 6.1 + 6.2.

### 6.4 Aprendizaje continuo
```
Usuario reproduce/skipea → evento a Redis Stream → Recommender consume
→ actualiza matriz incremental → re-entrenamiento batch nocturno (GitHub Actions cron)
→ nuevo modelo versionado → swap sin downtime
```

### 6.5 Explicabilidad
Cada recomendación devuelve `reason`: `{"type": "similar_track", "anchor": "track_id", "signal": "rhythm+tags"}` → la UI lo traduce a *"Porque escuchaste X"*. Diferenciador frente a las cajas negras comerciales.

### 6.6 Cold start
Onboarding: el usuario elige 3–5 géneros/artistas → recomendación por contenido pura → el colaborativo entra a partir de ~20 eventos.

---

## 7. Patrones de Diseño

### Arquitectónicos
| Patrón | Dónde |
|---|---|
| **Hexagonal (Ports & Adapters)** | Todos los servicios: el dominio define puertos (`MusicCatalogPort`), la infraestructura los implementa (`JamendoAdapter`). |
| **BFF (Backend For Frontend)** | API Gateway: agrega respuestas de los 3 servicios para el cliente. |
| **Event-Driven / Pub-Sub** | Eventos de escucha por Redis Streams hacia el recomendador. |
| **CQRS ligero** | Escritura de eventos (cola) separada de lectura de recomendaciones (caché). |
| **Repository** | Acceso a datos abstraído del dominio (`UserRepository`, `TrackRepository`). |

### GoF / tácticos
| Patrón | Uso concreto |
|---|---|
| **Adapter** | Un adaptador por API externa (Jamendo, Audius, Deezer, MusicBrainz) implementando la misma interfaz `MusicProvider`. |
| **Strategy** | Estrategias de recomendación intercambiables (`CollaborativeStrategy`, `ContentBasedStrategy`, `HybridStrategy`). |
| **Facade** | `RecommendationFacade` orquesta las 3 señales y el re-ranking. |
| **Factory Method** | `ProviderFactory` instancia el `MusicProvider` correcto según la fuente del track. |
| **Observer** | El reproductor emite eventos (`play`, `skip`, `complete`) que los listeners de analítica/IA consumen. |
| **Circuit Breaker** | (resiliencia, lib `opossum`) ante caídas de APIs externas → fallback a otra fuente o caché. |
| **Decorator** | Caché y rate-limit envuelven a los adaptadores de APIs externas. |
| **Singleton controlado** | Pool de conexiones DB y cliente Redis (vía inyección de dependencias, no global). |

> 💡 En el repo, cada patrón se documenta con un comentario `// PATTERN: Adapter — ...` y se lista en `docs/patterns.md`. Eso lo hace evidente al reclutador.

---

## 8. Protocolos de Comunicación

| Canal | Protocolo | Detalle |
|---|---|---|
| Cliente ↔ Gateway | **HTTPS / REST (JSON)** — OpenAPI 3.1 | Versionado `/api/v1`, paginación cursor-based, códigos HTTP semánticos, errores RFC 9457 (Problem Details). |
| Cliente ↔ Gateway (tiempo real) | **WebSocket (WSS)** | Notificaciones: "nueva recomendación lista", sincronización de estado del player. |
| Gateway ↔ servicios internos | **REST interno** sobre red privada; tokens de servicio (JWT `aud` interno) | Sencillo y debuggeable; gRPC se documenta como evolución futura en ADR. |
| Servicios ↔ Recommender (eventos) | **Redis Streams** (pub/sub con consumer groups) | Entrega at-least-once, idempotencia por `event_id`. |
| Backend ↔ APIs externas | **HTTPS** + API keys en servidor | Nunca expuestas al navegador; con retry exponencial + circuit breaker. |
| Streaming de audio | **HTTPS progresivo** desde CDNs oficiales de Jamendo/Audius/Deezer | El backend solo entrega URLs firmadas/oficiales; jamás proxy del audio. |
| Auth social | **OAuth 2.0 (Authorization Code + PKCE)** | GitHub/Google como IdP. |

---

## 9. Seguridad

### Autenticación y autorización
- **OAuth 2.0 + PKCE** para login social; registro propio con **Argon2id** para hashes de contraseña.
- **JWT RS256** (clave asimétrica): access token 15 min + refresh token rotativo 7 días en cookie `HttpOnly; Secure; SameSite=Strict`.
- Revocación de refresh tokens (lista en Redis). Detección de reuso de refresh token → cierre de sesión global.
- **RBAC** simple: roles `user` / `admin`.

### Protección de la API
- **Rate limiting** por IP y por usuario en el Gateway (Upstash Ratelimit) — protege también las cuotas de APIs externas.
- **Validación de entrada** estricta con Zod (Node) y Pydantic (Python) en cada borde. Nada entra sin esquema.
- **Helmet** + CSP estricta, CORS con allowlist explícita, HSTS.
- Prevención clásica: queries parametrizadas (anti SQLi), escape en render (anti XSS — React lo da por defecto), tokens anti-CSRF en mutaciones con cookies.

### Secretos y supply chain
- Secretos solo en variables de entorno / GitHub Secrets; `.env.example` versionado, `.env` jamás.
- **Dependabot + `npm audit` / `pip-audit` en CI**; lockfiles obligatorios.
- Análisis estático: **CodeQL** (GitHub, gratis en repos públicos) + ESLint security plugin.
- Imágenes Docker non-root, distroless cuando aplique.

### Datos y privacidad
- Solo se guardan: email (hash de verificación), preferencias y eventos de escucha. **Sin datos sensibles.**
- Consentimiento explícito para tracking de escucha (banner + toggle en perfil) — alineado a GDPR/LOPD.
- Endpoint `DELETE /api/v1/me` → borrado total (derecho al olvido).
- TLS en todo (Vercel/Render lo dan gratis); cifrado at-rest incluido en Supabase/Neon.

### Modelo de amenazas (resumen STRIDE)
| Amenaza | Mitigación |
|---|---|
| Spoofing | OAuth + JWT firmado RS256 |
| Tampering | HTTPS everywhere, validación de esquema |
| Repudiation | Logs estructurados con request-id correlacionado |
| Information disclosure | API keys solo en servidor, CSP, cookies HttpOnly |
| DoS | Rate limiting, circuit breakers, caché agresiva |
| Elevation of privilege | RBAC verificado en Gateway y en cada servicio |

---

## 10. Modelo de Datos

```sql
-- Núcleo (PostgreSQL)
users(id, email, password_hash, display_name, consent_tracking, created_at)
tracks(id, source, source_track_id, title, artist, genre_tags[], duration_s,
       stream_url, artwork_url, mbid, created_at)           -- solo metadata, nunca audio
listen_events(id, user_id, track_id, event_type, played_ms, context_hour,
              device, created_at)                            -- play|skip|complete|like
playlists(id, user_id, name, is_ai_generated, created_at)
playlist_tracks(playlist_id, track_id, position)

-- IA (pgvector)
track_embeddings(track_id, content_vec vector(384), acoustic_features jsonb)
user_profiles(user_id, taste_vec vector(384), updated_at)    -- centroide de gustos
recommendations(id, user_id, track_id, score, reason jsonb, model_version,
                served_at, feedback)                          -- feedback loop
```

---

## 11. Despliegue (free tier)

```
GitHub (monorepo)
   └── GitHub Actions
        ├── CI: lint + test + audit + CodeQL (en cada PR)
        ├── CD frontend  → Vercel (preview por PR + prod en main)
        ├── CD servicios → Render (Docker, autodeploy desde main)
        └── cron nocturno → re-entrenamiento del modelo + publicación de artefacto
```

- **Docker Compose** para levantar todo en local con un comando (`docker compose up`).
- Healthchecks `/healthz` por servicio; UptimeRobot los mantiene "despiertos" en el free tier de Render.
- Migraciones de DB versionadas (node-pg-migrate / Alembic) ejecutadas en CD.

---

## 12. Estructura del Repositorio

```
soundmind/
├── README.md                  # Pitch + demo GIF + badges CI + arquitectura resumida
├── docs/
│   ├── ARQUITECTURA.md        # este documento
│   ├── adr/                   # ADR-001..N (decisiones registradas)
│   ├── patterns.md            # mapa de patrones → archivos
│   └── api/openapi.yaml       # contrato OpenAPI 3.1
├── apps/
│   └── web/                   # React + TS (Vite)
├── services/
│   ├── gateway/               # Node — BFF, auth, rate limit
│   ├── music/                 # Node — catálogo, adaptadores de APIs
│   ├── users/                 # Node — perfiles, eventos
│   └── recommender/           # Python — FastAPI + modelos
├── packages/
│   └── shared/                # tipos TS compartidos, esquemas Zod
├── infra/
│   ├── docker-compose.yml
│   └── github-actions/        # workflows reutilizables
└── .github/workflows/         # ci.yml, deploy.yml, retrain.yml
```

---

## 13. Roadmap por Fases

| Fase | Entregable | Alcance |
|---|---|---|
| **F1 — MVP catálogo** (2 sem) | Buscar y reproducir música de Jamendo/Audius; auth JWT; deploy completo | Gateway + Music + Web |
| **F2 — Perfil y eventos** (1 sem) | Historial, likes, eventos de escucha a Redis Streams | Users service |
| **F3 — IA contenido** (2 sem) | Embeddings + "más como esta" + onboarding de gustos (cold start) | Recommender v1 |
| **F4 — IA colaborativa + híbrida** (2 sem) | ALS + re-ranking contextual + explicabilidad + re-entrenamiento programado | Recommender v2 |
| **F5 — Pulido portafolio** (1 sem) | README con demo, diagramas C4, tests >80% en dominio, Lighthouse >90, video demo | Todo |

---

### ✅ Checklist "carta de presentación"

- [ ] README con GIF de demo y badges (CI, cobertura, licencia MIT)
- [ ] Diagramas C4 (contexto, contenedores, componentes) en `docs/`
- [ ] ADRs que justifican cada decisión técnica
- [ ] OpenAPI navegable (Swagger UI público)
- [ ] Tests unitarios en dominio + tests de integración por servicio
- [ ] CodeQL y Dependabot activos y en verde
- [ ] Demo en vivo desplegada (Vercel + Render) linkeada en el README
- [ ] Sección "Lo que aprendí / trade-offs" — los reclutadores la valoran más que el código

---

*Documento vivo: las decisiones nuevas se registran como ADR en `docs/adr/` en lugar de editar este archivo silenciosamente.*
