// Idempotency for state-changing/transaction endpoints.
// The client sends an `Idempotency-Key` header; the first response is cached in
// Redis and replayed for any retry with the same key, preventing duplicates.
import { redis } from '../redis/client.js';
import { ApiError } from '../utils/errors.js';

const TTL_SECONDS = 24 * 60 * 60; // keep keys for 24h

export function idempotency({ required = false } = {}) {
  return async function idempotencyMiddleware(req, res, next) {
    const key = req.headers['idempotency-key'];
    if (!key) {
      if (required) return next(new ApiError(400, 'Idempotency-Key header is required'));
      return next();
    }

    const scope = `idem:${req.user?.id || req.ip}:${req.method}:${req.path}:${key}`;

    try {
      // Reserve the key atomically. NX => only set if not present.
      const reserved = await redis.set(scope, 'pending', 'EX', TTL_SECONDS, 'NX');

      if (!reserved) {
        const cached = await redis.get(scope);
        if (cached && cached !== 'pending') {
          const { status, body } = JSON.parse(cached);
          res.setHeader('Idempotency-Replayed', 'true');
          return res.status(status).json(body);
        }
        // Still processing a concurrent request with the same key.
        return next(new ApiError(409, 'A request with this Idempotency-Key is already in progress'));
      }

      // Capture the response so retries can replay it.
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        redis
          .set(scope, JSON.stringify({ status: res.statusCode, body }), 'EX', TTL_SECONDS)
          .catch(() => {});
        return originalJson(body);
      };
      next();
    } catch {
      // Fail open on Redis errors.
      next();
    }
  };
}
