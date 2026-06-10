import { create } from 'zustand';
import type { Track } from '@soundmind/shared';

/**
 * PATTERN: Observer — los componentes se suscriben al estado del player
 * (Zustand) y reaccionan a play/pause/cambio de pista. Estos eventos también
 * alimentan al recomendador (play, skip, complete).
 *
 * El player mantiene una COLA (los resultados desde donde se inició la
 * reproducción) + un índice, para que "anterior/siguiente" tengan sentido.
 */
interface PlayerState {
  queue: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  /** true mientras el stream carga/bufferea (Audius puede tardar en arrancar). */
  isLoading: boolean;
  /** Mensaje visible cuando una pista no se puede reproducir. */
  error: string | null;
  /** Volumen 0..1 (persistido en localStorage). */
  volume: number;
  /** Reproduce una pista; si se pasa una cola, queda como contexto de nav. */
  play: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
  setLoading: (isLoading: boolean) => void;
  fail: (message: string) => void;
}

const STORED_VOLUME = Number(localStorage.getItem('sm_volume'));
const INITIAL_VOLUME = Number.isFinite(STORED_VOLUME) && STORED_VOLUME > 0 ? STORED_VOLUME : 1;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  current: null,
  isPlaying: false,
  isLoading: false,
  error: null,
  volume: INITIAL_VOLUME,

  play: (track, queue) => {
    const q = queue ?? get().queue;
    const index = q.findIndex((t) => t.id === track.id);
    set({
      queue: q,
      index: index >= 0 ? index : get().index,
      current: track,
      isPlaying: true,
      isLoading: true,
      error: null,
    });
  },

  toggle: () => set((s) => ({ isPlaying: !s.isPlaying, error: null })),

  next: () => {
    const { queue, index } = get();
    if (index < 0 || index >= queue.length - 1) return;
    const nextIndex = index + 1;
    set({ index: nextIndex, current: queue[nextIndex], isPlaying: true, isLoading: true, error: null });
  },

  prev: () => {
    const { queue, index } = get();
    if (index <= 0) return;
    const prevIndex = index - 1;
    set({ index: prevIndex, current: queue[prevIndex], isPlaying: true, isLoading: true, error: null });
  },

  stop: () => set({ current: null, isPlaying: false, isLoading: false, error: null, index: -1 }),

  setVolume: (volume) => {
    localStorage.setItem('sm_volume', String(volume));
    set({ volume });
  },

  setLoading: (isLoading) => set({ isLoading }),
  fail: (message) => set({ error: message, isPlaying: false, isLoading: false }),
}));
