import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Supabase session tokens live in sessionStorage (tab-scoped, cleared on browser close).
// The app does not store tokens in React state, query caches, or other persisted stores.
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: window.sessionStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

let cachedAccessToken: string | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token ?? null;
});

/** Prefer the in-memory token to avoid getSession() races right after sign-in. */
export function setCachedAccessToken(token: string | null): void {
  cachedAccessToken = token;
}

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export async function resolveAccessToken(): Promise<string | null> {
  if (cachedAccessToken) return cachedAccessToken;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  cachedAccessToken = token;
  return token;
}
