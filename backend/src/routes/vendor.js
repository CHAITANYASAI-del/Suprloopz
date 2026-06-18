// Vendor self-service routes — read/update own profile, company, docs, addresses.
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { withUserContext } from '../db/pool.js';
import { audit } from '../utils/audit.js';
import { profileSchema, companySchema } from '../validation/schemas.js';
import { notFound } from '../utils/errors.js';

export const vendorRouter = Router();
vendorRouter.use(requireAuth, requireRole('vendor'));

// GET /api/vendor/profile
vendorRouter.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const row = await withUserContext(req.user, async (client) => {
      const r = await client.query('SELECT * FROM vendor_profiles WHERE user_id = $1', [req.user.id]);
      return r.rows[0] || null;
    });
    if (!row) throw notFound('Profile not found');
    res.json({ profile: row });
  }),
);

// PATCH /api/vendor/profile
vendorRouter.patch(
  '/profile',
  validate({ body: profileSchema.partial() }),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, phone } = req.body;
    const row = await withUserContext(req.user, async (client) => {
      const r = await client.query(
        `UPDATE vendor_profiles
            SET first_name = COALESCE($2, first_name),
                last_name  = COALESCE($3, last_name),
                phone      = COALESCE($4, phone)
          WHERE user_id = $1
          RETURNING *`,
        [req.user.id, firstName ?? null, lastName ?? null, phone ?? null],
      );
      await audit(client, { userId: req.user.id, action: 'vendor.profile_updated', req });
      return r.rows[0];
    });
    if (!row) throw notFound('Profile not found');
    res.json({ profile: row });
  }),
);

// GET /api/vendor/company
vendorRouter.get(
  '/company',
  asyncHandler(async (req, res) => {
    const row = await withUserContext(req.user, async (client) => {
      const r = await client.query('SELECT * FROM companies WHERE user_id = $1', [req.user.id]);
      return r.rows[0] || null;
    });
    if (!row) throw notFound('Company not found');
    res.json({ company: row });
  }),
);

// PATCH /api/vendor/company
vendorRouter.patch(
  '/company',
  validate({ body: companySchema.partial() }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const row = await withUserContext(req.user, async (client) => {
      const r = await client.query(
        `UPDATE companies SET
            legal_name = COALESCE($2, legal_name),
            trade_name = COALESCE($3, trade_name),
            registration_number = COALESCE($4, registration_number),
            industry = COALESCE($5, industry),
            vendor_type = COALESCE($6, vendor_type),
            vendor_category = COALESCE($7, vendor_category),
            years_in_business = COALESCE($8, years_in_business),
            number_of_employees = COALESCE($9, number_of_employees),
            annual_turnover = COALESCE($10, annual_turnover),
            website = COALESCE($11, website),
            company_email = COALESCE($12, company_email),
            company_speciality = COALESCE($13, company_speciality)
          WHERE user_id = $1
          RETURNING *`,
        [
          req.user.id, b.legalName ?? null, b.tradeName ?? null, b.registrationNumber ?? null,
          b.industry ?? null, b.vendorType ?? null, b.vendorCategory ?? null,
          b.yearsInBusiness ?? null, b.numberOfEmployees ?? null, b.annualTurnover ?? null,
          b.website ?? null, b.companyEmail ?? null, b.companySpeciality ?? null,
        ],
      );
      await audit(client, { userId: req.user.id, action: 'vendor.company_updated', req });
      return r.rows[0];
    });
    if (!row) throw notFound('Company not found');
    res.json({ company: row });
  }),
);

// GET /api/vendor/documents
vendorRouter.get(
  '/documents',
  asyncHandler(async (req, res) => {
    const rows = await withUserContext(req.user, async (client) => {
      const r = await client.query(
        `SELECT ld.* FROM legal_documents ld
           JOIN companies c ON c.id = ld.company_id
          WHERE c.user_id = $1
          ORDER BY ld.doc_type`,
        [req.user.id],
      );
      return r.rows;
    });
    res.json({ documents: rows });
  }),
);

// GET /api/vendor/addresses
vendorRouter.get(
  '/addresses',
  asyncHandler(async (req, res) => {
    const rows = await withUserContext(req.user, async (client) => {
      const r = await client.query(
        `SELECT a.* FROM addresses a
           JOIN companies c ON c.id = a.company_id
          WHERE c.user_id = $1
          ORDER BY a.type`,
        [req.user.id],
      );
      return r.rows;
    });
    res.json({ addresses: rows });
  }),
);
