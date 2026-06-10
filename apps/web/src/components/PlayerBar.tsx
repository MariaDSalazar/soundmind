import { useEffect, useRef } from 'react';
import {
  CircleAlert,
  Loader2,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'; // Lucide: iconos open source (ISC)
import { usePlayerStore } from '../store/player';
import { useAuthStore } from '../store/auth';
import { recordListenEvent } from '../lib/api';

const PLAYBACK_ERROR = 'No se pudo reproducir esta pista — prueba con otra.';

export function PlayerBar() {
  const { current, queue, index, isPlaying, isLoading, error, volume, toggle, next, prev, stop, setVolume, setLoading, fail } =
    usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);

  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < queue.length - 1;

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

  // Aplica el volumen al elemento <audio>.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, current]);

  // PATTERN: Observer — el player emite eventos de escucha que alimentan al
  // recomendador (F2: se guardan; F3+: se consumen). Fire-and-forget: si falla
  // o no hay sesión/consentimiento, la reproducción no se ve afectada.
  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token || !current) return;
    void recordListenEvent(token, { trackId: current.id, eventType: 'play', playedMs: 0, device: 'web', track: current });
  }, [current]);

  // Media Session API: controles nativos del SO (teclado multimedia, lockscreen)
  useEffect(() => {
    if (!current || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      artwork: current.artworkUrl ? [{ src: current.artworkUrl }] : [],
    });
  }, [current]);

  function handleEnded() {
    const token = useAuthStore.getState().token;
    if (token && current) {
      void recordListenEvent(token, {
        trackId: current.id,
        eventType: 'complete',
        playedMs: Math.round((audioRef.current?.currentTime ?? 0) * 1000),
        device: 'web',
        track: current,
      });
    }
    if (hasNext) next();
    else stop();
  }

  if (!current) return null;

  return (
    <div className="animate-slide-up fixed inset-x-0 bottom-0 border-t border-white/10 bg-zinc-950/70 px-4 py-3 backdrop-blur-xl">
      <audio
        ref={audioRef}
        src={current.streamUrl}
        onEnded={handleEnded}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onError={() => fail(PLAYBACK_ERROR)}
      />
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10">
          {current.artworkUrl ? (
            <img src={current.artworkUrl} alt="" className="size-full object-cover" />
          ) : (
            <Music className="m-auto mt-3 size-5 text-zinc-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {current.title}
            {current.isPreview && (
              <span className="ml-2 rounded-full bg-amber-400/10 px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/20">
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

        {/* Controles de transporte */}
        <button
          onClick={prev}
          disabled={!hasPrev}
          aria-label="Anterior"
          className="text-zinc-400 transition hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400"
        >
          <SkipBack className="size-5" />
        </button>
        <button
          onClick={toggle}
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/30 transition hover:brightness-110 active:scale-95"
        >
          {isLoading && isPlaying ? (
            <Loader2 className="size-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 pl-0.5" />
          )}
        </button>
        <button
          onClick={next}
          disabled={!hasNext}
          aria-label="Siguiente"
          className="text-zinc-400 transition hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400"
        >
          <SkipForward className="size-5" />
        </button>

        {/* Volumen */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 1)}
            aria-label={volume > 0 ? 'Silenciar' : 'Activar sonido'}
            className="text-zinc-400 transition hover:text-white"
          >
            {volume > 0 ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volumen"
            className="h-1 w-20 cursor-pointer accent-emerald-500"
          />
        </div>

        <button onClick={stop} aria-label="Cerrar reproductor" className="text-zinc-500 hover:text-zinc-300">
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
