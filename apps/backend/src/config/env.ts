import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });

const boolFromEnv = z
  .union([z.literal('true'), z.literal('false')])
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  PUBLIC_API_BASE_URL: z.string().url(),
  FRONTEND_ORIGIN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_SIGNED_UPLOAD_EXPIRES_SECONDS: z.coerce.number().default(900),
  R2_SIGNED_DOWNLOAD_EXPIRES_SECONDS: z.coerce.number().default(300),
  STORAGE_DRIVER: z.enum(['r2', 'local', 'auto']).default('auto'),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional().default(''),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional().default(''),
  GOOGLE_SHEET_FAST_RENTAL_ID: z.string().min(1),
  // Re-enable when Orcha sheet sync is needed:
  // GOOGLE_SHEET_ORCHA_ID: z.string().min(1),
  // GOOGLE_SHEET_ORCHA_GID: z.string().min(1),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_ENABLED: boolFromEnv.default('false'),
  EMAIL_FROM: z.string().optional().default(''),
  EMAIL_REPLY_TO: z.string().optional().default(''),
  GEOCODING_PROVIDER: z.string().default('nominatim'),
  GEOCODING_USER_AGENT: z.string().min(1),
  GEOCODING_BASE_URL: z.string().url(),
  RUN_SHEET_SYNC_ON_STARTUP: boolFromEnv.default('false'),
  CRON_SHEET_SYNC: z.string().default('0 */6 * * *'),
  CRON_ARCHIVE_DELETE: z.string().default('0 3 * * *'),
  CRON_STALE_MEDIA_CLEANUP: z.string().default('30 3 * * *'),
  RATE_LIMIT_PUBLIC_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().default(30),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid backend env:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

function resolveStorageDriver(data: z.infer<typeof schema>) {
  if (data.NODE_ENV === 'test') return 'r2' as const;
  if (data.STORAGE_DRIVER === 'r2') return 'r2' as const;
  if (data.STORAGE_DRIVER === 'local') return 'local' as const;
  if (data.NODE_ENV === 'development' && data.R2_ACCESS_KEY_ID.startsWith('cfat_')) {
    return 'local' as const;
  }
  return 'r2' as const;
}

export const env = {
  ...parsed.data,
  STORAGE_DRIVER: resolveStorageDriver(parsed.data),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: parsed.data.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
};
