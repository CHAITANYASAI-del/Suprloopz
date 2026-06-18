// Seeds an initial SuperLoopz admin so you can call the invite endpoint.
// Creates the user in Keycloak (with the 'admin' realm role) and a matching
// users row in Postgres. Idempotent — safe to re-run.
//
//   npm run seed
//
// Defaults (override via env): SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { findUserByEmail, assignRealmRole } from '../keycloak/admin.js';
import { withSystemContext } from '../db/pool.js';

const email = process.env.SEED_ADMIN_EMAIL || 'admin@superloopz.com';
const password = process.env.SEED_ADMIN_PASSWORD || 'SuperLoopzAdmin#1';

const { url, realm, adminUsername, adminPassword } = config.keycloak;
const adminBase = `${url}/admin/realms/${realm}`;

async function getAdminToken() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: adminUsername,
    password: adminPassword,
  });
  const res = await fetch(`${url}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`admin token failed: ${res.status}`);
  return (await res.json()).access_token;
}

async function run() {
  const token = await getAdminToken();

  let kcUser = await findUserByEmail(email);
  if (!kcUser) {
    const res = await fetch(`${adminBase}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        username: email,
        email,
        emailVerified: true,
        enabled: true,
        credentials: [{ type: 'password', value: password, temporary: false }],
      }),
    });
    if (!res.ok && res.status !== 201) throw new Error(`create admin failed: ${res.status}`);
    kcUser = await findUserByEmail(email);
    logger.info({ email }, 'admin created in Keycloak');
  } else {
    logger.info({ email }, 'admin already exists in Keycloak');
  }

  await assignRealmRole(kcUser.id, 'admin');

  await withSystemContext(async (client) => {
    await client.query(
      `INSERT INTO users (keycloak_id, email, role) VALUES ($1, $2, 'admin')
       ON CONFLICT (keycloak_id) DO UPDATE SET role = 'admin'`,
      [kcUser.id, email],
    );
  });

  logger.info({ email, password }, 'seed complete — admin ready');
  process.exit(0);
}

run().catch((err) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
