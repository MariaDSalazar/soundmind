# ADR-011 — Revertir JioSaavn: mantener solo catálogo libre y legal

- **Fecha**: 2026-06-09 · **Estado**: aceptada · **Fase**: F1.6
- **Supersede / revierte**: [ADR-009](ADR-009-jiosaavn-source.md)

## Contexto

ADR-009 integró JioSaavn para catálogo comercial completo. En pruebas reales
resultó inservible para el público objetivo:

- **Música india / Bollywood** (Arijit Singh…): resultados reales ✅.
- **Latino / occidental** (Bad Bunny, Romeo Santos, Karol G, Taylor Swift,
  The Weeknd): solo **covers, karaoke, remixes "sped up" y versiones 8-bit** —
  nunca el artista real ❌. Ese catálogo comercial no está licenciado en JioSaavn.

Se evaluó YouTube como alternativa con cobertura total:
- **Extraer audio** (Piped/Invidious/yt-dlp/cobalt) → viola los ToS de YouTube;
  además las instancias públicas no extraen audio de forma estable (`audioStreams`
  vacíos).
- **YouTube IFrame Player API oficial** → legal, pero implica anuncios, API key con
  cuota y un reproductor embebido distinto. Se ofreció y se descartó por decisión
  de producto (mantener la experiencia y el pitch limpios).

## Decisión

Retirar JioSaavn y **no integrar ninguna fuente comercial**. SoundMind reproduce
únicamente **catálogo libre y legal**: **Jamendo**, **Audius** e **Internet
Archive** (todo streaming completo).

Cambios: eliminado `SaavnAdapter`, su registro en el factory, la variable
`SAAVN_API_URL`, `'saavn'` de `TrackSource` y de la validación del users service.

## Consecuencias

- ✅ Resultados de búsqueda **siempre reales y relevantes** (sin covers/8-bit).
- ✅ Se preserva intacto el principio §2 ("solo música legal") — mejor pitch de
  portafolio, sin código de scrapers no oficiales.
- ✅ Cero dependencias externas frágiles ni API keys de zona gris.
- ⚠️ Sin catálogo comercial mainstream. Evolución futura plenamente legal
  (post-F5): Spotify Web Playback SDK con la cuenta Premium del propio usuario.
