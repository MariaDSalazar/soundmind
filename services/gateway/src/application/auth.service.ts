import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { AuthTokens, UserProfile } from '@soundmind/shared';
import type { UserRepository } from '../domain/user.repository.js';
import type { KeyPair } from '../infrastructure/keys.js';

const ACCESS_TTL_S = 15 * 60; // 15 min (ver ARQUITECTURA.md §9)
const REFRESH_TTL_S = 7 * 24 * 60 * 60; // 7 días

export class AuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

interface RefreshRecord {
  userId: string;
  expiresAt: number;
}

/**
 * Autenticación con Argon2id + JWT RS256 y refresh tokens ROTATIVOS:
 * cada uso de un refresh token lo invalida y emite uno nuevo.
 * F1: store de refresh en memoria. TODO(F2): mover a Redis (Upstash).
 */
export class AuthService {
  private readonly refreshStore = new Map<string, RefreshRecord>();

  constructor(
    private readonly users: UserRepository,
    private readonly keys: KeyPair,
  ) {}

  async register(email: string, password: string, displayName: string) {
    if (await this.users.findByEmail(email)) {
      throw new AuthError('El email ya está registrado', 409);
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await this.users.create({ email, passwordHash, displayName });
    return this.issueTokens(user.id, user.email, user.displayName);
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    // Verificación en tiempo constante también cuando el usuario no existe
    // (evita enumeración de cuentas por timing)
    const hash = user?.passwordHash ?? (await argon2.hash('dummy-password'));
    const valid = await argon2.verify(hash, password).catch(() => false);
    if (!user || !valid) throw new AuthError('Credenciales inválidas', 401);

    return this.issueTokens(user.id, user.email, user.displayName);
  }

  async refresh(refreshToken: string) {
    const record = this.refreshStore.get(refreshToken);
    this.refreshStore.delete(refreshToken); // rotación: un solo uso
    if (!record || record.expiresAt < Date.now()) {
      throw new AuthError('Refresh token inválido o expirado', 401);
    }
    const user = await this.users.findById(record.userId);
    if (!user) throw new AuthError('Usuario no encontrado', 401);

    return this.issueTokens(user.id, user.email, user.displayName);
  }

  verifyAccessToken(token: string): UserProfile {
    try {
      const payload = jwt.verify(token, this.keys.publicKey, {
        algorithms: ['RS256'],
        audience: 'soundmind-api',
      }) as jwt.JwtPayload;
      return {
        id: String(payload.sub),
        email: String(payload.email),
        displayName: String(payload.name),
      };
    } catch {
      throw new AuthError('Token inválido o expirado', 401);
    }
  }

  private issueTokens(userId: string, email: string, displayName: string) {
    const accessToken = jwt.sign({ email, name: displayName }, this.keys.privateKey, {
      algorithm: 'RS256',
      subject: userId,
      audience: 'soundmind-api',
      expiresIn: ACCESS_TTL_S,
    });

    const refreshToken = randomUUID();
    this.refreshStore.set(refreshToken, {
      userId,
      expiresAt: Date.now() + REFRESH_TTL_S * 1000,
    });

    const tokens: AuthTokens = { accessToken, expiresInS: ACCESS_TTL_S };
    return { tokens, refreshToken, refreshTtlS: REFRESH_TTL_S };
  }
}
