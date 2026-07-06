import { z } from 'zod';

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

export const env = parsed.data;
