import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserProfile } from '@soundmind/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

/**
 * Defensa en profundidad (§9): el users service verifica el MISMO access token
 * RS256 que emite el gateway, usando solo la clave pública. El `user_id` sale
 * del `sub` del token verificado — nunca de un header manipulable (ADR-008).
 */
export function requireAuth(publicKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ type: 'about:blank', title: 'No autenticado', status: 401 });
      return;
    }
    try {
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        audience: 'soundmind-api',
      }) as jwt.JwtPayload;
      req.user = {
        id: String(payload.sub),
        email: String(payload.email),
        displayName: String(payload.name),
      };
      next();
    } catch {
      res.status(401).json({ type: 'about:blank', title: 'Token inválido', status: 401 });
    }
  };
}
