import { Music, Pause, Play } from 'lucide-react'; // Lucide: iconos open source (ISC)
import type { Track } from '@soundmind/shared';
import { usePlayerStore } from '../store/player';

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function TrackList({ tracks }: { tracks: Track[] }) {
  const { current, isPlaying, play, toggle } = usePlayerStore();

  if (tracks.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-zinc-500">
        Busca algo para empezar — música libre (Creative Commons) en streaming completo y
        catálogo comercial en previews de 30s.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-900">
      {tracks.map((track) => {
        const isCurrent = current?.id === track.id;
        return (
          <li key={track.id}>
            <button
              onClick={() => (isCurrent ? toggle() : play(track))}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-zinc-900 ${isCurrent ? 'bg-zinc-900' : ''}`}
            >
              <div className="relative size-11 shrink-0 overflow-hidden rounded bg-zinc-800">
                {track.artworkUrl ? (
                  <img src={track.artworkUrl} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <Music className="absolute inset-0 m-auto size-5 text-zinc-600" />
                )}
                <span className="absolute inset-0 hidden items-center justify-center bg-black/60 group-hover:flex">
                  {isCurrent && isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${isCurrent ? 'text-emerald-400' : ''}`}>
                  {track.title}
                </p>
                <p className="truncate text-xs text-zinc-500">{track.artist}</p>
              </div>
              <span
                className={`rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wide ring-1 ring-zinc-800 ${track.isPreview ? 'text-amber-500' : 'text-zinc-500'}`}
              >
                {track.isPreview ? `${track.source} · 30s` : track.source}
              </span>
              <span className="w-10 text-right text-xs tabular-nums text-zinc-500">
                {formatDuration(track.durationS)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
