import type { Redis } from 'ioredis';
import type { ListenEvent } from '../domain/entities.js';
import type { EventStreamPort } from '../domain/ports.js';

/**
 * PATTERN: Adapter + Event-Driven — publica eventos en un Redis Stream
 * (Upstash) vía XADD. El recomendador (F3) los consume con consumer groups
 * (entrega at-least-once) y deduplica por `eventId` (§8).
 *
 * Nota cuota Upstash (10k cmd/día free): un XADD por evento. Si se satura,
 * batch/muestreo — y se loguea lo descartado (sin truncamiento silencioso).
 */
export class RedisEventStream implements EventStreamPort {
  constructor(
    private readonly redis: Redis,
    private readonly streamKey: string,
  ) {}

  async publishListenEvent(event: ListenEvent): Promise<void> {
    await this.redis.xadd(
      this.streamKey,
      '*',
      'eventId', event.eventId,
      'userId', event.userId,
      'trackId', event.trackId,
      'eventType', event.eventType,
      'playedMs', String(event.playedMs),
      'contextHour', String(event.contextHour),
      'device', event.device ?? '',
      'createdAt', event.createdAt,
    );
  }
}
