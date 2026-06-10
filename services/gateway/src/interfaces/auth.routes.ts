import { Router, type Response } from 'express';
import { z } from 'zod';
import { AuthError, type AuthService } from '../application/auth.service.js';

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(60),
});

const REFRESH_COOKIE = 'sm_refresh';

function setRefreshCookie(res: Response, token: string, ttlS: number) {
  const isProd = process.env.NODE_ENV === 'production';
  // El refresh token solo viaja en cookie HttpOnly — inaccesible para JS (anti-XSS).
  // En prod el frontend (Netlify) y el gateway (Render) son dominios distintos
  // (cross-site), así que la cookie necesita SameSite=None + Secure para viajar;
  // en local (mismo sitio, http) se usa Lax para que funcione sin HTTPS.
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/v1/auth',
    maxAge: ttlS * 1000,
  });
}

function problem(res: Response, status: number, title: string, detail?: string) {
  res.status(status).json({ type: 'about:blank', title, status, detail });
}

export function buildAuthRoutes(auth: AuthService): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return problem(res, 400, 'Datos de registro inválidos', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    }
    try {
      const { email, password, displayName } = parsed.data;
      const { tokens, refreshToken, refreshTtlS } = await auth.register(email, password, displayName);
      setRefreshCookie(res, refreshToken, refreshTtlS);
      res.status(201).json(tokens);
    } catch (err) {
      if (err instanceof AuthError) return problem(res, err.status, err.message);
      throw err;
    }
  });

  router.post('/login', async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return problem(res, 400, 'Credenciales mal formadas');
    try {
      const { tokens, refreshToken, refreshTtlS } = await auth.login(parsed.data.email, parsed.data.password);
      setRefreshCookie(res, refreshToken, refreshTtlS);
      res.json(tokens);
    } catch (err) {
      if (err instanceof AuthError) return problem(res, err.status, err.message);
      throw err;
    }
  });

  router.post('/refresh', async (req, res) => {
    const current = req.cookies?.[REFRESH_COOKIE];
    if (!current) return problem(res, 401, 'Sin sesión');
    try {
      const { tokens, refreshToken, refreshTtlS } = await auth.refresh(current);
      setRefreshCookie(res, refreshToken, refreshTtlS);
      res.json(tokens);
    } catch (err) {
      if (err instanceof AuthError) return problem(res, err.status, err.message);
      throw err;
    }
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    res.status(204).end();
  });

  return router;
}
