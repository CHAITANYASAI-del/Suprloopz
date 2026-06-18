// Thin wrapper over the Keycloak Admin REST API + token endpoint.
// Handles: vendor invite (create user + temp password + UPDATE_PASSWORD action),
// password grant login, refresh, logout, and role assignment.
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const { url, realm, clientId, clientSecret, publicClientId, adminUsername, adminPassword } =
  config.keycloak;

const tokenEndpoint = (r) => `${url}/realms/${r}/protocol/openid-connect/token`;
const adminBase = `${url}/admin/realms/${realm}`;

let cachedAdminToken = null;
let cachedExpiry = 0;

async function kcFetch(path, options = {}, token) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  return res;
}

/** Obtain (and cache) a master-realm admin token via the admin-cli client. */
async function getAdminToken() {
  const now = Date.now();
  if (cachedAdminToken && now < cachedExpiry - 5000) return cachedAdminToken;

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: adminUsername,
    password: adminPassword,
  });
  const res = await fetch(tokenEndpoint('master'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak admin auth failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  cachedAdminToken = json.access_token;
  cachedExpiry = now + json.expires_in * 1000;
  return cachedAdminToken;
}

/**
 * Create a vendor in Keycloak with a temporary password and a forced
 * UPDATE_PASSWORD action. Returns the Keycloak user id.
 */
export async function createVendorUser({ email, tempPassword }) {
  const token = await getAdminToken();

  const createRes = await kcFetch(
    `${adminBase}/users`,
    {
      method: 'POST',
      body: JSON.stringify({
        username: email,
        email,
        emailVerified: true,
        enabled: true,
        requiredActions: ['UPDATE_PASSWORD'],
        credentials: [{ type: 'password', value: tempPassword, temporary: true }],
      }),
    },
    token,
  );

  if (createRes.status === 409) {
    throw Object.assign(new Error('A user with this email already exists'), { status: 409 });
  }
  if (!createRes.ok && createRes.status !== 201) {
    const text = await createRes.text();
    throw new Error(`Keycloak createUser failed (${createRes.status}): ${text}`);
  }

  // Keycloak returns the new user URL in the Location header.
  const location = createRes.headers.get('location');
  const keycloakId = location?.split('/').pop();
  if (!keycloakId) throw new Error('Keycloak did not return a user id');

  await assignRealmRole(keycloakId, 'vendor');
  logger.info({ email, keycloakId }, 'vendor created in Keycloak');
  return keycloakId;
}

/** Assign a realm role to a user by role name. */
export async function assignRealmRole(keycloakId, roleName) {
  const token = await getAdminToken();
  const roleRes = await kcFetch(`${adminBase}/roles/${roleName}`, {}, token);
  if (!roleRes.ok) throw new Error(`Role '${roleName}' not found in realm`);
  const role = await roleRes.json();

  const assignRes = await kcFetch(
    `${adminBase}/users/${keycloakId}/role-mappings/realm`,
    { method: 'POST', body: JSON.stringify([{ id: role.id, name: role.name }]) },
    token,
  );
  if (!assignRes.ok) {
    const text = await assignRes.text();
    throw new Error(`Assign role failed (${assignRes.status}): ${text}`);
  }
}

/** Set a permanent password and clear the UPDATE_PASSWORD required action. */
export async function setPermanentPassword(keycloakId, newPassword) {
  const token = await getAdminToken();

  const reset = await kcFetch(
    `${adminBase}/users/${keycloakId}/reset-password`,
    { method: 'PUT', body: JSON.stringify({ type: 'password', value: newPassword, temporary: false }) },
    token,
  );
  if (!reset.ok) {
    const text = await reset.text();
    throw new Error(`reset-password failed (${reset.status}): ${text}`);
  }

  // Clear any remaining required actions.
  const update = await kcFetch(
    `${adminBase}/users/${keycloakId}`,
    { method: 'PUT', body: JSON.stringify({ requiredActions: [] }) },
    token,
  );
  if (!update.ok) {
    const text = await update.text();
    throw new Error(`clear requiredActions failed (${update.status}): ${text}`);
  }
}

export async function setEnabled(keycloakId, enabled) {
  const token = await getAdminToken();
  const res = await kcFetch(
    `${adminBase}/users/${keycloakId}`,
    { method: 'PUT', body: JSON.stringify({ enabled }) },
    token,
  );
  if (!res.ok) throw new Error(`setEnabled failed (${res.status})`);
}

/** Look up a Keycloak user (incl. requiredActions) by id. */
export async function getKeycloakUser(keycloakId) {
  const token = await getAdminToken();
  const res = await kcFetch(`${adminBase}/users/${keycloakId}`, {}, token);
  if (!res.ok) return null;
  return res.json();
}

/** Find a Keycloak user by exact email. Returns the representation or null. */
export async function findUserByEmail(email) {
  const token = await getAdminToken();
  const res = await kcFetch(
    `${adminBase}/users?email=${encodeURIComponent(email)}&exact=true`,
    {},
    token,
  );
  if (!res.ok) return null;
  const list = await res.json();
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

/**
 * Resource Owner Password Credentials login through the public client.
 * Returns the full token set so the caller can read realm_access roles and
 * detect whether a password update is still required.
 */
export async function passwordLogin({ email, password }) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: publicClientId,
    username: email,
    password,
    scope: 'openid',
  });
  const res = await fetch(tokenEndpoint(realm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Keycloak signals a pending UPDATE_PASSWORD as an invalid_grant with a
    // descriptive error so the frontend can route to /reset-password.
    return { ok: false, status: res.status, error: json.error, description: json.error_description };
  }
  return { ok: true, tokens: json };
}

export async function refreshTokens(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: publicClientId,
    refresh_token: refreshToken,
  });
  const res = await fetch(tokenEndpoint(realm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, error: text };
  }
  return { ok: true, tokens: await res.json() };
}

export async function logout(refreshToken) {
  const body = new URLSearchParams({
    client_id: publicClientId,
    refresh_token: refreshToken,
  });
  await fetch(`${url}/realms/${realm}/protocol/openid-connect/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

/** Backend service-account token (client_credentials) — reserved for future
 *  server-to-server calls. */
export async function getServiceToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(tokenEndpoint(realm), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`service token failed (${res.status})`);
  return (await res.json()).access_token;
}
