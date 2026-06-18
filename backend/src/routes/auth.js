// Auth routes — login, refresh, logout, reset-password.
// Login/refresh proxy Keycloak's token endpoint so the frontend never holds
// the client secret. Reset-password drives the first-login UPDATE_PASSWORD flow.
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { loginSchema, refreshSchema, resetPasswordSchema } from '../validation/schemas.js';
import { z } from 'zod';
import {
  passwordLogin,
  refreshTokens,
  logout as kcLogout,
  findUserByEmail,
  setPermanentPassword,
} from '../keycloak/admin.js';
import { withSystemContext } from '../db/pool.js';
import { audit } from '../utils/audit.js';
import { sendPasswordResetConfirmation } from '../email/resend.js';
import { ApiError, unauthorized } from '../utils/errors.js';

export const authRouter = Router();

// Tighter limit on auth endpoints to blunt brute force (Keycloak also locks out).
const authLimiter = rateLimit({ windowSeconds: 60, max: 10, keyPrefix: 'rl:auth' });

function isPendingPasswordUpdate(result) {
  // Keycloak returns invalid_grant + "Account is not fully set up" when the
  // credentials are valid but UPDATE_PASSWORD is still required.
  const d = (result.description || '').toLowerCase();
  return result.error === 'invalid_grant' && d.includes('not fully set up');
}

async function loadOnboarding(keycloakId) {
  return withSystemContext(async (client) => {
    const u = await client.query(
      `SELECT u.id, u.email, u.role, os.*
         FROM users u
         LEFT JOIN onboarding_status os ON os.user_id = u.id
        WHERE u.keycloak_id = $1`,
      [keycloakId],
    );
    return u.rows[0] || null;
  });
}

// POST /api/auth/login
authRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await passwordLogin({ email, password });

    if (!result.ok) {
      if (isPendingPasswordUpdate(result)) {
        // Credentials valid, but the vendor must set a new password first.
        return res.json({ passwordResetRequired: true, email });
      }
      throw unauthorized('Invalid email or password');
    }

    // Decode sub from the access token to load onboarding state.
    const payload = JSON.parse(
      Buffer.from(result.tokens.access_token.split('.')[1], 'base64').toString('utf8'),
    );
    const onboarding = await loadOnboarding(payload.sub);

    res.json({
      tokens: {
        accessToken: result.tokens.access_token,
        refreshToken: result.tokens.refresh_token,
        expiresIn: result.tokens.expires_in,
      },
      user: onboarding
        ? { id: onboarding.id, email: onboarding.email, role: onboarding.role }
        : { email },
      onboarding: onboarding
        ? {
            passwordReset: onboarding.password_reset,
            profileCompleted: onboarding.profile_completed,
            companyInfoCompleted: onboarding.company_info_completed,
            legalDocsCompleted: onboarding.legal_docs_completed,
            addressCompleted: onboarding.address_completed,
            fullyOnboarded: onboarding.fully_onboarded,
          }
        : null,
    });
  }),
);

// POST /api/auth/reset-password
// Body: { email, currentPassword, newPassword, confirmPassword }
authRouter.post(
  '/reset-password',
  authLimiter,
  validate({
    body: resetPasswordSchema.and(
      z.object({ email: z.string().email(), currentPassword: z.string().min(1) }),
    ),
  }),
  asyncHandler(async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;

    // Confirm the current (temporary) password is valid before changing it.
    const check = await passwordLogin({ email, password: currentPassword });
    if (!check.ok && !isPendingPasswordUpdate(check)) {
      throw unauthorized('Current password is incorrect');
    }

    const kcUser = await findUserByEmail(email);
    if (!kcUser) throw new ApiError(404, 'Account not found');

    await setPermanentPassword(kcUser.id, newPassword);

    // Mark onboarding password_reset = true and audit.
    await withSystemContext(async (client) => {
      const u = await client.query('SELECT id FROM users WHERE keycloak_id = $1', [kcUser.id]);
      if (u.rowCount > 0) {
        await client.query(
          `UPDATE onboarding_status SET password_reset = true WHERE user_id = $1`,
          [u.rows[0].id],
        );
        await audit(client, {
          userId: u.rows[0].id,
          action: 'auth.password_reset',
          metadata: { email },
          req,
        });
      }
    });

    await sendPasswordResetConfirmation({ to: email }).catch(() => {});

    // Log the user straight in with the new password.
    const fresh = await passwordLogin({ email, password: newPassword });
    res.json({
      message: 'Password updated',
      tokens: fresh.ok
        ? {
            accessToken: fresh.tokens.access_token,
            refreshToken: fresh.tokens.refresh_token,
            expiresIn: fresh.tokens.expires_in,
          }
        : null,
    });
  }),
);

// POST /api/auth/refresh
authRouter.post(
  '/refresh',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const result = await refreshTokens(req.body.refreshToken);
    if (!result.ok) throw unauthorized('Could not refresh session');
    res.json({
      tokens: {
        accessToken: result.tokens.access_token,
        refreshToken: result.tokens.refresh_token,
        expiresIn: result.tokens.expires_in,
      },
    });
  }),
);

// POST /api/auth/logout
authRouter.post(
  '/logout',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    await kcLogout(req.body.refreshToken).catch(() => {});
    res.json({ message: 'Logged out' });
  }),
);
