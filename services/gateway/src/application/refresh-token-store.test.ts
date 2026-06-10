import { describe, expect, it } from 'vitest';
import { InMemoryRefreshTokenStore } from './refresh-token-store.js';

describe('InMemoryRefreshTokenStore', () => {
  it('guarda y devuelve el registro una sola vez (rotación)', async () => {
    const store = new InMemoryRefreshTokenStore();
    const record = { userId: 'user-1', expiresAt: Date.now() + 1000 };

    await store.save('tok-1', record, 60);

    expect(await store.take('tok-1')).toEqual(record);
    // Segundo uso del mismo token → ya no existe (single-use)
    expect(await store.take('tok-1')).toBeNull();
  });

  it('devuelve null para un token desconocido', async () => {
    const store = new InMemoryRefreshTokenStore();
    expect(await store.take('inexistente')).toBeNull();
  });
});
