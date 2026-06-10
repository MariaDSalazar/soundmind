import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AudioWaveform, Clock, Search as SearchIcon } from 'lucide-react'; // Lucide (ISC)
import type { Track } from '@soundmind/shared';
import { addLike, getLikes, removeLike, searchTracks } from './lib/api';
import { useAuthStore } from './store/auth';
import { SearchBar } from './components/SearchBar';
import { TrackList } from './components/TrackList';
import { HistoryView } from './components/HistoryView';
import { PlayerBar } from './components/PlayerBar';
import { AuthPanel } from './components/AuthPanel';

type Tab = 'search' | 'history';

export default function App() {
  const [query, setQuery] = useState('');
  // Recuerda la pestaña entre recargas (no te manda siempre al buscador).
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('sm_tab') as Tab) ?? 'search');

  useEffect(() => {
    localStorage.setItem('sm_tab', tab);
  }, [tab]);
  const token = useAuthStore((s) => s.token);
  const restore = useAuthStore((s) => s.restore);
  const queryClient = useQueryClient();

  // Restaura la sesión desde la cookie de refresh al cargar la página.
  useEffect(() => {
    void restore();
  }, [restore]);

  const { data, isFetching, error } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTracks(query),
    enabled: query.length > 0,
  });

  // Likes del usuario (solo con sesión).
  const { data: likes } = useQuery({
    queryKey: ['likes'],
    queryFn: () => getLikes(token!),
    enabled: !!token,
  });
  const likedIds = useMemo(() => new Set((likes ?? []).map((l) => l.trackId)), [likes]);

  const toggleLike = useMutation({
    mutationFn: async (track: Track) => {
      if (likedIds.has(track.id)) await removeLike(token!, track.id);
      else await addLike(token!, track.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['likes'] }),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-10">
      <header className="mb-8 flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/30">
          <AudioWaveform className="size-6 text-white" />
        </span>
        <h1 className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
          SoundMind
        </h1>
        <AuthPanel />
      </header>

      {/* Pestañas: buscar vs. historial */}
      <nav className="mb-6 flex gap-1 rounded-2xl bg-white/5 p-1 text-sm ring-1 ring-white/10 backdrop-blur">
        <button
          onClick={() => setTab('search')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-medium transition ${tab === 'search' ? 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-lg shadow-fuchsia-500/25' : 'text-zinc-400 hover:text-white'}`}
        >
          <SearchIcon className="size-4" /> Buscar
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-medium transition ${tab === 'history' ? 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-lg shadow-fuchsia-500/25' : 'text-zinc-400 hover:text-white'}`}
        >
          <Clock className="size-4" /> Mi historial
        </button>
      </nav>

      {tab === 'search' ? (
        <>
          <SearchBar onSearch={setQuery} loading={isFetching} />

          {error && (
            <p className="mt-6 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/20 backdrop-blur">
              {(error as Error).message}
            </p>
          )}

          <main className="mt-6">
            <TrackList
              tracks={data?.tracks ?? []}
              likedIds={token ? likedIds : undefined}
              onToggleLike={token ? (t) => toggleLike.mutate(t) : undefined}
            />
            {data && data.sources.length > 0 && (
              <p className="mt-4 text-center text-xs text-zinc-600">
                Fuentes: {data.sources.join(' · ')} — música Creative Commons y artistas independientes
              </p>
            )}
          </main>
        </>
      ) : (
        <main className="mt-2">
          <HistoryView />
        </main>
      )}

      <PlayerBar />
    </div>
  );
}
