// Minimal forward-only SQL migration runner.
// Applies every *.sql file in ./migrations in lexical order, skipping any
// version already recorded in schema_migrations. Each file is run in its own
// transaction (the files themselves wrap statements in BEGIN/COMMIT).
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', '..', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedVersions(client) {
  const { rows } = await client.query('SELECT version FROM schema_migrations');
  return new Set(rows.map((r) => r.version));
}

async function run() {
  const client = new Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    await ensureMigrationsTable(client);
    const done = await appliedVersions(client);

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (done.has(version)) {
        logger.debug({ version }, 'migration already applied, skipping');
        continue;
      }
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      logger.info({ version }, 'applying migration');
      // The .sql file manages its own BEGIN/COMMIT and records itself in
      // schema_migrations; run it as a single multi-statement query.
      await client.query(sql);
      logger.info({ version }, 'migration applied');
    }
    logger.info('all migrations up to date');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  logger.error({ err }, 'migration failed');
  process.exit(1);
});
