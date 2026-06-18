// Centralised, validated environment configuration.
// Fails fast at boot if a required variable is missing.
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load the monorepo-root .env regardless of the process working directory
// (e.g. `npm --prefix backend run dev` runs with cwd=backend/). In Docker the
// vars are already in process.env and dotenv won't override them.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });
// Also load a local backend/.env if present (does not override existing vars).
dotenv.config();

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  isProd: optional('NODE_ENV', 'development') === 'production',

  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),

  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  appBaseUrl: optional('APP_BASE_URL', 'http://localhost:3001'),

  keycloak: {
    url: required('KEYCLOAK_URL'),
    realm: required('KEYCLOAK_REALM', 'superloopz'),
    clientId: required('KEYCLOAK_CLIENT_ID', 'superloopz-backend'),
    clientSecret: required('KEYCLOAK_CLIENT_SECRET'),
    publicClientId: optional('KEYCLOAK_PUBLIC_CLIENT_ID', 'superloopz-web'),
    adminUsername: required('KEYCLOAK_ADMIN_USERNAME', 'admin'),
    adminPassword: required('KEYCLOAK_ADMIN_PASSWORD', 'admin'),
  },

  minio: {
    endpoint: required('MINIO_ENDPOINT'),
    accessKey: required('MINIO_ACCESS_KEY'),
    secretKey: required('MINIO_SECRET_KEY'),
    bucket: required('MINIO_BUCKET_LEGAL_DOCS', 'superloopz-legal-docs'),
    region: optional('MINIO_REGION', 'us-east-1'),
  },

  r2: {
    endpoint: optional('CLOUDFLARE_R2_ENDPOINT', ''),
    accessKey: optional('CLOUDFLARE_R2_ACCESS_KEY', ''),
    secretKey: optional('CLOUDFLARE_R2_SECRET_KEY', ''),
    bucket: optional('CLOUDFLARE_R2_BUCKET', 'superloopz-public'),
    region: optional('CLOUDFLARE_R2_REGION', 'auto'),
  },

  resend: {
    apiKey: optional('RESEND_API_KEY', ''),
    fromEmail: optional('RESEND_FROM_EMAIL', 'SuperLoopz <onboarding@superloopz.com>'),
  },

  rateLimit: {
    windowSeconds: parseInt(optional('RATE_LIMIT_WINDOW_SECONDS', '60'), 10),
    maxRequests: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  },

  upload: {
    maxBytes: 5 * 1024 * 1024, // 5MB per the File Storage Rules
    acceptedMime: ['image/png', 'image/jpeg', 'application/pdf'],
  },
};
