// Authentication + authorization middleware.
//   requireAuth  -> verifies the Keycloak JWT, resolves/just-in-time-provisions
//                   the local users row, and attaches req.user.
//   requireRole  -> guards an endpoint to specific application roles.
import { verifyAccessToken, resolveAppRole } from '../keycloak/jwt.js';
import { withSystemContext } from '../db/pool.js';
import { unauthorized, forbidden } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../config/logger.js';

/** Find the local users row for a Keycloak subject, creating it if missing. */
async function resolveLocalUser({ keycloakId, email, role }) {
  return withSystemContext(async (client) => {
    const found = await client.query('SELECT id, email, role FROM users WHERE keycloak_id = $1', [
      keycloakId,
    ]);
    if (found.rowCount > 0) {
      const u = found.rows[0];
      // Keep role in sync if it changed in Keycloak (e.g. admin promotion).
      if (u.role !== role) {
        await client.query('UPDATE users SET role = $1 WHERE id = $2', [role, u.id]);
      }
      return { id: u.id, email: u.email, role };
    }
    // JIT-provision (covers admin/support created directly in Keycloak).
    const inserted = await client.query(
      `INSERT INTO users (keycloak_id, email, role) VALUES ($1, $2, $3)
       ON CONFLICT (keycloak_id) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email, role`,
      [keycloakId, email, role],
    );
    // Ensure an onboarding_status row exists for vendors.
    if (role === 'vendor') {
      await client.query(
        `INSERT INTO onboarding_status (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [inserted.rows[0].id],
      );
    }
    return inserted.rows[0];
  });
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized('Missing bearer token');

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch (err) {
    logger.debug({ err: err.message }, 'JWT verification failed');
    throw unauthorized('Invalid or expired token');
  }

  const role = resolveAppRole(payload);
  const local = await resolveLocalUser({
    keycloakId: payload.sub,
    email: payload.email || payload.preferred_username,
    role,
  });

  req.user = {
    id: local.id,
    keycloakId: payload.sub,
    email: local.email,
    role: local.role,
  };
  next();
});

export const requireRole = (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('Insufficient role'));
    next();
  };
