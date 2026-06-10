import type { HistoryPage } from '../domain/entities.js';
import type { ListenEventRepository } from '../domain/ports.js';

/**
 * Caso de uso: leer el historial de escucha del usuario, paginado
 * cursor-based (§8). El cursor es opaco para el cliente; el repositorio lo
 * interpreta como `(created_at, event_id)` del último elemento de la página.
 */
export class GetHistoryUseCase {
  constructor(private readonly events: ListenEventRepository) {}

  execute(userId: string, limit: number, cursor: string | null): Promise<HistoryPage> {
    return this.events.history(userId, limit, cursor);
  }
}
