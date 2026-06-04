# ADR-006 — Catálogo comercial vía previews de Deezer (30s)

- **Fecha**: 2026-06-04 · **Estado**: aceptada · **Fase**: F1.5

## Contexto

El catálogo CC (Jamendo/Audius) no contiene la música comercial que el usuario
reconoce; las búsquedas de artistas conocidos devolvían solo coincidencias
difusas indie ("la música nada que ver"). Reproducir catálogo comercial
completo requiere licencias con disqueras — inviable e ilegal para este
proyecto (ver §2: nunca se almacena ni sirve audio con copyright).

## Decisión

Añadir `DeezerAdapter` como tercera fuente del `MusicProvider` port, usando la
búsqueda pública de Deezer (sin API key) y sus **previews oficiales de 30s**
servidos desde su CDN. Las pistas se marcan `isPreview: true` en el dominio y
la UI lo muestra como badge "preview 30s". El orden de fuentes en el factory
(Deezer primero) define la prioridad del intercalado round-robin.

## Consecuencias

- ✅ Las búsquedas de artistas comerciales devuelven resultados reconocibles, legales y gratis.
- ✅ El streaming completo sigue siendo exclusivo del catálogo libre — refuerza el pitch del producto.
- ⚠️ 30s es un límite de licenciamiento, no técnico: no hay "fix". Evolución futura documentada: Spotify Web Playback SDK para que usuarios Premium reproduzcan completo con su propia cuenta (post-F5).
- ⚠️ Deezer no expone géneros en la búsqueda básica → `genreTags: []`; la metadata para la IA de F3 vendrá de MusicBrainz/AcousticBrainz.
