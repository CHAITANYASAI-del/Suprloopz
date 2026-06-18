// JWT verification against the Keycloak realm's JWKS.
// Verifies signature, issuer, expiry and extracts roles from realm_access.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config/env.js';

const issuer = `${config.keycloak.url}/realms/${config.keycloak.realm}`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));

/**
 * Verify a bearer access token. Returns the decoded payload, or throws.
 */
export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    // Keycloak access tokens are not audience-restricted to a single client by
    // default; we validate issuer + signature + expiry which is sufficient here.
  });
  return payload;
}

/** Map Keycloak realm roles onto our application role. */
export function resolveAppRole(payload) {
  const roles = payload?.realm_access?.roles ?? [];
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('support')) return 'support';
  if (roles.includes('vendor')) return 'vendor';
  return 'vendor';
}
