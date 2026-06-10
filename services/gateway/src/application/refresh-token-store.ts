/**
 * Puerto del almacén de refresh tokens ROTATIVOS (un solo uso): cada token se
 * guarda al emitirse y se consume con `take()` (lectura + borrado atómico) en
 * el refresh. Abstraerlo permite que los tests y el desarrollo local usen una
 * implementación en memoria y producción una respaldada por Redis.
 */
export interface RefreshRecord {
  userId: string;
  expiresAt: number;
}

export interface RefreshTokenStore {
  save(token: string, record: RefreshRecord, ttlS: number): Promise<void>;
  /** Obtiene y elimina atómicamente el registro (rotación: un solo uso). */
  take(token: string): Promise<RefreshRecord | null>;
}

/**
 * Implementación en memoria — para tests y desarrollo local sin Redis.
 * NO usar en producción con varias instancias: el store no se comparte y se
 * pierde al reiniciar (justo la deuda que el adaptador Redis resuelve).
 */
export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly store = new Map<string, RefreshRecord>();

  async save(token: string, record: RefreshRecord, _ttlS?: number): Promise<void> {
    // El TTL lo gestiona Redis en prod; en memoria basta `expiresAt` del record.
    this.store.set(token, record);
  }

  async take(token: string): Promise<RefreshRecord | null> {
    const record = this.store.get(token) ?? null;
    this.store.delete(token); // un solo uso
    return record;
  }
}
