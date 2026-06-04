import { z } from 'zod';
import type { Track } from '@soundmind/shared';
import type { MusicProvider } from '../domain/ports.js';

/**
 * PATTERN: Adapter — traduce la API de Audius al puerto MusicProvider.
 * Audius es streaming descentralizado de artistas independientes,
 * con API abierta sin necesidad de key (solo app_name).
 * Docs: https://docs.audius.org/api/
 */

const audiusTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  duration: z.number(),
  genre: z.string().nullable().catch(null),
  artwork: z.object({ '480x480': z.string().optional() }).nullable().catch(null),
  user: z.object({ name: z.string() }),
});

const audiusResponseSchema = z.object({
  data: z.array(audiusTrackSchema).catch([]),
});

export class AudiusAdapter implements MusicProvider {
  readonly source = 'audius' as const;

  constructor(
    private readonly appName: string,
    private readonly baseUrl = 'https://discoveryprovider.audius.co/v1',
  ) {}

  async search(query: string, limit: number): Promise<Track[]> {
    const url = new URL(`${this.baseUrl}/tracks/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('app_name', this.appName);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Audius respondió ${res.status}`);

    const data = audiusResponseSchema.parse(await res.json());

    return data.data.slice(0, limit).map((t) => ({
      id: `audius:${t.id}`,
      source: this.source,
      sourceTrackId: t.id,
      title: t.title,
      artist: t.user.name,
      durationS: t.duration,
      // Endpoint oficial de streaming de Audius (redirige al nodo de contenido)
      streamUrl: `${this.baseUrl}/tracks/${t.id}/stream?app_name=${this.appName}`,
      artworkUrl: t.artwork?.['480x480'] ?? null,
      genreTags: t.genre ? [t.genre] : [],
    }));
  }
}
