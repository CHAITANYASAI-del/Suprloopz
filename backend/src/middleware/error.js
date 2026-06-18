import { ApiError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

// 404 fallthrough.
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found', path: req.path });
}

// Central error handler. Maps ApiError + zod errors to clean JSON responses.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err?.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}
