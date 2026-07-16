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

export async function putObject(objectKey: string, body: Buffer, mimeType: string) {
  await r2.send(new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: objectKey,
    Body: body,
    ContentType: mimeType,
  }));
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

export async function getObjectSize(objectKey: string): Promise<number> {
  const response = await r2.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey }));
  return Number(response.ContentLength ?? 0);
}

export async function readObjectPrefix(objectKey: string, maxBytes: number): Promise<Buffer> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const end = Math.max(0, maxBytes - 1);
  const response = await r2.send(new GetObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: objectKey,
    Range: `bytes=0-${end}`,
  }));
  const body = response.Body;
  if (!body) return Buffer.alloc(0);
  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function readObjectBytes(objectKey: string): Promise<Buffer> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const response = await r2.send(new GetObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: objectKey,
  }));
  const body = response.Body;
  if (!body) return Buffer.alloc(0);
  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteObject(objectKey: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey }));
}
