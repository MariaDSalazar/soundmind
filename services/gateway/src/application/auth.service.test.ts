import { beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { InMemoryUserRepository } from '../domain/user.repository.js';
import { AuthError, AuthService } from './auth.service.js';

const keys = (() => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKey, publicKey };
})();

describe('AuthService', () => {
  let auth: AuthService;

  beforeEach(() => {
    auth = new AuthService(new InMemoryUserRepository(), keys);
  });

  it('registra un usuario y emite un access token RS256 verificable', async () => {
    const { tokens } = await auth.register('carmen@test.dev', 'superSegura123', 'Carmen');
    const profile = auth.verifyAccessToken(tokens.accessToken);

    expect(profile.email).toBe('carmen@test.dev');
    expect(profile.displayName).toBe('Carmen');
    expect(tokens.expiresInS).toBe(15 * 60);
  });

  it('rechaza registro con email duplicado (409)', async () => {
    await auth.register('carmen@test.dev', 'superSegura123', 'Carmen');
    await expect(auth.register('carmen@test.dev', 'otraClave456', 'Otra')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('login falla con credenciales inválidas sin revelar si el email existe', async () => {
    await auth.register('carmen@test.dev', 'superSegura123', 'Carmen');

    await expect(auth.login('carmen@test.dev', 'incorrecta')).rejects.toBeInstanceOf(AuthError);
    await expect(auth.login('noexiste@test.dev', 'incorrecta')).rejects.toMatchObject({
      message: 'Credenciales inválidas', // mismo mensaje en ambos casos
    });
  });

  it('rota el refresh token: el anterior queda invalidado tras usarse', async () => {
    const { refreshToken } = await auth.register('carmen@test.dev', 'superSegura123', 'Carmen');

    const renewed = await auth.refresh(refreshToken);
    expect(renewed.refreshToken).not.toBe(refreshToken);

    // Reuso del token viejo → rechazado (detección de robo de sesión)
    await expect(auth.refresh(refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it('rechaza access tokens manipulados', () => {
    expect(() => auth.verifyAccessToken('token.falso.aqui')).toThrow(AuthError);
  });
});
