# ADR-007 — Netlify en vez de Vercel para el frontend

- **Fecha**: 2026-06-04 · **Estado**: aceptada · **Fase**: F1

## Contexto

El plan original (§11) usaba Vercel para `apps/web`. En la práctica, el deploy
del monorepo npm-workspaces falló repetidamente: Vercel construye con
`NODE_ENV=production` (omite devDependencies en `npm ci`) y la configuración
de Root Directory del dashboard rompía la resolución de workspaces
(`npm error No workspaces found`).

## Decisión

Migrar el frontend a **Netlify** con `netlify.toml` versionado en la raíz:
build desde la raíz del monorepo (workspaces visibles), publish
`apps/web/dist`, redirects SPA y `NODE_VERSION=22`. Netlify no impone
`NODE_ENV=production` durante el install, así que las devDependencies (vite,
typescript) se instalan sin flags especiales.

## Consecuencias

- ✅ Deploy reproducible: toda la configuración vive en el repo, no en un dashboard.
- ✅ Free tier equivalente (100 GB/mes de banda) y CD automático desde `main`.
- ⚠️ Se pierden los preview-deploys por PR de Vercel (Netlify los ofrece como "Deploy Previews" — activar si se necesitan en F5).
- 🔗 URL de producción: https://soundmind19.netlify.app
