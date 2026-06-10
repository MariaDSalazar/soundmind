import { Router } from 'express';

/**
 * PATTERN: BFF — reenvía las operaciones de recomendación (F3) al Recommender
 * service, propagando el `Authorization` para que ESE servicio verifique el JWT
 * en los endpoints por-usuario (defensa en profundidad, §9 / ADR-012).
 */
export function buildRecommenderProxyRoutes(recommenderServiceUrl: string): Router {
  const router = Router();

  const forward = async (
    method: string,
    path: string,
    auth: string | undefined,
    body: unknown,
  ): Promise<{ status: number; payload: unknown }> => {
    const url = new URL(path, recommenderServiceUrl);
    const hasBody = method === 'POST' || method === 'PUT';
    const upstream = await fetch(url, {
      method,
      headers: {
        ...(auth ? { authorization: auth } : {}),
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
      },
      body: hasBody ? JSON.stringify(body ?? {}) : undefined,
      // 30s: el recommender es Python en Render free y arranca más lento que los
      // servicios Node; un cold start no debe traducirse en 502 para el usuario.
      signal: AbortSignal.timeout(30_000),
    });
    const text = await upstream.text();
    return { status: upstream.status, payload: text ? JSON.parse(text) : null };
  };

  const handler = (
    buildPath: (req: import('express').Request) => string,
  ) =>
    async (req: import('express').Request, res: import('express').Response) => {
      try {
        const { status, payload } = await forward(
          req.method,
          buildPath(req),
          req.headers.authorization,
          req.body,
        );
        if (payload === null) return res.status(status).end();
        res.status(status).json(payload);
      } catch {
        res.status(502).json({
          type: 'about:blank',
          title: 'Servicio de recomendación no disponible',
          status: 502,
        });
      }
    };

  // trackId lleva ':' ("source:id"); se encodea para que viaje en la URL.
  router.get(
    '/recommendations/similar/:trackId',
    handler((req) => `/recommendations/similar/${encodeURIComponent(String(req.params.trackId))}${toQuery(req.query)}`),
  );
  router.get('/recommendations/onboarding/genres', handler((req) => `/recommendations/onboarding/genres${toQuery(req.query)}`));
  router.post('/recommendations/onboarding', handler(() => '/recommendations/onboarding'));
  router.get('/recommendations/for-me', handler((req) => `/recommendations/for-me${toQuery(req.query)}`));

  return router;
}

function toQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (typeof v === 'string') params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}
