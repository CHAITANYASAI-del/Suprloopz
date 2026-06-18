// SuperLoopz Vendor Onboarding API — Express bootstrap.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { rateLimit } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { onboardingRouter } from './routes/onboarding.js';
import { vendorRouter } from './routes/vendor.js';
import { filesRouter } from './routes/files.js';

const app = express();

// Behind Cloudflare / a proxy — trust X-Forwarded-* so req.ip is the real client.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Health checks (no auth, no rate limit).
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'superloopz-api' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Global rate limit on the API surface.
app.use('/api', rateLimit());

// Routes.
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/vendor', vendorRouter);
app.use('/api/files', filesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`SuperLoopz API listening on :${config.port} (${config.env})`);
});

// Graceful shutdown.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    logger.info(`${sig} received — shutting down`);
    server.close(() => process.exit(0));
  });
}

export default app;
