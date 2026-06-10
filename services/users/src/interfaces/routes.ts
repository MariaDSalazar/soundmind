import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { RecordListenEventUseCase } from '../application/record-listen-event.js';
import type { GetHistoryUseCase } from '../application/get-history.js';
import type { ToggleLikeUseCase } from '../application/toggle-like.js';

/** `${source}:${sourceTrackId}` — mismo formato que Track.id en @soundmind/shared. */
const trackId = z
  .string()
  .trim()
  .regex(/^(jamendo|audius|archive):.+/, 'trackId debe ser "<source>:<id>"');

// Snapshot de la pista (event sourcing): se valida laxo pero con forma de Track.
const trackSnapshot = z.object({
  id: z.string(),
  source: z.enum(['jamendo', 'audius', 'archive']),
  sourceTrackId: z.string(),
  title: z.string(),
  artist: z.string(),
  durationS: z.number(),
  streamUrl: z.string(),
  artworkUrl: z.string().nullable(),
  genreTags: z.array(z.string()),
  isPreview: z.boolean().optional(),
});

const listenEventSchema = z.object({
  trackId,
  eventType: z.enum(['play', 'skip', 'complete']),
  playedMs: z.coerce.number().int().min(0).max(86_400_000),
  device: z.string().trim().max(40).optional(),
  track: trackSnapshot.optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});

function problem(res: Parameters<RequestHandler>[1], status: number, title: string, detail?: string) {
  res.status(status).json({ type: 'about:blank', title, status, detail });
}

export interface UsersDeps {
  recordEvent: RecordListenEventUseCase;
  getHistory: GetHistoryUseCase;
  likes: ToggleLikeUseCase;
  /** Middleware de auth ya configurado con la clave pública. */
  requireAuth: RequestHandler;
}

/**
 * Rutas del users service. Se montan bajo `/me` y el gateway las expone como
 * `/api/v1/me/...`. Todas exigen auth y devuelven errores RFC 9457.
 */
export function buildRoutes(deps: UsersDeps): Router {
  const router = Router();
  const { requireAuth } = deps;

  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', service: 'users' });
  });

  router.post('/me/listen-events', requireAuth, async (req, res) => {
    const parsed = listenEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return problem(res, 400, 'Evento de escucha inválido', parsed.error.issues.map((i) => i.message).join('; '));
    }
    const result = await deps.recordEvent.execute(req.user!.id, parsed.data);
    // 204 si el usuario no consintió tracking (privacidad por diseño, §9).
    res.status(result === 'recorded' ? 202 : 204).end();
  });

  router.get('/me/history', requireAuth, async (req, res) => {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return problem(res, 400, 'Parámetros de historial inválidos', parsed.error.issues.map((i) => i.message).join('; '));
    }
    const page = await deps.getHistory.execute(req.user!.id, parsed.data.limit, parsed.data.cursor ?? null);
    res.json(page);
  });

  router.get('/me/likes', requireAuth, async (req, res) => {
    res.json({ likes: await deps.likes.list(req.user!.id) });
  });

  router.put('/me/likes/:trackId', requireAuth, async (req, res) => {
    const parsed = trackId.safeParse(req.params.trackId);
    if (!parsed.success) return problem(res, 400, 'trackId inválido');
    res.status(200).json(await deps.likes.add(req.user!.id, parsed.data));
  });

  router.delete('/me/likes/:trackId', requireAuth, async (req, res) => {
    const parsed = trackId.safeParse(req.params.trackId);
    if (!parsed.success) return problem(res, 400, 'trackId inválido');
    await deps.likes.remove(req.user!.id, parsed.data);
    res.status(204).end();
  });

  return router;
}
