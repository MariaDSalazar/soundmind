import { useEffect, useRef } from 'react';
import { CircleAlert, Loader2, Music, Pause, Play, X } from 'lucide-react'; // Lucide: iconos open source (ISC)
import { usePlayerStore } from '../store/player';

const PLAYBACK_ERROR = 'No se pudo reproducir esta pista — prueba con otra.';

export function PlayerBar() {
  const { current, isPlaying, isLoading, error, toggle, stop, setLoading, fail } =
    usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) {
      void audio.play().catch((err: unknown) => {
        // AbortError = la carga fue interrumpida por pause/cambio de pista — no es un fallo
        if (err instanceof DOMException && err.name === 'AbortError') return;
        fail(PLAYBACK_ERROR);
      });
    } else {
      audio.pause();
    }
  }, [current, isPlaying, fail]);

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
      <audio
        ref={audioRef}
        src={current.streamUrl}
        onEnded={stop}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onError={() => fail(PLAYBACK_ERROR)}
      />
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="size-10 shrink-0 overflow-hidden rounded bg-zinc-800">
          {current.artworkUrl ? (
            <img src={current.artworkUrl} alt="" className="size-full object-cover" />
          ) : (
            <Music className="m-auto mt-2.5 size-5 text-zinc-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {current.title}
            {current.isPreview && (
              <span className="ml-2 rounded-full bg-zinc-900 px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide text-amber-500 ring-1 ring-zinc-800">
                preview 30s
              </span>
            )}
          </p>
          {error ? (
            <p className="flex items-center gap-1 truncate text-xs text-red-400">
              <CircleAlert className="size-3 shrink-0" /> {error}
            </p>
          ) : (
            <p className="truncate text-xs text-zinc-500">{current.artist}</p>
          )}
        </div>
        <button
          onClick={toggle}
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          className="flex size-10 items-center justify-center rounded-full bg-emerald-600 transition hover:bg-emerald-500"
        >
          {isLoading && isPlaying ? (
            <Loader2 className="size-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 pl-0.5" />
          )}
        </button>
        <button onClick={stop} aria-label="Cerrar reproductor" className="text-zinc-500 hover:text-zinc-300">
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
