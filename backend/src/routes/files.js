// File access — issues short-lived signed URLs. Buckets are never public.
// Authorization: vendors may only sign URLs for keys under their own user id;
// staff (admin/support) may sign any key.
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getSignedDownloadUrl } from '../storage/index.js';
import { forbidden, badRequest } from '../utils/errors.js';

export const filesRouter = Router();
filesRouter.use(requireAuth);

// GET /api/files/signed-url/<fileKey...>
// fileKey is the full object key, e.g. legal/<uid>/GST/cert.pdf
filesRouter.get(
  '/signed-url/*',
  asyncHandler(async (req, res) => {
    const fileKey = req.params[0];
    if (!fileKey) throw badRequest('Missing file key');

    // Storage backend is implied by the key prefix.
    const storageType = fileKey.startsWith('profiles/') ? 'r2' : 'minio';

    // Vendors are scoped to their own user-id segment in the path.
    if (req.user.role === 'vendor') {
      const expectedSegment = `/${req.user.id}/`;
      if (!fileKey.includes(expectedSegment)) {
        throw forbidden('You do not have access to this file');
      }
    }

    const url = await getSignedDownloadUrl({ storageType, key: fileKey });
    res.json({ url, expiresInSeconds: 300, storageType });
  }),
);
