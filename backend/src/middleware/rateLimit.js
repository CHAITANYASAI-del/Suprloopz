// Redis-backed fixed-window rate limiter.
// Keyed by client IP + route group. Applied globally and can be tightened per
// route (e.g. login) by passing custom options.
import { redis } from '../redis/client.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

export function rateLimit({ windowSeconds, max, keyPrefix = 'rl' } = {}) {
  const win = windowSeconds ?? config.rateLimit.windowSeconds;
  const limit = max ?? config.rateLimit.maxRequests;

  return async function rateLimiter(req, res, next) {
    try {
      const id = req.user?.id || req.ip || 'anon';
      const bucket = Math.floor(Date.now() / 1000 / win);
      const key = `${keyPrefix}:${id}:${bucket}`;

      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, win);

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));

      if (count > limit) {
        return next(new ApiError(429, 'Too many requests — slow down'));
      }
      next();
    } catch {
      // Fail open: never let a Redis hiccup take the API down.
      next();
    }
  };
}
