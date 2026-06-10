import pg from 'pg';

/**
 * PATTERN: Singleton controlado — un único Pool de conexiones, creado en el
 * composition root e inyectado a los repositorios (no es un global suelto).
 * Neon free tier: usar el endpoint *pooled* en DATABASE_URL.
 */
export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    // Neon exige TLS; el sslmode=require de la URL ya lo activa.
    ssl: { rejectUnauthorized: false },
    max: 5, // free tier: pocas conexiones
  });
}
