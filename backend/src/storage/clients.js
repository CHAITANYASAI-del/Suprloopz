// S3-compatible clients for both storage backends.
// MinIO (self-hosted) holds legal documents; Cloudflare R2 (managed) holds
// profile photos and catalog images. Identical S3 API — only endpoint differs.
import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../config/env.js';

export const minioClient = new S3Client({
  endpoint: config.minio.endpoint,
  region: config.minio.region,
  forcePathStyle: true, // MinIO requires path-style addressing
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
});

// R2 is only constructed if configured; otherwise null so the app still boots
// locally without R2 credentials.
export const r2Client = config.r2.endpoint
  ? new S3Client({
      endpoint: config.r2.endpoint,
      region: config.r2.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.r2.accessKey,
        secretAccessKey: config.r2.secretKey,
      },
    })
  : null;
