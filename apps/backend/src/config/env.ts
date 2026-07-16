import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { assertPublicOutboundHostname } from '../utils/outboundHostname.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });

const boolFromEnv = z
  .union([z.literal('true'), z.literal('false')])
  .transform((v) => v === 'true');

const UNION_RENTAL_PORTS = {
  api: 4001,
  web: 5174,
} as const;

function isExactAllowedOriginList(value: string) {
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0) return false;

  return origins.every((origin) => {
    if (origin.includes('*')) return false;
    try {
      const url = new URL(origin);
      const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
      const allowedProtocol = url.protocol === 'https:' || localHttp;
      return allowedProtocol
        && url.origin === origin
        && !url.username
        && !url.password
        && url.pathname === '/';
    } catch {
      return false;
    }
  });
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000).refine(
    (port) => port !== UNION_RENTAL_PORTS.api,
    `PORT must not be ${UNION_RENTAL_PORTS.api} (reserved for Union Rental)`,
  ),
  HOST: z.string().default('127.0.0.1'),
  PUBLIC_API_BASE_URL: z.string().url(),
  TRUSTED_HOSTS: z.string().optional().default(''),
  FRONTEND_ORIGIN: z.string()
    .min(1)
    .refine(
      isExactAllowedOriginList,
      'FRONTEND_ORIGIN must contain exact HTTPS origins (HTTP is allowed only for localhost)',
    )
    .refine(
      (origin) => !origin.includes(`:${UNION_RENTAL_PORTS.web}`),
      `FRONTEND_ORIGIN must not use :${UNION_RENTAL_PORTS.web} (reserved for Union Rental)`,
    ),
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
  GOOGLE_SHEET_ORCHA_ID: z.string().min(1),
  GOOGLE_SHEET_ORCHA_GID: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_ENABLED: boolFromEnv.default('false'),
  EMAIL_FROM: z.string().optional().default(''),
  EMAIL_REPLY_TO: z.string().optional().default(''),
  GEOCODING_PROVIDER: z.string().default('nominatim'),
  GEOCODING_USER_AGENT: z.string().min(1),
  GEOCODING_BASE_URL: z.string().url(),
  GEOCODING_FETCH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  RUN_SHEET_SYNC_ON_STARTUP: boolFromEnv.default('false'),
  CRON_SHEET_SYNC: z.string().default('0 */6 * * *'),
  CRON_STALE_MEDIA_CLEANUP: z.string().default('30 3 * * *'),
  RATE_LIMIT_PUBLIC_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().default(30),
  RATE_LIMIT_API_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_API_MAX: z.coerce.number().default(300),
  HTTP_MAX_HEADER_SIZE_BYTES: z.coerce.number().int().min(8192).max(65536).default(16384),
  HTTP_HEADERS_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15000),
  HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(10000).default(120000),
  HTTP_KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  DB_QUERY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
}).superRefine((data, ctx) => {
  try {
    const geocodingUrl = new URL(data.GEOCODING_BASE_URL);
    assertPublicOutboundHostname(geocodingUrl.hostname);
    if (data.NODE_ENV === 'production' && geocodingUrl.protocol !== 'https:') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GEOCODING_BASE_URL'],
        message: 'GEOCODING_BASE_URL must use HTTPS in production',
      });
    }
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GEOCODING_BASE_URL'],
      message: error instanceof Error ? error.message : 'GEOCODING_BASE_URL hostname is not allowed',
    });
  }

  if (data.NODE_ENV !== 'production') return;

  if (data.EMAIL_ENABLED) {
    const from = z.string().email().safeParse(data.EMAIL_FROM);
    if (!from.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_FROM'],
        message: 'EMAIL_FROM must be a valid email when EMAIL_ENABLED=true',
      });
    }
    if (data.EMAIL_REPLY_TO) {
      const replyTo = z.string().email().safeParse(data.EMAIL_REPLY_TO);
      if (!replyTo.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_REPLY_TO'],
          message: 'EMAIL_REPLY_TO must be a valid email',
        });
      }
    }
  }

  if (!data.PUBLIC_API_BASE_URL.startsWith('https://')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PUBLIC_API_BASE_URL'],
      message: 'Production API URL must use HTTPS',
    });
  }

  const publicHost = new URL(data.PUBLIC_API_BASE_URL).host.toLowerCase();
  const extraHosts = data.TRUSTED_HOSTS.split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (extraHosts.some((host) => host.includes('*'))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TRUSTED_HOSTS'],
      message: 'TRUSTED_HOSTS must contain exact hosts without wildcards',
    });
  }
  if (extraHosts.length > 0 && !extraHosts.includes(publicHost)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TRUSTED_HOSTS'],
      message: 'TRUSTED_HOSTS must include the PUBLIC_API_BASE_URL host',
    });
  }

  for (const origin of data.FRONTEND_ORIGIN.split(',').map((value) => value.trim())) {
    if (!origin.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FRONTEND_ORIGIN'],
        message: 'Production frontend origins must use HTTPS',
      });
      break;
    }
  }
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
