// Multer config for legal-document uploads.
// In-memory storage (files are streamed straight to MinIO), 5MB cap, and a
// strict allow-list of PNG / JPEG / PDF per the File Storage Rules.
import multer from 'multer';
import { config } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (config.upload.acceptedMime.includes(file.mimetype)) return cb(null, true);
    cb(new ApiError(400, 'Unsupported file type. Allowed: PNG, JPEG, PDF'));
  },
}).single('file');

// Wrap multer so its errors flow through our error handler with clean messages.
export function uploadLegalDoc(req, res, next) {
  uploadSingle(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(400, 'File exceeds the 5MB limit'));
      }
      return next(err instanceof ApiError ? err : new ApiError(400, err.message));
    }
    next();
  });
}
