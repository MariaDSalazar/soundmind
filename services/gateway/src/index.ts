// Cargar .env ANTES de leer process.env (cierra deuda F1: los servicios corrían
// con tsx sin dotenv). En Render las variables vienen del entorno y esto es no-op.
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { loadKeys } from './infrastructure/keys.js';
import { createPool } from './infrastructure/db.js';
import { PostgresUserRepository } from './infrastructure/postgres.user.repository.js';
import { AuthService } from './application/auth.service.js';
import { InMemoryRefreshTokenStore } from './application/refresh-token-store.js';
import { RedisRefreshTokenStore } from './infrastructure/redis.refresh-token-store.js';
import { buildAuthRoutes } from './interfaces/auth.routes.js';
import { buildProxyRoutes } from './interfaces/proxy.routes.js';
import { buildUsersProxyRoutes } from './interfaces/users.proxy.routes.js';
import { buildAccountRoutes } from './interfaces/account.routes.js';
import { buildRecommenderProxyRoutes } from './interfaces/recommender.proxy.routes.js';

const logger = pino({ name: 'gateway' });

// Composition root — F2: persistencia real en Postgres (ADR-008).
const keys = loadKeys(process.env);
const pool = createPool(process.env.DATABASE_URL ?? '');
const users = new PostgresUserRepository(pool);

// Refresh tokens en Redis si hay REDIS_URL (sobrevive a reinicios/deploys de
// Render); si no, fallback a memoria para no romper el arranque local.
const refreshStore = process.env.REDIS_URL
  ? new RedisRefreshTokenStore(new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 }))
  : new InMemoryRefreshTokenStore();
if (!process.env.REDIS_URL) {
  logger.warn('Sin REDIS_URL — refresh tokens en memoria (se pierden al reiniciar). Configúralo en Render.');
}
const auth = new AuthService(users, keys, refreshStore);
const musicServiceUrl = process.env.MUSIC_SERVICE_URL ?? 'http://localhost:4002';
const usersServiceUrl = process.env.USERS_SERVICE_URL ?? 'http://localhost:4003';
const recommenderServiceUrl = process.env.RECOMMENDER_SERVICE_URL ?? 'http://localhost:4004';

const app = express();
// Render pone un proxy delante: confiar en el primer salto para que el rate
// limiting (y req.ip) use la IP REAL del cliente (X-Forwarded-For), no la del
// proxy compartida — si no, un solo cliente agota el cupo de todos.
app.set('trust proxy', 1);
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

// Rate limiting: protege la API propia y las cuotas de las APIs externas.
// Por IP real (ver trust proxy). El de /auth es holgado porque el frontend
// llama /auth/refresh en cada carga para restaurar la sesión.
app.use(
  '/api/v1',
  rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
);
app.use(
  '/api/v1/auth',
  rateLimit({ windowMs: 15 * 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }),
);

app.use('/api/v1/auth', buildAuthRoutes(auth));
app.use('/api/v1', buildProxyRoutes(musicServiceUrl));
// F2: perfil/consentimiento/borrado (gateway, dueño de `users`) y proxy de
// likes/historial/eventos hacia el users service.
app.use('/api/v1', buildAccountRoutes(users, auth));
app.use('/api/v1', buildUsersProxyRoutes(usersServiceUrl));
// F3: proxy de recomendaciones (similar/for-me/onboarding) al Recommender service.
app.use('/api/v1', buildRecommenderProxyRoutes(recommenderServiceUrl));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

// Manejador de errores: loguea la causa real de cualquier 500 (antes se perdían).
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Se loguea la causa (visible en Render), pero NO se expone al cliente.
  logger.error({ err: { message: err.message, stack: err.stack } }, 'Error no manejado');
  res.status(500).json({ type: 'about:blank', title: 'Error interno del servidor', status: 500 });
});

const port = Number(process.env.GATEWAY_PORT ?? 4000);
app.listen(port, () => logger.info({ port }, 'Gateway escuchando'));
