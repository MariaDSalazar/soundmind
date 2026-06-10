# ADR-009 — Fuente comercial completa vía API no oficial de JioSaavn

- **Fecha**: 2026-06-09 · **Estado**: ❌ REVERTIDA (ver [ADR-011](ADR-011-revertir-jiosaavn-stay-legal.md)) · **Fase**: F1.6

> **Reversión (2026-06-09)**: en pruebas, JioSaavn solo tiene catálogo real de
> música **india/Bollywood**. Para artistas latinos/occidentales (Bad Bunny,
> Romeo Santos, Taylor Swift…) devuelve covers, karaoke y versiones 8-bit, no las
> canciones reales. Se retira la fuente y se mantiene solo catálogo libre. La
> decisión y el contexto original se conservan abajo como registro histórico.


## Contexto

El catálogo libre (Jamendo/Audius/Internet Archive) da streaming completo pero no
la música comercial reconocible; Deezer solo ofrece previews de 30s (ADR-006).
Los usuarios pedían reproducir canciones comerciales **completas**.

Se evaluaron las opciones que usan los proyectos OSS de streaming (Spotube,
Harmony, OpenSpot):
- **Free Music Archive**: API pública discontinuada → descartada.
- **ccMixter**: API real pero 10-15 s de latencia → descartada (bloquearía la búsqueda).
- **YouTube** (Piped/Invidious): casi todo el catálogo, pero instancias públicas
  inestables, integración más pesada y viola los ToS de YouTube.
- **JioSaavn (API no oficial)**: devuelve canciones comerciales completas (AAC 320k
  desde `aac.saavncdn.com`) en un request rápido; encaja en el patrón Adapter.

## Decisión

Integrar **JioSaavn** como `MusicProvider` (`SaavnAdapter`, source `saavn`),
**opcional** detrás de la variable `SAAVN_API_URL` (si no se define, la fuente no
se activa). Va primero en el round-robin por ser el catálogo reconocible.

## Consecuencias

- ✅ Búsquedas de artistas comerciales devuelven canciones **completas**, rápidas.
- ✅ Encaje limpio en la arquitectura hexagonal (un adaptador más, sin tocar el dominio).
- ⚠️ **Legalidad (zona gris)**: es una API **no oficial** que scrapea JioSaavn.
  Contradice el principio §2 ("solo música legal CC/dominio público"). Por eso es
  **opcional y desactivable**: la demo pública puede correr sin ella (solo fuentes
  legales) y activarse en local. No se almacena audio: solo se reproducen URLs del
  CDN de JioSaavn.
- ⚠️ **Estabilidad**: las instancias públicas de la API son poco fiables; se
  recomienda **auto-hospedar** (`sumitkolhe/jiosaavn-api`, open source) para
  producción.
- 🔭 Evolución preferible a futuro (post-F5): Spotify Web Playback SDK para
  reproducir comercial completo de forma plenamente legal con la cuenta Premium
  del propio usuario.
