import { randomUUID } from 'node:crypto';
import type { ListenEvent, ListenEventInput } from '../domain/entities.js';
import type {
  ConsentReaderPort,
  EventStreamPort,
  ListenEventRepository,
} from '../domain/ports.js';

export type RecordResult = 'recorded' | 'no-consent';

/**
 * Caso de uso: registrar un evento de escucha.
 *
 * Reglas de negocio:
 *  - Gate de consentimiento (§9): sin `consent_tracking` no se persiste ni se
 *    publica nada → devuelve 'no-consent' (el controlador responde 204).
 *  - `contextHour` se DERIVA en servidor (0–23): nunca se confía en el cliente.
 *  - `eventId` (UUID) es la clave de idempotencia compartida con el stream (§8):
 *    primero se persiste, luego se publica (at-least-once hacia el recomendador).
 */
export class RecordListenEventUseCase {
  constructor(
    private readonly events: ListenEventRepository,
    private readonly stream: EventStreamPort,
    private readonly consent: ConsentReaderPort,
    // Inyectables para tests deterministas.
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = randomUUID,
  ) {}

  async execute(userId: string, input: ListenEventInput): Promise<RecordResult> {
    if (!(await this.consent.hasTrackingConsent(userId))) return 'no-consent';

    const at = this.now();
    const event: ListenEvent = {
      eventId: this.newId(),
      userId,
      trackId: input.trackId,
      eventType: input.eventType,
      playedMs: input.playedMs,
      device: input.device,
      track: input.track, // snapshot inmutable para reconstruir el historial
      contextHour: at.getHours(),
      createdAt: at.toISOString(),
    };

    await this.events.save(event); // fuente de verdad primero…
    await this.stream.publishListenEvent(event); // …luego la señal para la IA.
    return 'recorded';
  }
}
