import type { Track, TrackSource } from '@soundmind/shared';

/**
 * PATTERN: Port (Arquitectura Hexagonal) — el dominio define el contrato;
 * la infraestructura (adaptadores Jamendo/Audius) lo implementa.
 * El dominio no sabe qué API externa hay detrás.
 */
export interface MusicProvider {
  readonly source: TrackSource;
  search(query: string, limit: number): Promise<Track[]>;
}
