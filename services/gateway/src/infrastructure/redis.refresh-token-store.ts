import type { Redis } from 'ioredis';
import type { RefreshRecord, RefreshTokenStore } from '../application/refresh-token-store.js';

/**
 * Almacén de refresh tokens en Redis (Upstash). Resuelve la deuda F2: con el
 * Map en memoria, cada reinicio/deploy del gateway —y en Render el plan free
 * además lo duerme— invalidaba TODOS los refresh tokens y deslogueaba a los
 * usuarios. Aquí cada token es una clave con TTL nativo, y la rotación de un
 * solo uso se garantiza con GETDEL (lectura + borrado atómico, sin carrera).
 */
export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'refresh:',
  ) {}

  async save(token: string, record: RefreshRecord, ttlS: number): Promise<void> {
    await this.redis.set(this.prefix + token, JSON.stringify(record), 'EX', ttlS);
  }

  async take(token: string): Promise<RefreshRecord | null> {
    const raw = await this.redis.getdel(this.prefix + token);
    return raw ? (JSON.parse(raw) as RefreshRecord) : null;
  }
}
