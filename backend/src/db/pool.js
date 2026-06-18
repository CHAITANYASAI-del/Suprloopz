// PostgreSQL connection pool + Row Level Security context helpers.
//
// Every query that touches tenant data MUST run inside one of the context
// helpers below. They open a transaction and set the per-request GUCs that the
// RLS policies (see migrations/001_init.sql) read:
//
//     app.current_user_id  -> the acting users.id
//     app.user_role        -> 'vendor' | 'admin' | 'support'
//
// set_config(..., true) scopes the setting to the current transaction only, so
// pooled connections never leak one request's identity into another.
import pg from 'pg';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected idle Postgres client error');
});

/**
 * Run `fn(client)` inside a transaction scoped to a specific user identity.
 * Commits on success, rolls back on any thrown error.
 *
 * @param {{ id: string, role: string }} actor  the acting user
 * @param {(client: pg.PoolClient) => Promise<any>} fn
 */
export async function withUserContext(actor, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true), set_config($3, $4, true)', [
      'app.current_user_id',
      actor?.id ?? '',
      'app.user_role',
      actor?.role ?? 'anonymous',
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Privileged context for system operations that have no end-user yet
 * (e.g. creating the user row during an admin invite). Acts with the 'admin'
 * role so RLS WITH CHECK clauses pass, but still goes through a transaction.
 */
export function withSystemContext(fn) {
  return withUserContext({ id: '', role: 'admin' }, fn);
}

export async function closePool() {
  await pool.end();
}
