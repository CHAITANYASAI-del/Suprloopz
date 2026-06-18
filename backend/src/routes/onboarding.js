// Vendor onboarding routes — the 7-step flow.
// All handlers run inside withUserContext(req.user) so RLS guarantees a vendor
// only ever touches their own rows.
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { uploadLegalDoc } from '../middleware/upload.js';
import { withUserContext } from '../db/pool.js';
import { audit } from '../utils/audit.js';
import { buildLegalKey, putObject } from '../storage/index.js';
import { sendOnboardingComplete } from '../email/resend.js';
import {
  profileSchema,
  companySchema,
  legalSaveSchema,
  addressSchema,
} from '../validation/schemas.js';
import { ApiError, badRequest } from '../utils/errors.js';

export const onboardingRouter = Router();
onboardingRouter.use(requireAuth, requireRole('vendor'));

// Helper: fetch the vendor's company id, creating nothing.
async function getCompanyId(client, userId) {
  const r = await client.query('SELECT id FROM companies WHERE user_id = $1', [userId]);
  return r.rows[0]?.id ?? null;
}

// GET /api/onboarding/status
onboardingRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    const data = await withUserContext(req.user, async (client) => {
      const os = await client.query('SELECT * FROM onboarding_status WHERE user_id = $1', [
        req.user.id,
      ]);
      const vp = await client.query(
        'SELECT onboarding_step, status FROM vendor_profiles WHERE user_id = $1',
        [req.user.id],
      );
      return { onboarding: os.rows[0] || null, profile: vp.rows[0] || null };
    });
    res.json(data);
  }),
);

// POST /api/onboarding/profile  (Step 4)
onboardingRouter.post(
  '/profile',
  validate({ body: profileSchema }),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, phone } = req.body;
    const result = await withUserContext(req.user, async (client) => {
      const r = await client.query(
        `INSERT INTO vendor_profiles (user_id, first_name, last_name, phone, onboarding_step, status)
         VALUES ($1, $2, $3, $4, 2, 'pending')
         ON CONFLICT (user_id) DO UPDATE
            SET first_name = EXCLUDED.first_name,
                last_name  = EXCLUDED.last_name,
                phone      = EXCLUDED.phone,
                onboarding_step = GREATEST(vendor_profiles.onboarding_step, 2)
         RETURNING *`,
        [req.user.id, firstName, lastName, phone],
      );
      await client.query(
        `UPDATE onboarding_status SET profile_completed = true WHERE user_id = $1`,
        [req.user.id],
      );
      await audit(client, { userId: req.user.id, action: 'onboarding.profile_saved', req });
      return r.rows[0];
    });
    res.json({ profile: result, nextStep: 'company' });
  }),
);

// POST /api/onboarding/company  (Step 5)
onboardingRouter.post(
  '/company',
  validate({ body: companySchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const incorporationDate = b.incorporationDate && b.incorporationDate !== '' ? b.incorporationDate : null;
    const result = await withUserContext(req.user, async (client) => {
      const r = await client.query(
        `INSERT INTO companies (
            user_id, legal_name, trade_name, registration_number, incorporation_date,
            industry, vendor_type, vendor_category, years_in_business, number_of_employees,
            annual_turnover, website, company_email, company_speciality)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (user_id) DO UPDATE SET
            legal_name = EXCLUDED.legal_name,
            trade_name = EXCLUDED.trade_name,
            registration_number = EXCLUDED.registration_number,
            incorporation_date = EXCLUDED.incorporation_date,
            industry = EXCLUDED.industry,
            vendor_type = EXCLUDED.vendor_type,
            vendor_category = EXCLUDED.vendor_category,
            years_in_business = EXCLUDED.years_in_business,
            number_of_employees = EXCLUDED.number_of_employees,
            annual_turnover = EXCLUDED.annual_turnover,
            website = EXCLUDED.website,
            company_email = EXCLUDED.company_email,
            company_speciality = EXCLUDED.company_speciality
         RETURNING *`,
        [
          req.user.id, b.legalName, b.tradeName, b.registrationNumber, incorporationDate,
          b.industry, b.vendorType, b.vendorCategory, b.yearsInBusiness, b.numberOfEmployees,
          b.annualTurnover, b.website, b.companyEmail, b.companySpeciality,
        ],
      );
      await client.query(
        `UPDATE vendor_profiles SET onboarding_step = GREATEST(onboarding_step, 3) WHERE user_id = $1`,
        [req.user.id],
      );
      await client.query(
        `UPDATE onboarding_status SET company_info_completed = true WHERE user_id = $1`,
        [req.user.id],
      );
      await audit(client, { userId: req.user.id, action: 'onboarding.company_saved', req });
      return r.rows[0];
    });
    res.json({ company: result, nextStep: 'legal' });
  }),
);

