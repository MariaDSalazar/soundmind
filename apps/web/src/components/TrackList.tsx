import { Heart, Music, Pause, Play } from 'lucide-react'; // Lucide: iconos open source (ISC)
import type { Track } from '@soundmind/shared';
import { usePlayerStore } from '../store/player';
import { Equalizer } from './Equalizer';

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface Props {
  tracks: Track[];
  /** Ids de pistas con like (si hay sesión). */
  likedIds?: Set<string>;
  /** Alterna el like; si es undefined, no se muestra el corazón (sin sesión). */
  onToggleLike?: (track: Track) => void;
}

export function TrackList({ tracks, likedIds, onToggleLike }: Props) {
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
    <ul className="space-y-1">
      {tracks.map((track, i) => {
        const isCurrent = current?.id === track.id;
        const liked = likedIds?.has(track.id) ?? false;
        return (
          <li
            key={track.id}
            style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
            className={`animate-rise group flex items-center gap-3 rounded-2xl pr-3 ring-1 transition duration-200 hover:-translate-y-0.5 ${isCurrent ? 'bg-gradient-to-r from-fuchsia-500/15 to-violet-500/10 ring-fuchsia-500/30' : 'ring-transparent hover:bg-white/5 hover:ring-white/10'}`}
          >
            <button
              onClick={() => (isCurrent ? toggle() : play(track, tracks))}
              className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
            >
              <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-white/10">
                {track.artworkUrl ? (
                  <img src={track.artworkUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                ) : (
                  <Music className="absolute inset-0 m-auto size-5 text-zinc-500" />
                )}
                <span className="absolute inset-0 hidden items-center justify-center bg-black/50 backdrop-blur-sm group-hover:flex">
                  {isCurrent && isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`flex items-center gap-2 truncate text-sm font-semibold ${isCurrent ? 'text-fuchsia-300' : ''}`}>
                  <span className="truncate">{track.title}</span>
                  {isCurrent && isPlaying && <Equalizer className="shrink-0" />}
                </p>
                <p className="truncate text-xs text-zinc-400">{track.artist}</p>
              </div>
            </button>

            {onToggleLike && (
              <button
                onClick={() => onToggleLike(track)}
                aria-label={liked ? 'Quitar like' : 'Dar like'}
                aria-pressed={liked}
                className={`shrink-0 transition active:scale-90 ${liked ? 'text-pink-500' : 'text-zinc-500 hover:text-pink-400'}`}
              >
                <Heart className={`size-[18px] ${liked ? 'fill-pink-500' : ''}`} />
              </button>
            )}

            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${track.isPreview ? 'bg-amber-400/10 text-amber-300 ring-amber-400/20' : 'bg-white/5 text-zinc-400 ring-white/10'}`}
            >
              {track.isPreview ? `${track.source} · 30s` : track.source}
            </span>
            <span className="w-10 text-right text-xs tabular-nums text-zinc-500">
              {formatDuration(track.durationS)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
