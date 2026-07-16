import { z } from 'zod';

// All VITE_* variables are embedded in the client bundle and must be treated as public.
const schema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_PUBLIC_SITE_URL: z.string().url(),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error('Invalid frontend env: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
}

function assertProductionHttps(name: string, value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      throw new Error(`${name} must use HTTPS in production builds (got ${url.protocol})`);
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