// POST /api/onboarding/legal/upload  (Step 6 — file to MinIO)
// multipart/form-data: file=<binary>, docType=GST|PAN|CIN
onboardingRouter.post(
  '/legal/upload',
  uploadLegalDoc,
  asyncHandler(async (req, res) => {
    const docType = req.body?.docType;
    if (!['GST', 'PAN', 'CIN'].includes(docType)) {
      throw badRequest('docType must be one of GST, PAN, CIN');
    }
    if (!req.file) throw badRequest('No file uploaded');

    const key = buildLegalKey(req.user.id, docType, req.file.originalname);
    await putObject({
      storageType: 'minio',
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    await withUserContext(req.user, (client) =>
      audit(client, {
        userId: req.user.id,
        action: 'onboarding.legal_uploaded',
        metadata: { docType, key, size: req.file.size },
        req,
      }),
    );

    res.json({ fileKey: key, storageType: 'minio', docType });
  }),
);

// POST /api/onboarding/legal/save  (Step 6 — persist doc metadata)
onboardingRouter.post(
  '/legal/save',
  validate({ body: legalSaveSchema }),
  asyncHandler(async (req, res) => {
    const result = await withUserContext(req.user, async (client) => {
      const companyId = await getCompanyId(client, req.user.id);
      if (!companyId) throw new ApiError(409, 'Complete company information first');

      const saved = [];
      for (const doc of req.body.documents) {
        const r = await client.query(
          `INSERT INTO legal_documents (company_id, doc_type, doc_name, doc_number, file_url, storage_type)
           VALUES ($1, $2, $3, $4, $5, 'minio')
           ON CONFLICT (company_id, doc_type) DO UPDATE SET
              doc_name = EXCLUDED.doc_name,
              doc_number = EXCLUDED.doc_number,
              file_url = EXCLUDED.file_url,
              verified = false, verified_at = NULL, verified_by = NULL
           RETURNING id, doc_type, doc_name, doc_number, verified`,
          [companyId, doc.docType, doc.docName, doc.docNumber, doc.fileKey],
        );
        saved.push(r.rows[0]);
      }

      await client.query(
        `UPDATE vendor_profiles SET onboarding_step = GREATEST(onboarding_step, 4) WHERE user_id = $1`,
        [req.user.id],
      );
      await client.query(
        `UPDATE onboarding_status SET legal_docs_completed = true WHERE user_id = $1`,
        [req.user.id],
      );
      await audit(client, {
        userId: req.user.id,
        action: 'onboarding.legal_saved',
        metadata: { count: saved.length },
        req,
      });
      return saved;
    });
    res.json({ documents: result, nextStep: 'address' });
  }),
);

// POST /api/onboarding/address  (Step 7 — completes onboarding)
onboardingRouter.post(
  '/address',
  idempotency(),
  validate({ body: addressSchema }),
  asyncHandler(async (req, res) => {
    const { registered, sameAsBilling, billing, shipping } = req.body;
    const billingAddr = sameAsBilling ? registered : billing;
    if (!billingAddr) throw badRequest('Billing address is required (or check "same as registered")');
    if (!shipping) throw badRequest('Shipping address is required');

    const completed = await withUserContext(req.user, async (client) => {
      const companyId = await getCompanyId(client, req.user.id);
      if (!companyId) throw new ApiError(409, 'Complete company information first');

      const upsert = (type, a) =>
        client.query(
          `INSERT INTO addresses (company_id, type, street_address, city, state, postal_code, country)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (company_id, type) DO UPDATE SET
              street_address = EXCLUDED.street_address, city = EXCLUDED.city,
              state = EXCLUDED.state, postal_code = EXCLUDED.postal_code, country = EXCLUDED.country`,
          [companyId, type, a.streetAddress, a.city, a.state, a.postalCode, a.country],
        );

      await upsert('registered', registered);
      await upsert('billing', billingAddr);
      await upsert('shipping', shipping);

      await client.query(
        `UPDATE vendor_profiles SET onboarding_step = 5, status = 'active' WHERE user_id = $1`,
        [req.user.id],
      );
      const os = await client.query(
        `UPDATE onboarding_status
            SET address_completed = true, fully_onboarded = true, completed_at = now()
          WHERE user_id = $1
          RETURNING *`,
        [req.user.id],
      );
      await audit(client, { userId: req.user.id, action: 'onboarding.completed', req });
      return os.rows[0];
    });

    sendOnboardingComplete({ to: req.user.email }).catch(() => {});
    res.json({ onboarding: completed, fullyOnboarded: true, nextStep: 'dashboard' });
  }),
);
