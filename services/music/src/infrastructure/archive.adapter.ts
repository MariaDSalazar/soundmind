import { z } from 'zod';
import type { Track } from '@soundmind/shared';
import type { MusicProvider } from '../domain/ports.js';

/**
 * PATTERN: Adapter — traduce la API del Internet Archive al puerto MusicProvider.
 * Sirve audio de dominio público / netlabels (Creative Commons) con streaming
 * COMPLETO y sin API key. Cada "item" es un álbum/show; tomamos su primera pista.
 *
 * Requiere 2 pasos (búsqueda + metadata por item), resueltos en paralelo.
 */

const oneOrFirst = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (Array.isArray(v) ? v[0] : v));

const searchSchema = z.object({
  response: z.object({
    docs: z.array(z.object({ identifier: z.string(), title: oneOrFirst, creator: oneOrFirst })).catch([]),
  }),
});

const metadataSchema = z.object({
  files: z
    .array(z.object({ name: z.string(), format: z.string().catch(''), length: z.coerce.number().catch(0) }))
    .catch([]),
});

export class ArchiveAdapter implements MusicProvider {
  readonly source = 'archive' as const;

  constructor(
    private readonly searchUrl = 'https://archive.org/advancedsearch.php',
    private readonly metadataUrl = 'https://archive.org/metadata',
    private readonly downloadUrl = 'https://archive.org/download',
  ) {}

  async search(query: string, limit: number): Promise<Track[]> {
    const url = new URL(this.searchUrl);
    // Filtra a música real (evita podcasts/radio del mediatype audio).
    url.searchParams.set('q', `(${query}) AND mediatype:audio AND collection:(audio_music OR netlabels)`);
    for (const f of ['identifier', 'title', 'creator']) url.searchParams.append('fl[]', f);
    url.searchParams.set('rows', String(Math.min(limit, 8))); // acota el fan-out de metadata
    url.searchParams.set('output', 'json');

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Internet Archive respondió ${res.status}`);
    const { response } = searchSchema.parse(await res.json());

    // n+1 en paralelo: una llamada de metadata por item; los fallos se descartan.
    const tracks = await Promise.all(response.docs.map((doc) => this.resolveTrack(doc.identifier, doc.title, doc.creator)));
    return tracks.filter((t): t is Track => t !== null);
  }

  private async resolveTrack(
    identifier: string,
    title: string | undefined,
    creator: string | undefined,
  ): Promise<Track | null> {
    try {
      const res = await fetch(`${this.metadataUrl}/${identifier}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const { files } = metadataSchema.parse(await res.json());
      const mp3 = files.find((f) => f.name.toLowerCase().endsWith('.mp3'));
      if (!mp3) return null;
      return {
        id: `archive:${identifier}`,
        source: this.source,
        sourceTrackId: identifier,
        title: title ?? identifier,
        artist: creator ?? 'Internet Archive',
        durationS: Math.round(mp3.length),
        streamUrl: `${this.downloadUrl}/${identifier}/${encodeURIComponent(mp3.name)}`,
        artworkUrl: `https://archive.org/services/img/${identifier}`,
        genreTags: [],
      };
    } catch {
      return null; // item sin metadata accesible → se omite (degradación elegante)
    }
  }
}
