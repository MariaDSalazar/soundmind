import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pino } from 'pino';

const logger = pino({ name: 'gateway:keys' });

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * Carga las claves RSA para JWT RS256 desde disco (producción) o genera
 * un par efímero en desarrollo. Las claves NUNCA se versionan en git.
 */
export function loadKeys(env: NodeJS.ProcessEnv): KeyPair {
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
