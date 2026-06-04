import { create } from 'zustand';
import type { Track } from '@soundmind/shared';

/**
 * PATTERN: Observer — los componentes se suscriben al estado del player
 * (Zustand) y reaccionan a play/pause/cambio de pista. En F2, estos mismos
 * eventos alimentarán al recomendador (play, skip, complete).
 */
interface PlayerState {
  current: Track | null;
  isPlaying: boolean;
  /** true mientras el stream carga/bufferea (Audius puede tardar en arrancar). */
  isLoading: boolean;
  /** Mensaje visible cuando una pista no se puede reproducir. */
  error: string | null;
  play: (track: Track) => void;
  toggle: () => void;
  stop: () => void;
  setLoading: (isLoading: boolean) => void;
  fail: (message: string) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  current: null,
  isPlaying: false,
  isLoading: false,
  error: null,
  play: (track) => set({ current: track, isPlaying: true, isLoading: true, error: null }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying, error: null })),
  stop: () => set({ current: null, isPlaying: false, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  fail: (message) => set({ error: message, isPlaying: false, isLoading: false }),
}));
