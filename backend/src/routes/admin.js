// Admin + support routes.
//   - admin:   invite vendors, change status, verify/reject documents
//   - support: read-only access to all vendor data (per Tech Stack Report §4)
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { withUserContext } from '../db/pool.js';
import { audit } from '../utils/audit.js';
import { generateTempPassword } from '../utils/password.js';
import { createVendorUser, setEnabled, findUserByEmail } from '../keycloak/admin.js';
import { sendVendorInvite, sendDocumentApproved, sendDocumentRejected } from '../email/resend.js';
import {
  inviteSchema,
  statusUpdateSchema,
  rejectSchema,
  vendorListQuery,
} from '../validation/schemas.js';
import { ApiError, notFound, conflict } from '../utils/errors.js';

export const adminRouter = Router();
adminRouter.use(requireAuth);

const uuidParam = z.object({ id: z.string().uuid() });
const docParams = z.object({ id: z.string().uuid(), docId: z.string().uuid() });

// ---------------------------------------------------------------------------
// POST /api/admin/vendors/invite   (admin only)
// ---------------------------------------------------------------------------
adminRouter.post(
  '/vendors/invite',
  requireRole('admin'),
  idempotency(),
  validate({ body: inviteSchema }),
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    // Guard against duplicates in both Keycloak and Postgres.
    const existingKc = await findUserByEmail(email);
    if (existingKc) throw conflict('A user with this email already exists');

    const tempPassword = generateTempPassword();
    const keycloakId = await createVendorUser({ email, tempPassword });

    const created = await withUserContext(req.user, async (client) => {
      const u = await client.query(
        `INSERT INTO users (keycloak_id, email, role) VALUES ($1, $2, 'vendor') RETURNING id, email, role`,
        [keycloakId, email],
      );
      const userId = u.rows[0].id;
      await client.query(
        `INSERT INTO vendor_profiles (user_id, onboarding_step, status) VALUES ($1, 1, 'pending')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      await client.query(
        `INSERT INTO onboarding_status (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      await audit(client, {
        userId: req.user.id,
        action: 'admin.vendor_invited',
        metadata: { invitedEmail: email, vendorUserId: userId },
        req,
      });
      return u.rows[0];
    });

    await sendVendorInvite({ to: email, tempPassword }).catch(() => {});

    res.status(201).json({
      message: 'Vendor invited',
      vendor: { id: created.id, email: created.email, role: created.role },
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/admin/stats   (admin + support)  — dashboard summary counts
// ---------------------------------------------------------------------------
adminRouter.get(
  '/stats',
  requireRole('admin', 'support'),
  asyncHandler(async (req, res) => {
    const stats = await withUserContext(req.user, async (client) => {
      const counts = await client.query(`
        SELECT
          count(*)::int                                                      AS total,
          count(*) FILTER (WHERE vp.status = 'active')::int                  AS active,
          count(*) FILTER (WHERE vp.status = 'pending')::int                 AS pending,
          count(*) FILTER (WHERE vp.status = 'suspended')::int               AS suspended,
          count(*) FILTER (WHERE os.fully_onboarded)::int                    AS fully_onboarded
        FROM users u
        LEFT JOIN vendor_profiles vp ON vp.user_id = u.id
        LEFT JOIN onboarding_status os ON os.user_id = u.id
        WHERE u.role = 'vendor'
      `);
      const docs = await client.query(
        `SELECT count(*)::int AS pending_doc_reviews
           FROM legal_documents
          WHERE verified = false AND file_url IS NOT NULL`,
      );
      return { ...counts.rows[0], ...docs.rows[0] };
    });
    res.json({ stats });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/admin/vendors   (admin + support)  — list with filters
// ---------------------------------------------------------------------------
adminRouter.get(
  '/vendors',
  requireRole('admin', 'support'),
  validate({ query: vendorListQuery }),
  asyncHandler(async (req, res) => {
    const { status, search, page, pageSize } = req.query;
    const offset = (page - 1) * pageSize;

    const result = await withUserContext(req.user, async (client) => {
      const conditions = ["u.role = 'vendor'"];
      const params = [];
      if (status) {
        params.push(status);
        conditions.push(`vp.status = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        const i = params.length;
        conditions.push(
          `(u.email ILIKE $${i} OR vp.first_name ILIKE $${i} OR vp.last_name ILIKE $${i} OR c.legal_name ILIKE $${i})`,
        );
      }
      const where = `WHERE ${conditions.join(' AND ')}`;

      const countRes = await client.query(
        `SELECT count(*)::int AS total
           FROM users u
           LEFT JOIN vendor_profiles vp ON vp.user_id = u.id
           LEFT JOIN companies c ON c.user_id = u.id
           ${where}`,
        params,
      );

      params.push(pageSize, offset);
      const rows = await client.query(
        `SELECT u.id, u.email, u.created_at,
                vp.first_name, vp.last_name, vp.phone, vp.status, vp.onboarding_step,
                c.legal_name, c.trade_name, c.industry,
                os.fully_onboarded, os.legal_docs_completed
           FROM users u
           LEFT JOIN vendor_profiles vp ON vp.user_id = u.id
           LEFT JOIN companies c ON c.user_id = u.id
           LEFT JOIN onboarding_status os ON os.user_id = u.id
           ${where}
           ORDER BY u.created_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
      return { total: countRes.rows[0].total, rows: rows.rows };
    });

    res.json({
      vendors: result.rows,
      pagination: { page, pageSize, total: result.total, totalPages: Math.ceil(result.total / pageSize) },
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/admin/vendors/:id   (admin + support)  — full profile
// ---------------------------------------------------------------------------
adminRouter.get(
  '/vendors/:id',
  requireRole('admin', 'support'),
  validate({ params: uuidParam }),
  asyncHandler(async (req, res) => {
    const data = await withUserContext(req.user, async (client) => {
      const user = await client.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [
        req.params.id,
      ]);
      if (user.rowCount === 0) return null;

      const [profile, company, onboarding] = await Promise.all([
        client.query('SELECT * FROM vendor_profiles WHERE user_id = $1', [req.params.id]),
        client.query('SELECT * FROM companies WHERE user_id = $1', [req.params.id]),
        client.query('SELECT * FROM onboarding_status WHERE user_id = $1', [req.params.id]),
      ]);

      const companyId = company.rows[0]?.id;
      const documents = companyId
        ? (await client.query('SELECT * FROM legal_documents WHERE company_id = $1 ORDER BY doc_type', [companyId])).rows
        : [];
      const addresses = companyId
        ? (await client.query('SELECT * FROM addresses WHERE company_id = $1 ORDER BY type', [companyId])).rows
        : [];
      const activity = (
        await client.query(
          'SELECT action, metadata, ip_address, created_at FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
          [req.params.id],
        )
      ).rows;

      return {
        user: user.rows[0],
        profile: profile.rows[0] || null,
        company: company.rows[0] || null,
        onboarding: onboarding.rows[0] || null,
        documents,
        addresses,
        activity,
      };
    });

    if (!data) throw notFound('Vendor not found');
    res.json(data);
  }),
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/vendors/:id/status   (admin only)
// ---------------------------------------------------------------------------
adminRouter.patch(
  '/vendors/:id/status',
  requireRole('admin'),
  validate({ params: uuidParam, body: statusUpdateSchema }),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const updated = await withUserContext(req.user, async (client) => {
      const u = await client.query('SELECT keycloak_id FROM users WHERE id = $1', [req.params.id]);
      if (u.rowCount === 0) throw notFound('Vendor not found');

      const r = await client.query(
        `UPDATE vendor_profiles SET status = $2 WHERE user_id = $1 RETURNING *`,
        [req.params.id, status],
      );
      await audit(client, {
        userId: req.user.id,
        action: 'admin.vendor_status_changed',
        metadata: { vendorUserId: req.params.id, status },
        req,
      });
      return { profile: r.rows[0], keycloakId: u.rows[0].keycloak_id };
    });

    // Reflect suspension in Keycloak (disabled accounts cannot log in).
    await setEnabled(updated.keycloakId, status !== 'suspended').catch(() => {});

    res.json({ profile: updated.profile });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/admin/vendors/:id/documents/:docId/verify   (admin only)
// ---------------------------------------------------------------------------
adminRouter.post(
  '/vendors/:id/documents/:docId/verify',
  requireRole('admin'),
  validate({ params: docParams }),
  asyncHandler(async (req, res) => {
    const result = await withUserContext(req.user, async (client) => {
      const r = await client.query(
        `UPDATE legal_documents ld
            SET verified = true, verified_at = now(), verified_by = $1
           FROM companies c
          WHERE ld.id = $2 AND ld.company_id = c.id AND c.user_id = $3
          RETURNING ld.doc_type`,
        [req.user.id, req.params.docId, req.params.id],
      );
      if (r.rowCount === 0) throw notFound('Document not found for this vendor');
      const email = await client.query('SELECT email FROM users WHERE id = $1', [req.params.id]);
      await audit(client, {
        userId: req.user.id,
        action: 'admin.document_verified',
        metadata: { vendorUserId: req.params.id, docId: req.params.docId },
        req,
      });
      return { docType: r.rows[0].doc_type, email: email.rows[0]?.email };
    });

    if (result.email) await sendDocumentApproved({ to: result.email, docType: result.docType }).catch(() => {});
    res.json({ verified: true, docType: result.docType });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/admin/vendors/:id/documents/:docId/reject   (admin only)
// ---------------------------------------------------------------------------
adminRouter.post(
  '/vendors/:id/documents/:docId/reject',
  requireRole('admin'),
  validate({ params: docParams, body: rejectSchema }),
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const result = await withUserContext(req.user, async (client) => {
      const r = await client.query(
        `UPDATE legal_documents ld
            SET verified = false, verified_at = NULL, verified_by = NULL
           FROM companies c
          WHERE ld.id = $1 AND ld.company_id = c.id AND c.user_id = $2
          RETURNING ld.doc_type`,
        [req.params.docId, req.params.id],
      );
      if (r.rowCount === 0) throw notFound('Document not found for this vendor');
      const email = await client.query('SELECT email FROM users WHERE id = $1', [req.params.id]);
      await audit(client, {
        userId: req.user.id,
        action: 'admin.document_rejected',
        metadata: { vendorUserId: req.params.id, docId: req.params.docId, reason },
        req,
      });
      return { docType: r.rows[0].doc_type, email: email.rows[0]?.email };
    });

    if (result.email)
      await sendDocumentRejected({ to: result.email, docType: result.docType, reason }).catch(() => {});
    res.json({ rejected: true, docType: result.docType });
  }),
);
