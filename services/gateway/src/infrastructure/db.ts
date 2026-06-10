import pg from 'pg';

/**
 * PATTERN: Singleton controlado — un único Pool de conexiones (Neon),
 * creado en el composition root e inyectado a los repositorios.
 */
export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }, // Neon exige TLS
    max: 5,
  });
}
