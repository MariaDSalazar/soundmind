// Runner de migraciones temporal (no versionar). Ejecuta los .sql en orden.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const files = [
  'services/gateway/migrations/001_users.sql',
  'services/users/migrations/001_likes_listen_events.sql',
];

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

for (const f of files) {
  const sql = readFileSync(f, 'utf8');
  await pool.query(sql);
  console.log('OK', f);
}

const { rows } = await pool.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema='public' AND table_name IN ('users','likes','listen_events')
   ORDER BY table_name`,
);
console.log('Tablas presentes:', rows.map((r) => r.table_name).join(', '));
await pool.end();
