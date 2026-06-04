import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { loadKeys } from './infrastructure/keys.js';
import { InMemoryUserRepository } from './domain/user.repository.js';
import { AuthService } from './application/auth.service.js';
import { buildAuthRoutes } from './interfaces/auth.routes.js';
import { buildProxyRoutes } from './interfaces/proxy.routes.js';
import { requireAuth } from './interfaces/middleware.js';

const logger = pino({ name: 'gateway' });

// Composition root
const keys = loadKeys(process.env);
const users = new InMemoryUserRepository();
const auth = new AuthService(users, keys);
const musicServiceUrl = process.env.MUSIC_SERVICE_URL ?? 'http://localhost:4002';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
    credentials: true,
  }),
);
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Rate limiting: protege la API propia y las cuotas de las APIs externas
app.use(
  '/api/v1',
  rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }),
);
app.use(
  '/api/v1/auth',
  rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }),
);

app.use('/api/v1/auth', buildAuthRoutes(auth));
app.use('/api/v1', buildProxyRoutes(musicServiceUrl));

// Ruta protegida de ejemplo: perfil del usuario autenticado
app.get('/api/v1/me', requireAuth(auth), (req, res) => {
  res.json(req.user);
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

const port = Number(process.env.GATEWAY_PORT ?? 4000);
app.listen(port, () => logger.info({ port }, 'Gateway escuchando'));
