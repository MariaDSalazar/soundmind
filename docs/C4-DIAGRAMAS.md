# Diagramas C4 — SoundMind

Arquitectura en tres niveles del modelo [C4](https://c4model.com) (contexto →
contenedores → componentes). Diagramas en Mermaid: GitHub los renderiza solos.
Complementan la narrativa de [`ARQUITECTURA.md`](ARQUITECTURA.md).

## Nivel 1 — Contexto

Qué es SoundMind y con quién/qué habla.

```mermaid
flowchart TB
    user(["👤 Oyente"])
    sm["🎵 SoundMind<br/>Streaming de música libre + IA de recomendación"]
    jamendo[("Jamendo API<br/>Creative Commons")]
    audius[("Audius API<br/>artistas indie")]
    archive[("Internet Archive<br/>dominio público")]

    user -->|"busca, reproduce,<br/>recibe recomendaciones"| sm
    sm -->|"catálogo legal (solo URLs de CDN,<br/>nunca proxy de audio)"| jamendo
    sm --> audius
    sm --> archive
```

## Nivel 2 — Contenedores

Las piezas desplegables y cómo se comunican. El **entrenamiento pesado** (torch,
ALS) vive en GitHub Actions; el **serving** en Render es ligero (solo álgebra en
pgvector). Ver [ADR-012](adr/ADR-012-recommender-v1-batch-embeddings.md) y
[ADR-013](adr/ADR-013-recommender-v2-colaborativo-hibrido.md).

```mermaid
flowchart TB
    user(["👤 Oyente"])

    subgraph netlify["Netlify"]
      web["apps/web<br/>React 19 + Vite + Tailwind"]
    end

    subgraph render["Render · PaaS (free tier)"]
      gw["Gateway (BFF)<br/>Node · Express · JWT RS256"]
      music["Music<br/>Node · Express"]
      users["Users<br/>Node · Express"]
      rec["Recommender<br/>Python · FastAPI"]
    end

    subgraph data["Datos (free tier)"]
      pg[("PostgreSQL + pgvector<br/>Neon")]
      redis[("Redis Streams<br/>Upstash")]
    end

    subgraph gha["GitHub Actions · cron nocturno"]
      embed["Job embed<br/>sentence-transformers"]
      collab["Job collab<br/>ALS (implicit)"]
    end

    ext[("APIs de música<br/>Jamendo · Audius · Archive")]

    user -->|HTTPS| web
    web -->|"REST /api/v1 (BFF)"| gw
    gw --> music
    music --> ext
    gw -->|"perfil, likes, eventos"| users
    gw -->|"recomendaciones"| rec
    users --> pg
    users -->|"eventos de escucha (XADD)"| redis
    rec -->|"coseno + producto interno"| pg
    embed -->|"embeddings"| pg
    collab -->|"factores ALS + stats"| pg
```

## Nivel 3 — Componentes (Recommender)

El servicio que mejor muestra la **Arquitectura Hexagonal (Ports & Adapters)**:
el dominio define puertos; la infraestructura los implementa; los casos de uso no
saben que detrás hay pgvector.

```mermaid
flowchart LR
    client["Gateway (proxy)"]

    subgraph rec["services/recommender (Hexagonal)"]
      routes["Interfaces<br/>rutas FastAPI + auth JWT"]
      uc["Application<br/>casos de uso + ranker híbrido"]
      ports[["Domain<br/>ports + modelos"]]
      adapter["Infrastructure<br/>PgRecommendationRepository"]
    end

    pg[("pgvector<br/>coseno + producto interno")]

    client -->|HTTP| routes
    routes --> uc
    uc -->|"depende de"| ports
    adapter -. "implementa" .-> ports
    uc --> adapter
    adapter --> pg
```

> El **ranker híbrido** combina contenido (coseno de `taste_vec`) + colaborativo
> (producto interno de factores ALS) con fallback a contenido, y re-rankea por
> contexto (hora, skips). Lógica de dominio pura y testeada.
