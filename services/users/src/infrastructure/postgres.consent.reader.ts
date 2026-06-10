import type pg from 'pg';
import type { ConsentReaderPort } from '../domain/ports.js';

/**
 * PATTERN: Adapter — lee `users.consent_tracking`. La tabla `users` es del
 * gateway; este servicio SOLO la lee (compromiso de DB compartida, ADR-008).
 */
export class PostgresConsentReader implements ConsentReaderPort {
  constructor(private readonly pool: pg.Pool) {}

  async hasTrackingConsent(userId: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ consent_tracking: boolean }>(
      `SELECT consent_tracking FROM users WHERE id = $1`,
      [userId],
    );
    return rows[0]?.consent_tracking ?? false;
  }
}
