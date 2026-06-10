import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pino } from 'pino';

const logger = pino({ name: 'gateway:keys' });

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * Carga las claves RSA para JWT RS256 — por orden de prioridad:
 * 1. Contenido PEM directo en env (JWT_PRIVATE_KEY / JWT_PUBLIC_KEY) — PaaS como Render.
 * 2. Rutas a archivos (JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH) — servidores propios.
 * 3. Par efímero generado al arrancar — solo desarrollo.
 * Las claves NUNCA se versionan en git.
 */
/**
 * Resuelve una clave PEM venida de una variable de entorno admitiendo 3 formas
 * (los paneles tipo Render rompen los saltos de línea reales):
 *   1. PEM multilínea normal.
 *   2. PEM en una línea con `\n` literales (se reconstruyen).
 *   3. PEM en **base64** (a prueba de balas: sin saltos ni caracteres especiales).
 */
export function loadPem(value: string): string {
  const v = value.trim();
  if (v.includes('BEGIN')) {
    return v.includes('\\n') ? v.replace(/\\n/g, '\n') : v;
  }
  return Buffer.from(v, 'base64').toString('utf8'); // forma base64
}

export function loadKeys(env: NodeJS.ProcessEnv): KeyPair {
  if (env.JWT_PRIVATE_KEY && env.JWT_PUBLIC_KEY) {
    return {
      privateKey: loadPem(env.JWT_PRIVATE_KEY),
      publicKey: loadPem(env.JWT_PUBLIC_KEY),
    };
  }

  if (env.JWT_PRIVATE_KEY_PATH && env.JWT_PUBLIC_KEY_PATH) {
    return {
      privateKey: readFileSync(env.JWT_PRIVATE_KEY_PATH, 'utf8'),
      publicKey: readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf8'),
    };
  }

  logger.warn('Sin claves RSA configuradas — generando par efímero (solo desarrollo)');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKey, publicKey };
}
