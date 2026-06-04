import { describe, expect, it } from 'vitest';
import type { Track, TrackSource } from '@soundmind/shared';
import type { MusicProvider } from '../domain/ports.js';
import { SearchTracksUseCase } from './search-tracks.js';

function fakeTrack(source: TrackSource, id: string): Track {
  return {
    id: `${source}:${id}`,
    source,
    sourceTrackId: id,
    title: `Track ${id}`,
    artist: 'Test Artist',
    durationS: 180,
    streamUrl: `https://example.org/${id}.mp3`,
    artworkUrl: null,
    genreTags: ['test'],
  };
}

const okProvider = (source: TrackSource): MusicProvider => ({
  source,
  search: async () => [fakeTrack(source, '1'), fakeTrack(source, '2')],
});

const brokenProvider: MusicProvider = {
  source: 'jamendo',
  search: async () => {
    throw new Error('API caída');
  },
};

describe('SearchTracksUseCase', () => {
  it('agrega resultados de todos los proveedores', async () => {
    const useCase = new SearchTracksUseCase([okProvider('jamendo'), okProvider('audius')]);
    const result = await useCase.execute('lofi');

    expect(result.tracks).toHaveLength(4);
    expect(result.sources).toEqual(['jamendo', 'audius']);
  });

  it('no rompe si una fuente falla (degradación elegante)', async () => {
    const useCase = new SearchTracksUseCase([brokenProvider, okProvider('audius')]);
    const result = await useCase.execute('lofi');

    expect(result.tracks).toHaveLength(2);
    expect(result.sources).toEqual(['audius']);
  });

  it('intercala fuentes round-robin preservando la relevancia de cada API', async () => {
    const useCase = new SearchTracksUseCase([
      okProvider('deezer'),
      okProvider('jamendo'),
      okProvider('audius'),
    ]);
    const result = await useCase.execute('lofi');

    expect(result.tracks.map((t) => t.id)).toEqual([
      'deezer:1',
      'jamendo:1',
      'audius:1',
      'deezer:2',
      'jamendo:2',
      'audius:2',
    ]);
  });
});
