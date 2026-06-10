import type pg from 'pg';
import type { Like } from '../domain/entities.js';
import type { LikeRepository } from '../domain/ports.js';

/** PATTERN: Adapter — implementa LikeRepository sobre PostgreSQL (Neon). */
export class PostgresLikeRepository implements LikeRepository {
  constructor(private readonly pool: pg.Pool) {}

  async add(userId: string, trackId: string): Promise<Like> {
    // Idempotente: ON CONFLICT no duplica; RETURNING devuelve la fila vigente.
    const { rows } = await this.pool.query(
      `INSERT INTO likes (user_id, track_id) VALUES ($1, $2)
       ON CONFLICT (user_id, track_id) DO UPDATE SET track_id = EXCLUDED.track_id
       RETURNING user_id, track_id, created_at`,
      [userId, trackId],
    );
    return this.toLike(rows[0]);
  }

  async remove(userId: string, trackId: string): Promise<void> {
    await this.pool.query(`DELETE FROM likes WHERE user_id = $1 AND track_id = $2`, [
      userId,
      trackId,
    ]);
  }

  async list(userId: string): Promise<Like[]> {
    const { rows } = await this.pool.query(
      `SELECT user_id, track_id, created_at FROM likes
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((r) => this.toLike(r));
  }

  private toLike(row: { user_id: string | number; track_id: string; created_at: Date }): Like {
    return {
      userId: String(row.user_id),
      trackId: row.track_id,
      createdAt: row.created_at.toISOString(),
    };
  }
}
