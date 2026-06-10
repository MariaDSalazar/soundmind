import { Router } from 'express';
import { z } from 'zod';
import type { PostgresUserRepository } from '../infrastructure/postgres.user.repository.js';
import { requireAuth } from './middleware.js';
import type { AuthService } from '../application/auth.service.js';

const consentSchema = z.object({ consentTracking: z.boolean() });

/**
 * Rutas de cuenta que el GATEWAY posee porque es dueño de la tabla `users`
 * (ADR-008): leer perfil con consentimiento, alternar consentimiento y borrar
 * la cuenta (derecho al olvido, §9).
 */
export function buildAccountRoutes(users: PostgresUserRepository, auth: AuthService): Router {
  const router = Router();

  // Perfil del usuario autenticado, incluyendo su estado de consentimiento.
  router.get('/me', requireAuth(auth), async (req, res) => {
    const record = await users.findById(req.user!.id);
    if (!record) return res.status(404).json({ type: 'about:blank', title: 'Usuario no encontrado', status: 404 });
    res.json({
      id: record.id,
      email: record.email,
      displayName: record.displayName,
      consentTracking: record.consentTracking ?? false,
    });
  });

  // Activar/desactivar el consentimiento de tracking (banner de privacidad).
  router.put('/me/consent', requireAuth(auth), async (req, res) => {
    const parsed = consentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ type: 'about:blank', title: 'Valor de consentimiento inválido', status: 400 });
    }
    await users.setConsentTracking(req.user!.id, parsed.data.consentTracking);
    res.json({ consentTracking: parsed.data.consentTracking });
  });

  // Borrado total de la cuenta — CASCADE elimina likes y listen_events.
  router.delete('/me', requireAuth(auth), async (req, res) => {
    await users.deleteAccount(req.user!.id);
    // TODO(F3): emitir tombstone `user-deleted` a Redis para purgar datos del recomendador.
    res.status(204).end();
  });

  return router;
}
