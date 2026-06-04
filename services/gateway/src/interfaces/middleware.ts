import type { NextFunction, Request, Response } from 'express';
import type { UserProfile } from '@soundmind/shared';
import { AuthError, type AuthService } from '../application/auth.service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

/** Middleware de autenticación: exige `Authorization: Bearer <jwt>`. */
export function requireAuth(auth: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ type: 'about:blank', title: 'No autenticado', status: 401 });
      return;
    }
    try {
      req.user = auth.verifyAccessToken(token);
      next();
    } catch (err) {
      const status = err instanceof AuthError ? err.status : 401;
      res.status(status).json({ type: 'about:blank', title: 'Token inválido', status });
    }
  };
}
