import { Router } from 'express';

/**
 * PATTERN: BFF — el cliente solo habla con el Gateway. Estas rutas reenvían las
 * operaciones de perfil (likes, historial, eventos) al users service,
 * propagando el `Authorization` para que ESE servicio también verifique el JWT
 * (defensa en profundidad, §9 / ADR-008).
 */
export function buildUsersProxyRoutes(usersServiceUrl: string): Router {
  const router = Router();

  // Reenvía likes, historial y eventos de escucha (sub-rutas de /me).
  const forward = async (
    method: string,
    path: string,
    auth: string | undefined,
    body: unknown,
  ): Promise<{ status: number; payload: unknown }> => {
    const url = new URL(path, usersServiceUrl);
    const hasBody = method === 'POST' || method === 'PUT';
    const upstream = await fetch(url, {
      method,
      headers: {
        ...(auth ? { authorization: auth } : {}),
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
      },
      body: hasBody ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    // 204/202 sin cuerpo: no intentes parsear JSON.
    const text = await upstream.text();
    return { status: upstream.status, payload: text ? JSON.parse(text) : null };
  };

  const handler = (buildPath: (req: import('express').Request) => string) =>
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
          title: 'Servicio de usuarios no disponible',
          status: 502,
        });
      }
    };

  router.get('/me/history', handler((req) => `/me/history${toQuery(req.query)}`));
  router.get('/me/likes', handler(() => '/me/likes'));
  router.put('/me/likes/:trackId', handler((req) => `/me/likes/${encodeURIComponent(String(req.params.trackId))}`));
  router.delete('/me/likes/:trackId', handler((req) => `/me/likes/${encodeURIComponent(String(req.params.trackId))}`));
  router.post('/me/listen-events', handler(() => '/me/listen-events'));

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
