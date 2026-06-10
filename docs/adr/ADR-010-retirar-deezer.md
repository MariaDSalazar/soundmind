# ADR-010 — Retirar Deezer (previews de 30s)

- **Fecha**: 2026-06-09 · **Estado**: aceptada · **Fase**: F1.6
- **Supersede**: [ADR-006](ADR-006-deezer-previews.md)

## Contexto

ADR-006 añadió Deezer para cubrir catálogo comercial reconocible, aceptando el
límite de **previews de 30s** (restricción de licenciamiento). Con la integración
de JioSaavn (ADR-009) ese mismo catálogo comercial ahora se reproduce **completo**,
así que los previews de 30s dejaron de aportar y degradaban la experiencia.

## Decisión

Eliminar el `DeezerAdapter` y la fuente `deezer`:
- Borrado `services/music/src/infrastructure/deezer.adapter.ts` y su registro en el factory.
- Quitado `'deezer'` de `TrackSource` (`@soundmind/shared`) y de la validación del users service.

Todas las fuentes activas (JioSaavn, Jamendo, Audius, Internet Archive) sirven
ahora **streaming completo**.

## Consecuencias

- ✅ No más resultados a medias: todo lo que aparece se reproduce completo.
- ✅ Menos código y una fuente externa menos que mantener.
- ⚠️ Eventos antiguos en `listen_events` con `track_id` `deezer:*` siguen en la BD
  (solo se valida al insertar); el historial los muestra como no reproducibles
  (sin snapshot) — sin impacto funcional.
- ⚠️ El campo `Track.isPreview` y su badge en la UI quedan sin uso (ninguna fuente
  marca previews); se conservan por si se reintroduce una fuente de previews.
