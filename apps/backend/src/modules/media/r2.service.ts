import { HeadObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export async function createUploadUrl(objectKey: string, mimeType: string) {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: objectKey,
    ContentType: mimeType,
  });
  return getSignedUrl(r2, command, { expiresIn: env.R2_SIGNED_UPLOAD_EXPIRES_SECONDS });
}

export async function createDownloadUrl(objectKey: string, filename: string, inline = false) {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: objectKey,
    ResponseContentDisposition: inline
      ? 'inline'
      : `attachment; filename="${filename.replace(/"/g, '')}"`,
  });
  return getSignedUrl(r2, command, { expiresIn: env.R2_SIGNED_DOWNLOAD_EXPIRES_SECONDS });
}

export async function objectExists(objectKey: string) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey }));
    return true;
  } catch {
    return false;
  }
}

export async function deleteObject(objectKey: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey }));
}
