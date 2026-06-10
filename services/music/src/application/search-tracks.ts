import type { SearchResponse, Track, TrackSource } from '@soundmind/shared';
import type { MusicProvider } from '../domain/ports.js';

/**
 * PATTERN: Facade — caso de uso que orquesta múltiples proveedores tras una
 * sola operación. Resiliencia: Promise.allSettled hace que una fuente caída
 * no rompa la búsqueda (degradación elegante, ver ARQUITECTURA.md §8).
 *
 * Orden de resultados: la fuente PRIMARIA (la primera por prioridad del factory)
 * se muestra COMPLETA primero; el resto de plataformas se intercala round-robin
 * a continuación, preservando la relevancia que trae cada API.
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

    const tracks: Track[] = [];
    if (bySource.length > 0) {
      // 1) La fuente primaria (la primera por prioridad del factory) va COMPLETA.
      tracks.push(...bySource[0]);

      // 2) El resto de plataformas se intercala round-robin, preservando la
      //    relevancia de cada API y sin sesgar hacia una sola.
      const rest = bySource.slice(1);
      const maxLen = Math.max(0, ...rest.map((list) => list.length));
      for (let i = 0; i < maxLen; i++) {
        for (const list of rest) {
          if (i < list.length) tracks.push(list[i]);
        }
      }
    }

    return { query, tracks, sources };
  }
}
