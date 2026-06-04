import { z } from 'zod';
import type { Track } from '@soundmind/shared';
import type { MusicProvider } from '../domain/ports.js';

/**
 * PATTERN: Adapter — traduce la API de Deezer al puerto MusicProvider.
 * Deezer da acceso al catálogo COMERCIAL (sin key para búsqueda) con
 * previews oficiales de 30s — la vía legal para "la música conocida"
 * (ver ARQUITECTURA.md §5: jamás se almacena ni hace proxy del audio).
 */

const deezerTrackSchema = z.object({
  id: z.coerce.string(),
  title: z.string(),
  duration: z.number(),
  // URL del preview mp3 de 30s; puede venir vacía si no hay preview
  preview: z.string().catch(''),
  artist: z.object({ name: z.string() }),
  album: z.object({ cover_medium: z.string().catch('') }).partial().optional(),
});

const deezerResponseSchema = z.object({
  data: z.array(deezerTrackSchema).catch([]),
});

export class DeezerAdapter implements MusicProvider {
  readonly source = 'deezer' as const;

  constructor(private readonly baseUrl = 'https://api.deezer.com') {}

  async search(query: string, limit: number): Promise<Track[]> {
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Deezer respondió ${res.status}`);

    const data = deezerResponseSchema.parse(await res.json());

    return data.data
      .filter((t) => t.preview !== '') // sin preview no hay nada que reproducir
      .slice(0, limit)
      .map((t) => ({
        id: `deezer:${t.id}`,
        source: this.source,
        sourceTrackId: t.id,
        title: t.title,
        artist: t.artist.name,
        durationS: t.duration,
        streamUrl: t.preview, // CDN oficial de Deezer — preview de 30s
        artworkUrl: t.album?.cover_medium || null,
        genreTags: [],
        isPreview: true,
      }));
  }
}
