import { create } from 'zustand';
import type { Track } from '@soundmind/shared';

/**
 * Estado de "descubrir" (F3): qué pista es el ANCLA de "Más como esta". Cuando
 * hay ancla, la vista Para ti muestra similares; si es null, muestra las recos
 * personales por gusto. Se separa del player para no acoplar reproducción y
 * exploración.
 */
interface DiscoverState {
  similarTo: Track | null;
  setSimilarTo: (track: Track | null) => void;
}

export const useDiscoverStore = create<DiscoverState>((set) => ({
  similarTo: null,
  setSimilarTo: (similarTo) => set({ similarTo }),
}));
