import type { Like } from '../domain/entities.js';
import type { LikeRepository } from '../domain/ports.js';

/**
 * Caso de uso: gestionar likes. El like es una acción EXPLÍCITA del usuario, así
 * que se persiste sin gate de consentimiento (el consentimiento regula el
 * tracking pasivo de escucha, no las acciones que el usuario inicia).
 * La publicación del like como SEÑAL para la IA sí se condicionará al
 * consentimiento cuando se conecte el recomendador (F3).
 */
export class ToggleLikeUseCase {
  constructor(private readonly likes: LikeRepository) {}

  add(userId: string, trackId: string): Promise<Like> {
    return this.likes.add(userId, trackId);
  }

  remove(userId: string, trackId: string): Promise<void> {
    return this.likes.remove(userId, trackId);
  }

  list(userId: string): Promise<Like[]> {
    return this.likes.list(userId);
  }
}
