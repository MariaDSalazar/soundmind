import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Music, Pause, Play, SkipForward } from 'lucide-react'; // Lucide (ISC)
import type { ListenEventType, Track } from '@soundmind/shared';
import { getHistory } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { usePlayerStore } from '../store/player';
import { Equalizer } from './Equalizer';

const EVENT_META: Record<ListenEventType, { icon: typeof Play; label: string; color: string }> = {
  play: { icon: Play, label: 'Reproducida', color: 'text-zinc-400' },
  complete: { icon: CircleCheck, label: 'Completada', color: 'text-emerald-400' },
  skip: { icon: SkipForward, label: 'Saltada', color: 'text-amber-400' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function HistoryView() {
  const token = useAuthStore((s) => s.token);
  const { current, isPlaying, play, toggle } = usePlayerStore();

  const { data, isFetching, error } = useQuery({
    queryKey: ['history'],
    queryFn: () => getHistory(token!),
    enabled: !!token,
  });

  if (!token) {
    return <p className="py-16 text-center text-sm text-zinc-500">Inicia sesión para ver tu historial de escucha.</p>;
  }
  if (isFetching && !data) {
    return <p className="py-16 text-center text-sm text-zinc-500">Cargando historial…</p>;
  }
  if (error) {
    return <p className="py-16 text-center text-sm text-rose-300">{(error as Error).message}</p>;
  }
  if (!data || data.events.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-zinc-500">
        Aún no hay nada en tu historial. Reproduce música (con el historial activo) y aparecerá aquí.
      </p>
    );
  }

  // Cola de reproducción = pistas del historial con snapshot disponible.
  const queue: Track[] = data.events.map((e) => e.track).filter((t): t is Track => !!t);

  return (
    <ul className="space-y-1">
      {data.events.map((ev, i) => {
        const meta = EVENT_META[ev.eventType];
        const Icon = meta.icon;
        const track = ev.track;
        const isCurrent = !!track && current?.id === track.id;
        return (
          <li
            key={ev.eventId}
            style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
            className={`animate-rise group flex items-center gap-3 rounded-2xl pr-3 ring-1 transition duration-200 ${
              isCurrent
                ? 'bg-gradient-to-r from-fuchsia-500/15 to-violet-500/10 ring-fuchsia-500/30'
                : 'ring-transparent hover:-translate-y-0.5 hover:bg-white/5 hover:ring-white/10'
            }`}
          >
            <button
              type="button"
              disabled={!track}
              onClick={() => (track ? (isCurrent ? toggle() : play(track, queue)) : undefined)}
              className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
            >
              <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-white/10">
                {track?.artworkUrl ? (
                  <img src={track.artworkUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                ) : (
                  <Music className="absolute inset-0 m-auto size-4 text-zinc-500" />
                )}
                {track && (
                  <span className="absolute inset-0 hidden items-center justify-center bg-black/50 backdrop-blur-sm group-hover:flex">
                    {isCurrent && isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`flex items-center gap-2 truncate text-sm font-medium ${isCurrent ? 'text-fuchsia-300' : ''}`}>
                  <span className="truncate">{track ? track.title : ev.trackId}</span>
                  {isCurrent && isPlaying && <Equalizer className="shrink-0" />}
                </p>
                <p className={`flex items-center gap-1.5 text-xs ${meta.color}`}>
                  {track && <span className="truncate text-zinc-500">{track.artist}</span>}
                  <span className="flex items-center gap-1">
                    <Icon className="size-3" /> {meta.label}
                  </span>
                </p>
              </div>
            </button>
            <span className="shrink-0 text-xs text-zinc-500">{timeAgo(ev.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
