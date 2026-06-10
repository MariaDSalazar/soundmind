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

  it('muestra la fuente primaria completa primero y luego intercala el resto', async () => {
    const useCase = new SearchTracksUseCase([
      okProvider('archive'),
      okProvider('jamendo'),
      okProvider('audius'),
    ]);
    const result = await useCase.execute('lofi');

    expect(result.tracks.map((t) => t.id)).toEqual([
      // 1) fuente primaria completa
      'archive:1',
      'archive:2',
      // 2) round-robin del resto
      'jamendo:1',
      'audius:1',
      'jamendo:2',
      'audius:2',
    ]);
  });

  it('un solo proveedor: devuelve su lista completa, sin round-robin', async () => {
    const useCase = new SearchTracksUseCase([okProvider('jamendo')]);
    const result = await useCase.execute('lofi');

    expect(result.tracks.map((t) => t.id)).toEqual(['jamendo:1', 'jamendo:2']);
    expect(result.sources).toEqual(['jamendo']);
  });

  it('intercala round-robin con listas de distinto largo (la corta se agota)', async () => {
    const oneTrack = (source: TrackSource): MusicProvider => ({
      source,
      search: async () => [fakeTrack(source, '1')],
    });
    const useCase = new SearchTracksUseCase([
      okProvider('archive'), // primaria: 2
      okProvider('jamendo'), // 2
      oneTrack('audius'), // 1 ← más corta
    ]);
    const result = await useCase.execute('lofi');

    expect(result.tracks.map((t) => t.id)).toEqual([
      'archive:1',
      'archive:2', // primaria completa
      'jamendo:1',
      'audius:1', // i=0: ambas secundarias
      'jamendo:2', // i=1: audius ya agotada
    ]);
  });

  it('todas las fuentes caídas: respuesta vacía sin romper', async () => {
    const otraCaida: MusicProvider = {
      source: 'audius',
      search: async () => {
        throw new Error('API caída');
      },
    };
    const useCase = new SearchTracksUseCase([brokenProvider, otraCaida]);
    const result = await useCase.execute('lofi');

    expect(result.tracks).toHaveLength(0);
    expect(result.sources).toHaveLength(0);
  });
});
