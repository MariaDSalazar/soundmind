import { z } from 'zod';
import type { Track } from '@soundmind/shared';
import type { MusicProvider } from '../domain/ports.js';
import { decodeHtmlEntities } from './decode-entities.js';

/**
 * PATTERN: Adapter — traduce la API de Jamendo al puerto MusicProvider.
 * Jamendo sirve música Creative Commons con streaming completo legal.
 * API key gratuita: https://devportal.jamendo.com/
 */

const jamendoTrackSchema = z.object({
  id: z.coerce.string(),
  name: z.string(),
  artist_name: z.string(),
  duration: z.number(),
  audio: z.string().url(),
  image: z.string().nullable().catch(null),
  musicinfo: z
    .object({ tags: z.object({ genres: z.array(z.string()).catch([]) }).partial() })
    .partial()
    .optional(),
});

const jamendoResponseSchema = z.object({
  results: z.array(jamendoTrackSchema),
});

export class JamendoAdapter implements MusicProvider {
  readonly source = 'jamendo' as const;

  constructor(
    private readonly clientId: string,
    private readonly baseUrl = 'https://api.jamendo.com/v3.0',
  ) {}

  async search(query: string, limit: number): Promise<Track[]> {
    const url = new URL(`${this.baseUrl}/tracks/`);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('format', 'json');
    url.searchParams.set('search', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('include', 'musicinfo');
    url.searchParams.set('audioformat', 'mp32');

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Jamendo respondió ${res.status}`);

    // Validación de borde: nada entra al dominio sin pasar por el esquema
    const data = jamendoResponseSchema.parse(await res.json());

    return data.results.map((t) => ({
      id: `jamendo:${t.id}`,
      source: this.source,
      sourceTrackId: t.id,
      // Jamendo entrega los textos con entidades HTML escapadas
      title: decodeHtmlEntities(t.name),
      artist: decodeHtmlEntities(t.artist_name),
      durationS: t.duration,
      streamUrl: t.audio, // CDN oficial de Jamendo — nunca proxy propio
      artworkUrl: t.image,
      genreTags: t.musicinfo?.tags?.genres ?? [],
    }));
  }
}
