import type pg from 'pg';
import type { HistoryPage, ListenEvent } from '../domain/entities.js';
import type { ListenEventRepository } from '../domain/ports.js';

/** PATTERN: Adapter — ListenEventRepository sobre PostgreSQL (Neon). */
export class PostgresListenEventRepository implements ListenEventRepository {
  constructor(private readonly pool: pg.Pool) {}

  async save(event: ListenEvent): Promise<void> {
    // Idempotente por event_id (clave de idempotencia, §8).
    await this.pool.query(
      `INSERT INTO listen_events
         (event_id, user_id, track_id, event_type, played_ms, context_hour, device, track, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        event.eventId,
        event.userId,
        event.trackId,
        event.eventType,
        event.playedMs,
        event.contextHour,
        event.device ?? null,
        event.track ? JSON.stringify(event.track) : null,
        event.createdAt,
      ],
    );
  }

  async history(userId: string, limit: number, cursor: string | null): Promise<HistoryPage> {
    // Cursor opaco = base64("<created_at_iso>|<event_id>") del último de la página.
    const after = cursor ? decodeCursor(cursor) : null;
    const params: unknown[] = [userId];
    let keyset = '';
    if (after) {
      // Keyset pagination: estable aunque entren eventos nuevos.
      keyset = `AND (created_at, event_id) < ($2, $3)`;
      params.push(after.createdAt, after.eventId);
    }
    params.push(limit + 1); // pedimos uno extra para saber si hay más

    const { rows } = await this.pool.query(
      `SELECT event_id, user_id, track_id, event_type, played_ms, context_hour, device, track, created_at
         FROM listen_events
        WHERE user_id = $1 ${keyset}
        ORDER BY created_at DESC, event_id DESC
        LIMIT $${params.length}`,
      params,
    );

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map((r) => this.toEvent(r));
    const last = page[page.length - 1];
    return {
      events: page,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.eventId) : null,
    };
  }

  private toEvent(r: Record<string, unknown>): ListenEvent {
    return {
      eventId: String(r.event_id),
      userId: String(r.user_id),
      trackId: String(r.track_id),
      eventType: r.event_type as ListenEvent['eventType'],
      playedMs: Number(r.played_ms),
      contextHour: Number(r.context_hour),
      device: (r.device as string | null) ?? undefined,
      // jsonb llega ya deserializado como objeto desde pg.
      track: (r.track as ListenEvent['track']) ?? undefined,
      createdAt: (r.created_at as Date).toISOString(),
    };
  }
}

function encodeCursor(createdAt: string, eventId: string): string {
  return Buffer.from(`${createdAt}|${eventId}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: string; eventId: string } | null {
  const [createdAt, eventId] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  return createdAt && eventId ? { createdAt, eventId } : null;
}
