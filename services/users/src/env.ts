// IMPORTANTE: cargar .env ANTES de leer process.env.
// Resuelve la deuda técnica de F1 (los servicios corrían con tsx sin dotenv).
// En producción (Render) las variables vienen del entorno y esto es no-op.
import 'dotenv/config';
import { z } from 'zod';

/**
 * Validación estricta de configuración (§9: "nada entra sin esquema").
 * Falla rápido al arrancar si falta algo crítico, en vez de morir en runtime.
 */
const schema = z.object({
  USERS_PORT: z.coerce.number().int().positive().default(4003),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  // Solo la clave PÚBLICA: el users service verifica JWT, nunca los firma.
  JWT_PUBLIC_KEY: z.string().min(1).optional(),
  JWT_PUBLIC_KEY_PATH: z.string().min(1).optional(),
  LISTEN_EVENTS_STREAM: z.string().default('listen-events'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida del users service — ${detail}`);
  }
  return parsed.data;
}
