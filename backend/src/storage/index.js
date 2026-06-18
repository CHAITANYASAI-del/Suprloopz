// High-level storage helpers used by routes.
// Enforces the path conventions and signed-URL-only access from the report:
//   MinIO  : legal/{user_id}/{doc_type}/{filename}
//   R2     : profiles/{user_id}/{filename}
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';
import { minioClient, r2Client } from './clients.js';

const SIGNED_URL_TTL = 300; // 5 minutes

function clientFor(storageType) {
  if (storageType === 'r2') {
    if (!r2Client) throw new Error('Cloudflare R2 is not configured');
    return { client: r2Client, bucket: config.r2.bucket };
  }
  return { client: minioClient, bucket: config.minio.bucket };
}

export function buildLegalKey(userId, docType, filename) {
  return `legal/${userId}/${docType}/${sanitize(filename)}`;
}

export function buildProfileKey(userId, filename) {
  return `profiles/${userId}/${sanitize(filename)}`;
}

function sanitize(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

/**
 * Upload a buffer. `storageType` is 'minio' (legal) or 'r2' (public assets).
 * Returns the object key (stored in legal_documents.file_url).
 */
export async function putObject({ storageType, key, body, contentType }) {
  const { client, bucket } = clientFor(storageType);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Server-side encryption (MinIO/R2 honour SSE-S3).
      ServerSideEncryption: 'AES256',
    }),
  );
  return key;
}

/** Generate a short-lived signed download URL — buckets are never public. */
export async function getSignedDownloadUrl({ storageType, key, ttl = SIGNED_URL_TTL }) {
  const { client, bucket } = clientFor(storageType);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: ttl,
  });
}
