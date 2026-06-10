import { describe, expect, it } from 'vitest';
import type { Like } from '../domain/entities.js';
import type { LikeRepository } from '../domain/ports.js';
import { ToggleLikeUseCase } from './toggle-like.js';

/** Fake en memoria del repositorio de likes, idempotente por (userId, trackId). */
class FakeLikes implements LikeRepository {
  private readonly rows = new Map<string, Like>();
  private key(userId: string, trackId: string) {
    return `${userId}::${trackId}`;
  }
  async add(userId: string, trackId: string): Promise<Like> {
    const like: Like = { userId, trackId, createdAt: new Date(0).toISOString() };
    this.rows.set(this.key(userId, trackId), like); // idempotente
    return like;
  }
  async remove(userId: string, trackId: string): Promise<void> {
    this.rows.delete(this.key(userId, trackId));
  }
  async list(userId: string): Promise<Like[]> {
    return [...this.rows.values()].filter((l) => l.userId === userId);
  }
}

describe('ToggleLikeUseCase', () => {
  it('añade un like y lo lista para el usuario dueño', async () => {
    const useCase = new ToggleLikeUseCase(new FakeLikes());

    const like = await useCase.add('user-1', 'jamendo:42');

    expect(like).toMatchObject({ userId: 'user-1', trackId: 'jamendo:42' });
    expect(await useCase.list('user-1')).toHaveLength(1);
  });

  it('add es idempotente: dos veces el mismo track no duplica', async () => {
    const useCase = new ToggleLikeUseCase(new FakeLikes());

    await useCase.add('user-1', 'jamendo:42');
    await useCase.add('user-1', 'jamendo:42');

    expect(await useCase.list('user-1')).toHaveLength(1);
  });

  it('remove quita el like y no afecta a otros usuarios', async () => {
    const useCase = new ToggleLikeUseCase(new FakeLikes());
    await useCase.add('user-1', 'jamendo:42');
    await useCase.add('user-2', 'jamendo:42');

    await useCase.remove('user-1', 'jamendo:42');

    expect(await useCase.list('user-1')).toHaveLength(0);
    expect(await useCase.list('user-2')).toHaveLength(1);
  });
});
