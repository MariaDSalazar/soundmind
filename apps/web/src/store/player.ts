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
  play: (track: Track) => void;
  toggle: () => void;
  stop: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  current: null,
  isPlaying: false,
  play: (track) => set({ current: track, isPlaying: true }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  stop: () => set({ current: null, isPlaying: false }),
}));
