import { describe, expect, it } from 'vitest';
import type { HistoryPage, Like, ListenEvent } from '../domain/entities.js';
import type {
  ConsentReaderPort,
  EventStreamPort,
  ListenEventRepository,
} from '../domain/ports.js';
import { RecordListenEventUseCase } from './record-listen-event.js';

class FakeEvents implements ListenEventRepository {
  saved: ListenEvent[] = [];
  async save(event: ListenEvent) {
    this.saved.push(event);
  }
  async history(): Promise<HistoryPage> {
    return { events: this.saved, nextCursor: null };
  }
}

class FakeStream implements EventStreamPort {
  published: ListenEvent[] = [];
  async publishListenEvent(event: ListenEvent) {
    this.published.push(event);
  }
}

const consent = (granted: boolean): ConsentReaderPort => ({
  hasTrackingConsent: async () => granted,
});

const input = { trackId: 'jamendo:42', eventType: 'complete', playedMs: 180_000 } as const;

describe('RecordListenEventUseCase', () => {
  it('persiste y publica cuando hay consentimiento, derivando contextHour en servidor', async () => {
    const events = new FakeEvents();
    const stream = new FakeStream();
    const at = new Date('2026-06-09T21:30:00');
    const useCase = new RecordListenEventUseCase(events, stream, consent(true), () => at, () => 'evt-1');

    const result = await useCase.execute('user-1', input);

    expect(result).toBe('recorded');
    expect(events.saved).toHaveLength(1);
    expect(stream.published).toHaveLength(1);
    expect(events.saved[0]).toMatchObject({ eventId: 'evt-1', userId: 'user-1', contextHour: 21 });
    // misma clave de idempotencia en DB y stream (§8)
    expect(stream.published[0].eventId).toBe(events.saved[0].eventId);
  });

  it('NO persiste ni publica sin consentimiento (privacidad por diseño, §9)', async () => {
    const events = new FakeEvents();
    const stream = new FakeStream();
    const useCase = new RecordListenEventUseCase(events, stream, consent(false));

    const result = await useCase.execute('user-1', input);

    expect(result).toBe('no-consent');
    expect(events.saved).toHaveLength(0);
    expect(stream.published).toHaveLength(0);
  });
});

// Tipo solo para asegurar que Like se exporta del dominio (sanity de tipos).
const _likeShape: Like = { userId: '1', trackId: 'audius:1', createdAt: new Date(0).toISOString() };
void _likeShape;
