import type { SearchResponse, Track, TrackSource } from '@soundmind/shared';
import type { MusicProvider } from '../domain/ports.js';

/**
 * PATTERN: Facade — caso de uso que orquesta múltiples proveedores tras una
 * sola operación. Resiliencia: Promise.allSettled hace que una fuente caída
 * no rompa la búsqueda (degradación elegante, ver ARQUITECTURA.md §8).
 */
export class SearchTracksUseCase {
  constructor(private readonly providers: MusicProvider[]) {}

  async execute(query: string, limit = 12): Promise<SearchResponse> {
    const results = await Promise.allSettled(
      this.providers.map((p) => p.search(query, limit)),
    );

    const sources: TrackSource[] = [];
    const bySource: Track[][] = [];
    results.forEach((result, i) => {
      if (result.status === 'rejected') return;
      sources.push(this.providers[i].source);
      bySource.push(result.value);
    });

    // Round-robin entre fuentes PRESERVANDO el orden de relevancia que
    // ya trae cada API — sin sesgar hacia una sola fuente.
    const tracks: Track[] = [];
    const maxLen = Math.max(0, ...bySource.map((list) => list.length));
    for (let i = 0; i < maxLen; i++) {
      for (const list of bySource) {
        if (i < list.length) tracks.push(list[i]);
      }
    }

    return { query, tracks, sources };
  }
}
