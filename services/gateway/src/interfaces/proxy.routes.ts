import { Router } from 'express';

/**
 * PATTERN: BFF (Backend For Frontend) — el cliente solo habla con el
 * Gateway; las API keys de terceros viven en el servicio de música y
 * jamás llegan al navegador.
 */
export function buildProxyRoutes(musicServiceUrl: string): Router {
  const router = Router();

  router.get('/tracks/search', async (req, res) => {
    const url = new URL('/tracks/search', musicServiceUrl);
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') url.searchParams.set(key, value);
    }

    try {
      const upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      res.status(upstream.status).json(await upstream.json());
    } catch {
      res.status(502).json({
        type: 'about:blank',
        title: 'Servicio de música no disponible',
        status: 502,
      });
    }
  });

  return router;
}
