import type pg from 'pg';
import type { UserRecord, UserRepository } from '../domain/user.repository.js';

/**
 * PATTERN: Repository (Adapter) — implementación PostgreSQL que reemplaza al
 * InMemoryUserRepository de F1 (ver ADR-008). El gateway es DUEÑO de la tabla
 * `users`; el users service solo la lee.
 *
 * Además del contrato base (findByEmail/findById/create) expone operaciones
 * sobre la cuenta usadas por las rutas /me (consentimiento, borrado).
 */
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT id, email, password_hash, display_name, consent_tracking, created_at
         FROM users WHERE email = $1`,
      [email],
    );
    return rows[0] ? this.toRecord(rows[0]) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT id, email, password_hash, display_name, consent_tracking, created_at
         FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.toRecord(rows[0]) : null;
  }

  async create(data: Omit<UserRecord, 'id' | 'createdAt'>): Promise<UserRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash, display_name, consent_tracking, created_at`,
      [data.email, data.passwordHash, data.displayName],
    );
    return this.toRecord(rows[0]);
  }

  /** Activa/desactiva el consentimiento de tracking (§9). */
  async setConsentTracking(userId: string, consent: boolean): Promise<void> {
    await this.pool.query(`UPDATE users SET consent_tracking = $2 WHERE id = $1`, [userId, consent]);
  }

  /** Borra la cuenta; CASCADE elimina likes y listen_events (derecho al olvido). */
  async deleteAccount(userId: string): Promise<void> {
    await this.pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  }

  private toRecord(row: Record<string, unknown>): UserRecord {
    return {
      id: String(row.id),
      email: String(row.email),
      passwordHash: String(row.password_hash),
      displayName: String(row.display_name),
      consentTracking: Boolean(row.consent_tracking),
      createdAt: row.created_at as Date,
    };
  }
}
