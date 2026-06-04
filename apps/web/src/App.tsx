import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AudioWaveform } from 'lucide-react'; // Lucide: iconos open source (ISC)
import { searchTracks } from './lib/api';
import { SearchBar } from './components/SearchBar';
import { TrackList } from './components/TrackList';
import { PlayerBar } from './components/PlayerBar';

export default function App() {
  const [query, setQuery] = useState('');

  const { data, isFetching, error } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTracks(query),
    enabled: query.length > 0,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-10">
      <header className="mb-8 flex items-center gap-2">
        <AudioWaveform className="size-7 text-emerald-500" />
        <h1 className="text-xl font-bold tracking-tight">SoundMind</h1>
        <span className="ml-auto text-xs text-zinc-600">música libre + IA</span>
      </header>

      <SearchBar onSearch={setQuery} loading={isFetching} />

      {error && (
        <p className="mt-6 rounded-lg bg-red-950/50 px-4 py-3 text-sm text-red-400 ring-1 ring-red-900">
          {(error as Error).message}
        </p>
      )}

      <main className="mt-6">
        <TrackList tracks={data?.tracks ?? []} />
        {data && data.sources.length > 0 && (
          <p className="mt-4 text-center text-xs text-zinc-600">
            Fuentes: {data.sources.join(' · ')} — música Creative Commons y artistas independientes
          </p>
        )}
      </main>

      <PlayerBar />
    </div>
  );
}
