export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
}

/**
 * PATTERN: Repository — el dominio define el contrato de persistencia.
 * F1 usa una implementación en memoria; F2 la reemplaza por PostgreSQL
 * (Supabase) sin tocar los casos de uso. Esa es la gracia del patrón.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(user: Omit<UserRecord, 'id' | 'createdAt'>): Promise<UserRecord>;
}

/** Implementación F1: en memoria. TODO(F2): PostgresUserRepository. */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>();
  private seq = 0;

  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async create(data: Omit<UserRecord, 'id' | 'createdAt'>): Promise<UserRecord> {
    const user: UserRecord = { ...data, id: String(++this.seq), createdAt: new Date() };
    this.users.set(user.id, user);
    return user;
  }
}
