import { describe, expect, it } from 'vitest';
import type { HistoryPage, ListenEvent } from '../domain/entities.js';
import type { ListenEventRepository } from '../domain/ports.js';
import { GetHistoryUseCase } from './get-history.js';

/** Fake que registra los argumentos de paginación que recibe el repositorio. */
class FakeEvents implements ListenEventRepository {
  lastCall: { userId: string; limit: number; cursor: string | null } | null = null;
  constructor(private readonly page: HistoryPage) {}
  async save(): Promise<void> {}
  async history(userId: string, limit: number, cursor: string | null): Promise<HistoryPage> {
    this.lastCall = { userId, limit, cursor };
    return this.page;
  }
}

const event: ListenEvent = {
  eventId: 'evt-1',
  userId: 'user-1',
  trackId: 'audius:7',
  eventType: 'complete',
  playedMs: 180_000,
  contextHour: 21,
  createdAt: new Date(0).toISOString(),
};

describe('GetHistoryUseCase', () => {
  it('delega en el repositorio pasando userId, limit y cursor', async () => {
    const repo = new FakeEvents({ events: [event], nextCursor: 'cur-2' });
    const useCase = new GetHistoryUseCase(repo);

    const result = await useCase.execute('user-1', 20, 'cur-1');

    expect(result).toEqual({ events: [event], nextCursor: 'cur-2' });
    expect(repo.lastCall).toEqual({ userId: 'user-1', limit: 20, cursor: 'cur-1' });
  });

  it('propaga el cursor null de la primera página', async () => {
    const repo = new FakeEvents({ events: [], nextCursor: null });
    const useCase = new GetHistoryUseCase(repo);

    const result = await useCase.execute('user-1', 20, null);

    expect(result.nextCursor).toBeNull();
    expect(repo.lastCall?.cursor).toBeNull();
  });
});
