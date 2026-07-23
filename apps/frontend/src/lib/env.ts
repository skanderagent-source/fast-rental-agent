import { z } from 'zod';

declare global {
  interface Window {
    /** Populated by /api/runtime-config.js on Vercel before the app bundle loads. */
    __FAST_RENTAL_ENV__?: Record<string, string>;
  }
}

const schema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_PUBLIC_SITE_URL: z
    .string()
    .url()
    .transform((url) => url.replace(/\/+$/, '')),
});

function readEnvSource(): Record<string, unknown> {
  if (import.meta.env.PROD && typeof window !== 'undefined' && window.__FAST_RENTAL_ENV__) {
    return window.__FAST_RENTAL_ENV__;
  }
  return import.meta.env;
}

const parsed = schema.safeParse(readEnvSource());
if (!parsed.success) {
  const hint = import.meta.env.PROD
    ? ' On Vercel, confirm /api/runtime-config.js loads and all VITE_* vars are set in the project dashboard.'
    : ' For local dev, copy apps/frontend/.env.example to apps/frontend/.env.';
  throw new Error('Invalid frontend env: ' + JSON.stringify(parsed.error.flatten().fieldErrors) + hint);
}

function assertProductionHttps(name: string, value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      throw new Error(`${name} must use HTTPS in production (got ${url.protocol})`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('must use HTTPS')) throw err;
    throw new Error(`${name} must be a valid absolute URL`);
  }
}

if (import.meta.env.PROD) {
  assertProductionHttps('VITE_API_BASE_URL', parsed.data.VITE_API_BASE_URL);
  assertProductionHttps('VITE_SUPABASE_URL', parsed.data.VITE_SUPABASE_URL);
  assertProductionHttps('VITE_PUBLIC_SITE_URL', parsed.data.VITE_PUBLIC_SITE_URL);
}

export const env = Object.freeze(parsed.data);
