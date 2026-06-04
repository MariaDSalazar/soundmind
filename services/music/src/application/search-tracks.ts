import type { SearchResponse, TrackSource } from '@soundmind/shared';
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
    const tracks = results.flatMap((result, i) => {
      if (result.status === 'rejected') return [];
      sources.push(this.providers[i].source);
      return result.value;
    });

    // Intercala resultados de las fuentes para no sesgar hacia una sola
    tracks.sort((a, b) => a.title.localeCompare(b.title));

    return { query, tracks, sources };
  }
}
