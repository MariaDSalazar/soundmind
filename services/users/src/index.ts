import { readFileSync } from 'node:fs';
import express from 'express';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { loadEnv } from './env.js';
import { createPool } from './infrastructure/db.js';
import { PostgresLikeRepository } from './infrastructure/postgres.likes.repository.js';
import { PostgresListenEventRepository } from './infrastructure/postgres.listen-events.repository.js';
import { PostgresConsentReader } from './infrastructure/postgres.consent.reader.js';
import { RedisEventStream } from './infrastructure/redis.event-stream.js';
import { RecordListenEventUseCase } from './application/record-listen-event.js';
import { GetHistoryUseCase } from './application/get-history.js';
import { ToggleLikeUseCase } from './application/toggle-like.js';
import { requireAuth } from './interfaces/auth.middleware.js';
import { buildRoutes } from './interfaces/routes.js';

const logger = pino({ name: 'users-service' });
const env = loadEnv();

// Clave pública para verificar JWT RS256 (el users service nunca firma).
// Admite PEM multilínea, en una línea con `\n`, o en base64 (a prueba de paneles
// como Render que rompen los saltos de línea reales).
function loadPem(value: string): string {
  const v = value.trim();
  if (v.includes('BEGIN')) return v.includes('\\n') ? v.replace(/\\n/g, '\n') : v;
  return Buffer.from(v, 'base64').toString('utf8'); // forma base64
}
const rawPublicKey = env.JWT_PUBLIC_KEY ?? (env.JWT_PUBLIC_KEY_PATH ? readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf8') : '');
const publicKey = rawPublicKey ? loadPem(rawPublicKey) : '';
if (!publicKey) {
  logger.warn('Sin JWT_PUBLIC_KEY — la verificación de tokens fallará. Configura la misma clave pública del gateway.');
}

// Composition root: inyección de dependencias (Hexagonal).
const pool = createPool(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });

const recordEvent = new RecordListenEventUseCase(
  new PostgresListenEventRepository(pool),
  new RedisEventStream(redis, env.LISTEN_EVENTS_STREAM),
  new PostgresConsentReader(pool),
);
const getHistory = new GetHistoryUseCase(new PostgresListenEventRepository(pool));
const likes = new ToggleLikeUseCase(new PostgresLikeRepository(pool));

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(pinoHttp({ logger }));
app.use(buildRoutes({ recordEvent, getHistory, likes, requireAuth: requireAuth(publicKey) }));

app.listen(env.USERS_PORT, () => {
  logger.info({ port: env.USERS_PORT, stream: env.LISTEN_EVENTS_STREAM }, 'Users service escuchando');
});
