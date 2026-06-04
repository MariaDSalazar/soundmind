import { Router } from 'express';
import { z } from 'zod';
import type { SearchTracksUseCase } from '../application/search-tracks.js';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export function buildRoutes(searchTracks: SearchTracksUseCase): Router {
  const router = Router();

  router.get('/tracks/search', async (req, res) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      // Errores RFC 9457 (Problem Details)
      res.status(400).json({
        type: 'about:blank',
        title: 'Parámetros de búsqueda inválidos',
        status: 400,
        detail: parsed.error.issues.map((i) => i.message).join('; '),
      });
      return;
    }

    const result = await searchTracks.execute(parsed.data.q, parsed.data.limit);
    res.json(result);
  });

  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', service: 'music' });
  });

  return router;
}
