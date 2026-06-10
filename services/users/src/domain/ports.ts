import type { HistoryPage, Like, ListenEvent } from './entities.js';

/**
 * PATTERN: Repository / Ports & Adapters — el dominio define los contratos de
 * persistencia y mensajería; la infraestructura los implementa (Postgres,
 * Redis). Los casos de uso dependen SOLO de estas interfaces.
 */

export interface ListenEventRepository {
  /** Inserta el evento. Idempotente por `eventId` (no falla si ya existe). */
  save(event: ListenEvent): Promise<void>;
  /** Historial reciente del usuario, paginado cursor-based. */
  history(userId: string, limit: number, cursor: string | null): Promise<HistoryPage>;
}

export interface LikeRepository {
  /** Marca like; idempotente por (userId, trackId). */
  add(userId: string, trackId: string): Promise<Like>;
  remove(userId: string, trackId: string): Promise<void>;
  list(userId: string): Promise<Like[]>;
}

/**
 * PATTERN: Event-Driven — publica señales hacia el recomendador (F3/F4)
 * desacoplado vía Redis Streams. La entrega es at-least-once; el consumidor
 * deduplica por `eventId`.
 */
export interface EventStreamPort {
  publishListenEvent(event: ListenEvent): Promise<void>;
}

/**
 * Lee el flag de consentimiento desde la tabla `users` (dueña: gateway).
 * El users service SOLO lee — nunca escribe `users` (ver ADR-008).
 */
export interface ConsentReaderPort {
  hasTrackingConsent(userId: string): Promise<boolean>;
}
