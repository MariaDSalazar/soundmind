import { useEffect, useRef } from 'react';
import { Music, Pause, Play, X } from 'lucide-react'; // Lucide: iconos open source (ISC)
import { usePlayerStore } from '../store/player';

export function PlayerBar() {
  const { current, isPlaying, toggle, stop } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) void audio.play().catch(() => usePlayerStore.setState({ isPlaying: false }));
    else audio.pause();
  }, [current, isPlaying]);

  // Media Session API: controles nativos del SO (teclado multimedia, lockscreen)
  useEffect(() => {
    if (!current || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      artwork: current.artworkUrl ? [{ src: current.artworkUrl }] : [],
    });
  }, [current]);

  if (!current) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
      <audio ref={audioRef} src={current.streamUrl} onEnded={stop} />
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="size-10 shrink-0 overflow-hidden rounded bg-zinc-800">
          {current.artworkUrl ? (
            <img src={current.artworkUrl} alt="" className="size-full object-cover" />
          ) : (
            <Music className="m-auto mt-2.5 size-5 text-zinc-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current.title}</p>
          <p className="truncate text-xs text-zinc-500">{current.artist}</p>
        </div>
        <button
          onClick={toggle}
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          className="flex size-10 items-center justify-center rounded-full bg-emerald-600 transition hover:bg-emerald-500"
        >
          {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 pl-0.5" />}
        </button>
        <button onClick={stop} aria-label="Cerrar reproductor" className="text-zinc-500 hover:text-zinc-300">
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
